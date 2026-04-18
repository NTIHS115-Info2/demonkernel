import { EventEmitter } from "node:events";

import type {
  SendOptions,
  StateResult,
  StrategyOnlineOptions,
  StrategyRestartOptions,
} from "../../../../core/plugin-sdk";
import { createKernelLogger } from "../../../../core/logger";
import {
  createObservabilityRequestId,
  summarizeText,
  summarizeUnknown,
  withObservability,
} from "../../../../core/logger/observability";
import capabilityRegistry from "../../../../core/registry";

import {
  CAPABILITY_DISCORD_SEND,
  CAPABILITY_DISCORD_STREAM,
  CAPABILITY_DISCORD_TYPING_START,
  CAPABILITY_DISCORD_TYPING_STOP,
  CAPABILITY_LLM_CHAT_STREAM,
  CAPABILITY_CONVERSATION_HISTORY_APPEND,
  CAPABILITY_CONVERSATION_HISTORY_RECENT,
  DEFAULT_HISTORY_LIMIT,
  DEFAULT_RELAY_ENABLED,
  DEFAULT_RELAY_ERROR_REPLY,
  METHOD_LOCAL,
} from "./constants";
import { buildGatewayPayload, normalizeTalkInput } from "./input";
import { composePromptContent, composePromptMessages } from "./promptComposer";
import { RelayQueue } from "./relayQueue";
import { collectStreamReply } from "./streamCollector";
import type {
  ConversationHistoryAppendProvider,
  ConversationHistoryRecentProvider,
  DiscordConversationEvent,
  DiscordConversationProvider,
  DiscordConversationStream,
  DiscordMessageSendProvider,
  DiscordTypingStartProvider,
  DiscordTypingStopProvider,
  HistoryPromptMessage,
  LlmChatStreamProvider,
  LlmStreamEmitter,
  NormalizedTalkInput,
  RelayRuntime,
  TalkNoStreamResult,
  TalkOnlineOptions,
  TalkSendInput,
} from "./types";

type LocalRuntime = {
  online: boolean;
  relay: RelayRuntime;
  relayQueue: RelayQueue<DiscordConversationEvent> | null;
};

const logger = createKernelLogger("plugin-talk-engine-local", {
  plugin: "talk-engine",
  type: "system",
  strategy: "local",
});

function logTalkInfo(message: string, meta: Record<string, unknown> = {}): void {
  const hasObservability = isRecord(meta.observability);
  logger.info(
    message,
    withObservability(
      {
        stage: "talk-engine",
        ...meta,
      },
      hasObservability
        ? (meta.observability as {
            kind: "node" | "raw";
            requestId?: string;
            eventType?: string;
            outcome?: "success" | "error" | "abort" | "timeout";
          })
        : { kind: "node" }
    )
  );
}

function logTalkRaw(
  message: string,
  requestId: string,
  eventType: string,
  meta: Record<string, unknown> = {}
): void {
  logger.info(
    message,
    withObservability(
      {
        stage: "talk-engine",
        ...meta,
      },
      {
        kind: "raw",
        requestId,
        eventType,
      }
    )
  );
}

let runtime: LocalRuntime = {
  online: false,
  relay: {
    enabled: DEFAULT_RELAY_ENABLED,
    errorReply: DEFAULT_RELAY_ERROR_REPLY,
    stream: null,
    dataListener: null,
    errorListener: null,
  },
  relayQueue: null,
};

type ReasoningFlow = "nostream" | "stream";

type ReasoningTracker = {
  flow: ReasoningFlow;
  requestId: string;
  conversationId: string | null;
  userId: string | null;
  chunkCount: number;
  totalLength: number;
  firstChunkIndex: number | null;
  firstChunkAt: number | null;
  visibleChunkCount: number;
  visibleLength: number;
  dataEventCount: number;
  snippets: string[];
};

function summarizeNormalizedInput(input: NormalizedTalkInput): Record<string, unknown> {
  return {
    action: input.action,
    message: summarizeText(input.message),
    talker: input.talker,
    conversationId: input.conversationId,
    userId: input.userId,
    historyLimit: input.historyLimit,
    model: input.model ?? null,
    toolCount: Array.isArray(input.tools) ? input.tools.length : 0,
    toolChoice: input.toolChoice ?? null,
    params: summarizeUnknown(input.params),
    timeoutMs: input.timeoutMs ?? null,
    connectionTimeoutMs: input.connectionTimeoutMs ?? null,
    maxRetries: input.maxRetries ?? null,
    retryDelayBaseMs: input.retryDelayBaseMs ?? null,
    reqId: input.reqId ?? null,
    reqIdHeader: input.reqIdHeader ?? null,
    headers: summarizeUnknown(input.headers ?? null),
  };
}

function resolveTalkRequestId(input: NormalizedTalkInput, flow: string): string {
  return createObservabilityRequestId(`talk-engine:${flow}`, {
    requestId: input.reqId ?? null,
    conversationId: input.conversationId,
    userId: input.userId,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "boolean") {
    return fallback;
  }
  return value;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAssistantReply(reply: unknown): string {
  if (typeof reply !== "string") {
    throw new Error("llm reply must be string");
  }

  const trimmed = reply.trim();
  if (trimmed.length === 0) {
    throw new Error("llm reply is empty");
  }

  return trimmed;
}

function extractReasoningFromRaw(raw: unknown): string {
  if (!isRecord(raw)) {
    return "";
  }

  const choices = raw.choices;
  if (Array.isArray(choices) && choices.length > 0 && isRecord(choices[0])) {
    const choice = choices[0];
    const delta = isRecord(choice.delta) ? choice.delta : null;

    if (delta && typeof delta.reasoning_content === "string") {
      return delta.reasoning_content;
    }
    if (typeof choice.reasoning_content === "string") {
      return choice.reasoning_content;
    }
  }

  if (typeof raw.reasoning_content === "string") {
    return raw.reasoning_content;
  }

  return "";
}

function normalizeDataContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function parseStreamDataArgs(args: unknown[]): { content: string; raw: unknown; reasoning: string } {
  const content = normalizeDataContent(args[0]);
  const raw = args.length > 1 ? args[1] : null;
  const reasoningArg = args.length > 2 ? args[2] : null;

  return {
    content,
    raw,
    reasoning: typeof reasoningArg === "string" ? reasoningArg : extractReasoningFromRaw(raw),
  };
}

function createReasoningTracker(
  flow: ReasoningFlow,
  input: NormalizedTalkInput,
  requestId: string
): ReasoningTracker {
  return {
    flow,
    requestId,
    conversationId: input.conversationId,
    userId: input.userId,
    chunkCount: 0,
    totalLength: 0,
    firstChunkIndex: null,
    firstChunkAt: null,
    visibleChunkCount: 0,
    visibleLength: 0,
    dataEventCount: 0,
    snippets: [],
  };
}

function trackReasoningEvent(
  tracker: ReasoningTracker,
  payload: { content: string; reasoning: string }
): void {
  tracker.dataEventCount += 1;

  if (payload.content.length > 0) {
    tracker.visibleChunkCount += 1;
    tracker.visibleLength += payload.content.length;
  }

  if (payload.reasoning.length === 0) {
    return;
  }

  tracker.chunkCount += 1;
  tracker.totalLength += payload.reasoning.length;

  if (tracker.firstChunkIndex === null) {
    tracker.firstChunkIndex = tracker.dataEventCount;
    tracker.firstChunkAt = Date.now();
    logTalkInfo("reasoning tracker first chunk", {
      flow: tracker.flow,
      requestId: tracker.requestId,
      conversationId: tracker.conversationId,
      userId: tracker.userId,
      firstChunkIndex: tracker.firstChunkIndex,
      firstChunkLength: payload.reasoning.length,
      observability: {
        kind: "node",
        requestId: tracker.requestId,
        eventType: "reasoning.first-chunk",
      },
    });
  }

  if (tracker.snippets.length < 3) {
    tracker.snippets.push(payload.reasoning.slice(0, 120));
  }
}

function flushReasoningTracker(tracker: ReasoningTracker, outcome: "end" | "error" | "abort"): void {
  logTalkInfo("reasoning tracker summary", {
    flow: tracker.flow,
    requestId: tracker.requestId,
    outcome,
    conversationId: tracker.conversationId,
    userId: tracker.userId,
    dataEventCount: tracker.dataEventCount,
    reasoningChunkCount: tracker.chunkCount,
    reasoningLength: tracker.totalLength,
    firstChunkIndex: tracker.firstChunkIndex,
    firstChunkAt: tracker.firstChunkAt,
    visibleChunkCount: tracker.visibleChunkCount,
    visibleLength: tracker.visibleLength,
    snippetCount: tracker.snippets.length,
    observability: {
      kind: "node",
      requestId: tracker.requestId,
      eventType: "reasoning.summary",
      outcome:
        outcome === "end"
          ? "success"
          : outcome === "error"
            ? "error"
            : "abort",
    },
  });

  if (tracker.snippets.length > 0) {
    logTalkRaw("reasoning tracker snippets", tracker.requestId, "reasoning.snippets", {
      flow: tracker.flow,
      snippetCount: tracker.snippets.length,
      snippets: tracker.snippets.map((snippet) => summarizeText(snippet, 120)),
    });
  }
}

function assertLocalMethod(method: unknown, operation: string): void {
  if (method !== METHOD_LOCAL) {
    throw new Error(`${operation} requires method="local"`);
  }
}

function ensureOnline(): void {
  if (!runtime.online) {
    throw new Error("talk-engine local strategy is not online");
  }
}

function resolveProvider(capabilityId: string): unknown {
  logTalkInfo("resolve provider begin", {
    action: "provider.resolve.begin",
    capabilityId,
  });
  const provider = capabilityRegistry.resolve(capabilityId);
  logTalkInfo("resolve provider complete", {
    action: "provider.resolve.complete",
    capabilityId,
    result: "ok",
  });
  return provider;
}

function resolveLlmProvider(): LlmChatStreamProvider {
  const provider = resolveProvider(CAPABILITY_LLM_CHAT_STREAM) as LlmChatStreamProvider;
  if (!provider || typeof provider.streamChat !== "function") {
    throw new Error(`capability provider is invalid: ${CAPABILITY_LLM_CHAT_STREAM}`);
  }
  return provider;
}

function resolveDiscordConversationProvider(): DiscordConversationProvider {
  const provider = resolveProvider(CAPABILITY_DISCORD_STREAM) as DiscordConversationProvider;
  if (!provider || typeof provider.openConversationStream !== "function") {
    throw new Error(`capability provider is invalid: ${CAPABILITY_DISCORD_STREAM}`);
  }
  return provider;
}

function resolveDiscordSendProvider(): DiscordMessageSendProvider {
  const provider = resolveProvider(CAPABILITY_DISCORD_SEND) as DiscordMessageSendProvider;
  if (!provider || typeof provider.sendMessage !== "function") {
    throw new Error(`capability provider is invalid: ${CAPABILITY_DISCORD_SEND}`);
  }
  return provider;
}

function resolveDiscordTypingStartProvider(): DiscordTypingStartProvider {
  const provider = resolveProvider(CAPABILITY_DISCORD_TYPING_START) as DiscordTypingStartProvider;
  if (!provider || typeof provider.startTyping !== "function") {
    throw new Error(`capability provider is invalid: ${CAPABILITY_DISCORD_TYPING_START}`);
  }
  return provider;
}

function resolveDiscordTypingStopProvider(): DiscordTypingStopProvider {
  const provider = resolveProvider(CAPABILITY_DISCORD_TYPING_STOP) as DiscordTypingStopProvider;
  if (!provider || typeof provider.stopTyping !== "function") {
    throw new Error(`capability provider is invalid: ${CAPABILITY_DISCORD_TYPING_STOP}`);
  }
  return provider;
}

function resolveHistoryAppendProvider(): ConversationHistoryAppendProvider {
  const provider = resolveProvider(CAPABILITY_CONVERSATION_HISTORY_APPEND) as ConversationHistoryAppendProvider;
  if (!provider || typeof provider.appendMessage !== "function") {
    throw new Error(`capability provider is invalid: ${CAPABILITY_CONVERSATION_HISTORY_APPEND}`);
  }
  return provider;
}

function resolveHistoryRecentProvider(): ConversationHistoryRecentProvider {
  const provider = resolveProvider(CAPABILITY_CONVERSATION_HISTORY_RECENT) as ConversationHistoryRecentProvider;
  if (!provider || typeof provider.getRecentMessages !== "function") {
    throw new Error(`capability provider is invalid: ${CAPABILITY_CONVERSATION_HISTORY_RECENT}`);
  }
  return provider;
}

function assertLlmStream(value: unknown): LlmStreamEmitter {
  if (!value || typeof value !== "object" || typeof (value as { on?: unknown }).on !== "function") {
    throw new Error("llm gateway did not return a valid EventEmitter");
  }
  return value as LlmStreamEmitter;
}

function assertDiscordConversationStream(value: unknown): DiscordConversationStream {
  if (!value || typeof value !== "object" || typeof (value as { on?: unknown }).on !== "function") {
    throw new Error("discord conversation provider did not return a valid EventEmitter");
  }
  return value as DiscordConversationStream;
}

type TalkHistoryScope = {
  conversationId?: string;
  userId?: string;
};

function resolveHistoryScope(input: NormalizedTalkInput): TalkHistoryScope | null {
  const scope: TalkHistoryScope = {};
  if (input.conversationId) {
    scope.conversationId = input.conversationId;
  }
  if (input.userId) {
    scope.userId = input.userId;
  }

  if (!scope.conversationId && !scope.userId) {
    logTalkInfo("resolve history scope skipped", {
      action: "history.scope.resolve",
      result: "none",
    });
    return null;
  }

  logTalkInfo("resolve history scope complete", {
    action: "history.scope.resolve",
    result: "ok",
    conversationId: scope.conversationId ?? null,
    userId: scope.userId ?? null,
  });
  return scope;
}

function getHistoryLimit(input: NormalizedTalkInput): number {
  const limit = input.historyLimit ?? DEFAULT_HISTORY_LIMIT;
  logTalkInfo("resolve history limit", {
    action: "history.limit.resolve",
    historyLimit: limit,
  });
  return limit;
}

async function loadHistoryForPrompt(input: NormalizedTalkInput): Promise<HistoryPromptMessage[]> {
  const scope = resolveHistoryScope(input);
  if (!scope) {
    return [];
  }

  const provider = resolveHistoryRecentProvider();
  const limit = getHistoryLimit(input);
  const beginAt = Date.now();
  logTalkInfo("history recent load begin", {
    action: "history.load.begin",
    conversationId: scope.conversationId ?? null,
    userId: scope.userId ?? null,
    historyLimit: limit,
  });
  const loaded = await provider.getRecentMessages(scope, limit);
  if (!Array.isArray(loaded)) {
    logTalkInfo("history recent load returned non-array; fallback empty", {
      action: "history.load.complete",
      conversationId: scope.conversationId ?? null,
      userId: scope.userId ?? null,
      result: "non-array",
      durationMs: Date.now() - beginAt,
    });
    return [];
  }

  const historyMessages: HistoryPromptMessage[] = [];
  for (const message of loaded) {
    if (!message || typeof message !== "object") {
      continue;
    }

    const role = (message as { role?: unknown }).role;
    const content = (message as { content?: unknown }).content;
    const timestamp = (message as { timestamp?: unknown }).timestamp;
    if (
      (role === "system" || role === "user" || role === "assistant" || role === "tool")
      && typeof content === "string"
      && content.length > 0
      && typeof timestamp === "number"
      && Number.isFinite(timestamp)
    ) {
      historyMessages.push({
        role,
        content,
        timestamp,
      });
    }
  }

  logTalkInfo("history recent load complete", {
    action: "history.load.complete",
    conversationId: scope.conversationId ?? null,
    userId: scope.userId ?? null,
    result: "ok",
    loadedCount: loaded.length,
    normalizedCount: historyMessages.length,
    durationMs: Date.now() - beginAt,
  });
  return historyMessages;
}

async function appendHistoryMessage(
  scope: TalkHistoryScope | null,
  role: "system" | "user" | "assistant" | "tool",
  content: string
): Promise<void> {
  if (!scope || content.length === 0) {
    logTalkInfo("history append skipped", {
      action: "history.append.skip",
      conversationId: scope?.conversationId ?? null,
      userId: scope?.userId ?? null,
      role,
      contentLength: content.length,
    });
    return;
  }

  const provider = resolveHistoryAppendProvider();
  const beginAt = Date.now();
  const requestId = createObservabilityRequestId("talk-engine:history-append", {
    conversationId: scope.conversationId ?? null,
    userId: scope.userId ?? null,
  });
  logTalkInfo("history append begin", {
    action: "history.append.begin",
    requestId,
    conversationId: scope.conversationId ?? null,
    userId: scope.userId ?? null,
    role,
    contentSummary: summarizeText(content),
    observability: {
      kind: "node",
      requestId,
      eventType: "history.append.begin",
    },
  });
  logTalkRaw("history append raw content", requestId, "history.append.content", {
    role,
    content,
  });
  await provider.appendMessage({
    ...scope,
    role,
    content,
  });
  logTalkInfo("history append complete", {
    action: "history.append.complete",
    requestId,
    conversationId: scope.conversationId ?? null,
    userId: scope.userId ?? null,
    role,
    result: "ok",
    durationMs: Date.now() - beginAt,
    observability: {
      kind: "node",
      requestId,
      eventType: "history.append.complete",
      outcome: "success",
    },
  });
}

async function loadHistoryForPromptSafe(input: NormalizedTalkInput): Promise<HistoryPromptMessage[]> {
  const scope = resolveHistoryScope(input);
  if (!scope) {
    return [];
  }

  try {
    return await loadHistoryForPrompt(input);
  } catch (error) {
    logger.warn("history recent load failed, continue without history", {
      stage: "talk-engine",
      observability: {
        kind: "node",
        eventType: "history.load.safe-fallback",
      },
      conversationId: scope.conversationId,
      userId: scope.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    logTalkInfo("history recent load safe fallback", {
      action: "history.load.safe-fallback",
      conversationId: scope.conversationId ?? null,
      userId: scope.userId ?? null,
      result: "fallback-empty",
    });
    return [];
  }
}

async function appendHistoryMessageSafe(
  scope: TalkHistoryScope | null,
  role: "system" | "user" | "assistant" | "tool",
  content: string
): Promise<void> {
  if (!scope || content.length === 0) {
    return;
  }

  try {
    await appendHistoryMessage(scope, role, content);
  } catch (error) {
    logger.warn("history append failed", {
      stage: "talk-engine",
      observability: {
        kind: "node",
        eventType: "history.append.safe-fallback",
      },
      conversationId: scope.conversationId,
      userId: scope.userId,
      role,
      error: error instanceof Error ? error.message : String(error),
    });
    logTalkInfo("history append safe fallback", {
      action: "history.append.safe-fallback",
      conversationId: scope.conversationId ?? null,
      userId: scope.userId ?? null,
      role,
      result: "ignored",
    });
  }
}

function createHistoryAwareStream(
  sourceStream: LlmStreamEmitter,
  input: NormalizedTalkInput,
  requestId: string
): LlmStreamEmitter {
  logTalkInfo("create history aware stream begin", {
    action: "stream.wrap.begin",
    requestId,
    input: summarizeNormalizedInput(input),
    observability: {
      kind: "node",
      requestId,
      eventType: "stream.wrap.begin",
    },
  });
  const wrapped = new EventEmitter() as LlmStreamEmitter;
  const scope = resolveHistoryScope(input);
  const chunks: string[] = [];
  const reasoningTracker = createReasoningTracker("stream", input, requestId);
  let reasoningFlushed = false;
  let ended = false;
  let aborted = false;

  const flushTrackerOnce = (outcome: "end" | "error" | "abort"): void => {
    if (reasoningFlushed) {
      return;
    }
    reasoningFlushed = true;
    flushReasoningTracker(reasoningTracker, outcome);
  };

  const cleanup = (): void => {
    sourceStream.off("data", onData);
    sourceStream.off("error", onError);
    sourceStream.off("end", onEnd);
    sourceStream.off("abort", onAbort);
  };

  const onData = (...args: unknown[]): void => {
    const parsed = parseStreamDataArgs(args);
    trackReasoningEvent(reasoningTracker, {
      content: parsed.content,
      reasoning: parsed.reasoning,
    });

    if (parsed.content.length > 0) {
      chunks.push(parsed.content);
      logTalkRaw("stream wrapped data", requestId, "stream.wrap.data", {
        conversationId: input.conversationId,
        userId: input.userId,
        chunk: parsed.content,
        chunkSummary: summarizeText(parsed.content),
        chunkLength: parsed.content.length,
        reasoningLength: parsed.reasoning.length,
      });
      wrapped.emit("data", parsed.content, parsed.raw, parsed.reasoning || null);
    }
  };

  const onError = (error: unknown): void => {
    if (ended) {
      return;
    }
    ended = true;
    cleanup();
    flushTrackerOnce("error");
    logTalkInfo("stream wrapped error", {
      action: "stream.wrap.error",
      requestId,
      conversationId: input.conversationId,
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
      collectedChunkCount: chunks.length,
      observability: {
        kind: "node",
        requestId,
        eventType: "stream.wrap.complete",
        outcome: "error",
      },
    });
    wrapped.emit("error", error);
  };

  const onAbort = (): void => {
    if (ended) {
      return;
    }
    ended = true;
    aborted = true;
    cleanup();
    flushTrackerOnce("abort");
    logTalkInfo("stream wrapped abort", {
      action: "stream.wrap.abort",
      requestId,
      conversationId: input.conversationId,
      userId: input.userId,
      collectedChunkCount: chunks.length,
      observability: {
        kind: "node",
        requestId,
        eventType: "stream.wrap.complete",
        outcome: "abort",
      },
    });
    wrapped.emit("abort");
  };

  const onEnd = (): void => {
    if (ended) {
      return;
    }
    ended = true;
    cleanup();
    flushTrackerOnce("end");
    const collectedContent = chunks.join("");
    logTalkInfo("stream wrapped end", {
      action: "stream.wrap.end",
      requestId,
      conversationId: input.conversationId,
      userId: input.userId,
      collectedChunkCount: chunks.length,
      collectedContent: summarizeText(collectedContent),
      observability: {
        kind: "node",
        requestId,
        eventType: "stream.wrap.complete",
        outcome: "success",
      },
    });
    logTalkRaw("stream wrapped end raw content", requestId, "stream.wrap.end.content", {
      collectedContent,
    });
    void appendHistoryMessageSafe(scope, "assistant", collectedContent).finally(() => {
      if (!aborted) {
        wrapped.emit("end");
      }
    });
  };

  sourceStream.on("data", onData);
  sourceStream.on("error", onError);
  sourceStream.on("end", onEnd);
  sourceStream.on("abort", onAbort);

  wrapped.abort = (): void => {
    if (sourceStream.abort) {
      logTalkInfo("stream wrapped abort forwarded", {
        action: "stream.wrap.abort.forward",
        requestId,
        conversationId: input.conversationId,
        userId: input.userId,
        observability: {
          kind: "node",
          requestId,
          eventType: "stream.wrap.abort.forward",
        },
      });
      sourceStream.abort();
      return;
    }

    onAbort();
  };

  return wrapped;
}

async function executeNoStreamWithHistory(
  input: NormalizedTalkInput,
  requestId: string
): Promise<TalkNoStreamResult> {
  const beginAt = Date.now();
  logTalkInfo("nostream with history begin", {
    action: "nostream-with-history.begin",
    requestId,
    input: summarizeNormalizedInput(input),
    observability: {
      kind: "node",
      requestId,
      eventType: "nostream.begin",
    },
  });
  const scope = resolveHistoryScope(input);
  const historyMessages = await loadHistoryForPromptSafe(input);
  const userContent = composePromptContent(input);
  logTalkInfo("nostream prompt prepared", {
    action: "nostream-with-history.prompt",
    requestId,
    conversationId: scope?.conversationId ?? null,
    userId: scope?.userId ?? null,
    userContent: summarizeText(userContent),
    historyCount: historyMessages.length,
    observability: {
      kind: "node",
      requestId,
      eventType: "nostream.prompt",
    },
  });
  logTalkRaw("nostream prompt raw content", requestId, "nostream.prompt.content", {
    userContent,
  });
  await appendHistoryMessageSafe(scope, "user", userContent);

  const response = await executeNoStream(input, historyMessages, requestId);
  await appendHistoryMessageSafe(scope, "assistant", response.reply);
  logTalkInfo("nostream with history complete", {
    action: "nostream-with-history.complete",
    requestId,
    conversationId: scope?.conversationId ?? null,
    userId: scope?.userId ?? null,
    reply: summarizeText(response.reply),
    durationMs: Date.now() - beginAt,
    observability: {
      kind: "node",
      requestId,
      eventType: "nostream.complete",
      outcome: "success",
    },
  });
  logTalkRaw("nostream reply raw content", requestId, "nostream.reply", {
    reply: response.reply,
  });
  return response;
}

async function requestStreamWithHistory(
  input: NormalizedTalkInput,
  requestId: string
): Promise<LlmStreamEmitter> {
  const beginAt = Date.now();
  logTalkInfo("stream with history begin", {
    action: "stream-with-history.begin",
    requestId,
    input: summarizeNormalizedInput(input),
    observability: {
      kind: "node",
      requestId,
      eventType: "stream.begin",
    },
  });
  const scope = resolveHistoryScope(input);
  const historyMessages = await loadHistoryForPromptSafe(input);
  const userContent = composePromptContent(input);
  logTalkInfo("stream prompt prepared", {
    action: "stream-with-history.prompt",
    requestId,
    conversationId: scope?.conversationId ?? null,
    userId: scope?.userId ?? null,
    userContent: summarizeText(userContent),
    historyCount: historyMessages.length,
    observability: {
      kind: "node",
      requestId,
      eventType: "stream.prompt",
    },
  });
  logTalkRaw("stream prompt raw content", requestId, "stream.prompt.content", {
    userContent,
  });
  await appendHistoryMessageSafe(scope, "user", userContent);

  const source = await requestTalkStream(input, historyMessages, requestId);
  logTalkInfo("stream with history source ready", {
    action: "stream-with-history.source",
    requestId,
    conversationId: scope?.conversationId ?? null,
    userId: scope?.userId ?? null,
    durationMs: Date.now() - beginAt,
    observability: {
      kind: "node",
      requestId,
      eventType: "stream.source-ready",
    },
  });
  return createHistoryAwareStream(source, input, requestId);
}

async function requestTalkStream(
  input: NormalizedTalkInput,
  promptMessages?: HistoryPromptMessage[],
  requestId?: string
): Promise<LlmStreamEmitter> {
  const beginAt = Date.now();
  const resolvedRequestId = requestId ?? resolveTalkRequestId(input, "request-stream");
  logTalkInfo("request talk stream begin", {
    action: "request-talk-stream.begin",
    requestId: resolvedRequestId,
    input: summarizeNormalizedInput(input),
    promptMessagesCount: promptMessages?.length ?? 0,
    observability: {
      kind: "node",
      requestId: resolvedRequestId,
      eventType: "request-stream.begin",
    },
  });
  const llmProvider = resolveLlmProvider();
  const payload = buildGatewayPayload(
    input,
    composePromptMessages({
      message: input.message,
      talker: input.talker,
      historyMessages: promptMessages,
    })
  );
  logTalkInfo("request talk stream payload built", {
    action: "request-talk-stream.payload",
    requestId: resolvedRequestId,
    payloadSummary: summarizeUnknown(payload),
    observability: {
      kind: "node",
      requestId: resolvedRequestId,
      eventType: "request-stream.payload",
    },
  });
  logTalkRaw("request talk stream raw payload", resolvedRequestId, "request-stream.payload.raw", {
    payload,
  });
  const stream = await llmProvider.streamChat(payload);
  logTalkInfo("request talk stream complete", {
    action: "request-talk-stream.complete",
    requestId: resolvedRequestId,
    durationMs: Date.now() - beginAt,
    result: "ok",
    observability: {
      kind: "node",
      requestId: resolvedRequestId,
      eventType: "request-stream.complete",
    },
  });
  return assertLlmStream(stream);
}

async function executeNoStream(
  input: NormalizedTalkInput,
  promptMessages?: HistoryPromptMessage[],
  requestId?: string
): Promise<TalkNoStreamResult> {
  const beginAt = Date.now();
  const resolvedRequestId = requestId ?? resolveTalkRequestId(input, "nostream");
  logTalkInfo("execute nostream begin", {
    action: "execute-nostream.begin",
    requestId: resolvedRequestId,
    input: summarizeNormalizedInput(input),
    promptMessagesCount: promptMessages?.length ?? 0,
    observability: {
      kind: "node",
      requestId: resolvedRequestId,
      eventType: "execute-nostream.begin",
    },
  });
  const stream = await requestTalkStream(input, promptMessages, resolvedRequestId);
  const reasoningTracker = createReasoningTracker("nostream", input, resolvedRequestId);

  try {
    const reply = await collectStreamReply(stream, {
      onChunk: (chunk) => {
        trackReasoningEvent(reasoningTracker, {
          content: chunk.content,
          reasoning: chunk.reasoning,
        });
      },
    });
    flushReasoningTracker(reasoningTracker, "end");
    const normalizedReply = normalizeAssistantReply(reply);
    logTalkInfo("execute nostream complete", {
      action: "execute-nostream.complete",
      requestId: resolvedRequestId,
      reply: summarizeText(normalizedReply),
      durationMs: Date.now() - beginAt,
      result: "ok",
      observability: {
        kind: "node",
        requestId: resolvedRequestId,
        eventType: "execute-nostream.complete",
        outcome: "success",
      },
    });
    logTalkRaw("execute nostream raw reply", resolvedRequestId, "execute-nostream.reply.raw", {
      reply: normalizedReply,
    });
    return { reply: normalizedReply };
  } catch (error) {
    flushReasoningTracker(reasoningTracker, "error");
    logTalkInfo("execute nostream failed", {
      action: "execute-nostream.error",
      requestId: resolvedRequestId,
      durationMs: Date.now() - beginAt,
      result: "failed",
      error: error instanceof Error ? error.message : String(error),
      observability: {
        kind: "node",
        requestId: resolvedRequestId,
        eventType: "execute-nostream.complete",
        outcome: "error",
      },
    });
    throw error;
  }
}

async function sendDiscordMessage(channelId: string, message: string, requestId: string): Promise<void> {
  logTalkInfo("relay send message begin", {
    action: "relay.send.begin",
    requestId,
    channelId,
    message: summarizeText(message),
    observability: {
      kind: "node",
      requestId,
      eventType: "relay.send.begin",
    },
  });
  logTalkRaw("relay send message raw content", requestId, "relay.send.message.raw", {
    channelId,
    message,
  });
  const provider = resolveDiscordSendProvider();
  await provider.sendMessage({
    channelId,
    message,
  });
  logTalkInfo("relay send message complete", {
    action: "relay.send.complete",
    requestId,
    channelId,
    result: "ok",
    observability: {
      kind: "node",
      requestId,
      eventType: "relay.send.complete",
    },
  });
}

async function startDiscordTyping(channelId: string, requestId: string): Promise<void> {
  logTalkInfo("relay typing start begin", {
    action: "relay.typing-start.begin",
    requestId,
    channelId,
    observability: {
      kind: "node",
      requestId,
      eventType: "relay.typing-start.begin",
    },
  });
  const provider = resolveDiscordTypingStartProvider();
  await provider.startTyping({
    channelId,
  });
  logTalkInfo("relay typing start complete", {
    action: "relay.typing-start.complete",
    requestId,
    channelId,
    result: "ok",
    observability: {
      kind: "node",
      requestId,
      eventType: "relay.typing-start.complete",
    },
  });
}

async function stopDiscordTyping(channelId: string, requestId: string): Promise<void> {
  logTalkInfo("relay typing stop begin", {
    action: "relay.typing-stop.begin",
    requestId,
    channelId,
    observability: {
      kind: "node",
      requestId,
      eventType: "relay.typing-stop.begin",
    },
  });
  const provider = resolveDiscordTypingStopProvider();
  await provider.stopTyping({
    channelId,
  });
  logTalkInfo("relay typing stop complete", {
    action: "relay.typing-stop.complete",
    requestId,
    channelId,
    result: "ok",
    observability: {
      kind: "node",
      requestId,
      eventType: "relay.typing-stop.complete",
    },
  });
}

async function handleRelayEvent(event: DiscordConversationEvent): Promise<void> {
  const beginAt = Date.now();
  const requestId = createObservabilityRequestId("talk-engine:relay-event", {
    requestId: normalizeOptionalString(event?.messageId),
    conversationId: normalizeOptionalString(event?.channelId),
    userId: normalizeOptionalString(event?.author?.id),
  });
  logTalkInfo("relay event begin", {
    action: "relay.event.begin",
    requestId,
    eventSummary: summarizeUnknown(event),
    observability: {
      kind: "node",
      requestId,
      eventType: "relay.event.begin",
    },
  });
  logTalkRaw("relay event raw payload", requestId, "relay.event.payload.raw", {
    event,
  });
  if (!event || typeof event !== "object") {
    return;
  }

  const channelId = normalizeOptionalString(event.channelId);
  if (!channelId) {
    logger.warn("relay event skipped: missing channelId", {
      stage: "talk-engine",
      observability: {
        kind: "node",
        requestId,
        eventType: "relay.event.validate",
      },
    });
    return;
  }

  const content = normalizeOptionalString(event.content);
  if (!content) {
    logger.warn("relay event skipped: missing content", {
      stage: "talk-engine",
      observability: {
        kind: "node",
        requestId,
        eventType: "relay.event.validate",
      },
      channelId,
    });
    return;
  }

  const talker = normalizeOptionalString(event.author?.name);
  const userId = normalizeOptionalString(event.author?.id);
  const normalizedInput: NormalizedTalkInput = {
    action: "talk.nostream",
    message: content,
    talker,
    conversationId: channelId,
    userId,
    historyLimit: DEFAULT_HISTORY_LIMIT,
    params: {},
    reqId: requestId,
  };
  logTalkInfo("relay input normalized", {
    action: "relay.event.normalized-input",
    requestId,
    input: summarizeNormalizedInput(normalizedInput),
    observability: {
      kind: "node",
      requestId,
      eventType: "relay.event.normalized-input",
    },
  });

  await startDiscordTyping(channelId, requestId);

  try {
    const response = await executeNoStreamWithHistory(normalizedInput, requestId);
    await sendDiscordMessage(channelId, response.reply, requestId);
    logTalkInfo("relay event complete", {
      action: "relay.event.complete",
      requestId,
      channelId,
      result: "ok",
      reply: summarizeText(response.reply),
      durationMs: Date.now() - beginAt,
      observability: {
        kind: "node",
        requestId,
        eventType: "relay.event.complete",
        outcome: "success",
      },
    });
    logTalkRaw("relay event raw reply", requestId, "relay.event.reply.raw", {
      reply: response.reply,
    });
  } catch (error) {
    logger.error("relay event processing failed", {
      stage: "talk-engine",
      observability: {
        kind: "node",
        requestId,
        eventType: "relay.event.complete",
        outcome: "error",
      },
      channelId,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      await sendDiscordMessage(channelId, runtime.relay.errorReply, requestId);
      await appendHistoryMessageSafe(resolveHistoryScope(normalizedInput), "assistant", runtime.relay.errorReply);
      logTalkInfo("relay event fallback complete", {
        action: "relay.event.fallback",
        requestId,
        channelId,
        result: "ok",
        fallbackReply: summarizeText(runtime.relay.errorReply),
        observability: {
          kind: "node",
          requestId,
          eventType: "relay.event.fallback",
        },
      });
      logTalkRaw("relay event fallback raw reply", requestId, "relay.event.fallback.reply.raw", {
        fallbackReply: runtime.relay.errorReply,
      });
    } catch (sendError) {
      logger.error("relay fallback reply failed", {
        stage: "talk-engine",
        observability: {
          kind: "node",
          requestId,
          eventType: "relay.event.fallback",
          outcome: "error",
        },
        channelId,
        error: sendError instanceof Error ? sendError.message : String(sendError),
      });
    }
  } finally {
    try {
      await stopDiscordTyping(channelId, requestId);
    } catch (error) {
      logger.warn("relay typing stop failed", {
        stage: "talk-engine",
        observability: {
          kind: "node",
          requestId,
          eventType: "relay.typing-stop.complete",
          outcome: "error",
        },
        channelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    logTalkInfo("relay event finalize", {
      action: "relay.event.finalize",
      requestId,
      channelId,
      durationMs: Date.now() - beginAt,
      observability: {
        kind: "node",
        requestId,
        eventType: "relay.event.finalize",
      },
    });
  }
}

async function setupRelay(): Promise<void> {
  const beginAt = Date.now();
  logTalkInfo("setup relay begin", {
    action: "relay.setup.begin",
  });
  const streamProvider = resolveDiscordConversationProvider();
  const streamResult = await streamProvider.openConversationStream();
  const stream = assertDiscordConversationStream(streamResult);

  const relayQueue = new RelayQueue<DiscordConversationEvent>({
    logger,
    handler: handleRelayEvent,
    onError: (event, error) => {
      logger.error("relay queue handler failed", {
        stage: "talk-engine",
        observability: {
          kind: "node",
          requestId: createObservabilityRequestId("talk-engine:relay-queue", {
            conversationId: normalizeOptionalString(event?.channelId),
            userId: normalizeOptionalString(event?.author?.id),
          }),
          eventType: "relay.queue.error",
          outcome: "error",
        },
        channelId: event?.channelId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const dataListener = (event: DiscordConversationEvent): void => {
    relayQueue.enqueue(event);
  };

  const errorListener = (error: unknown): void => {
    logger.error("discord relay stream error", {
      stage: "talk-engine",
      observability: {
        kind: "node",
        eventType: "relay.stream.error",
        outcome: "error",
      },
      error: error instanceof Error ? error.message : String(error),
    });
  };

  stream.on("data", dataListener);
  stream.on("error", errorListener);

  runtime.relay.stream = stream;
  runtime.relay.dataListener = dataListener;
  runtime.relay.errorListener = errorListener;
  runtime.relayQueue = relayQueue;
  logTalkInfo("setup relay complete", {
    action: "relay.setup.complete",
    result: "ok",
    durationMs: Date.now() - beginAt,
  });
}

async function teardownRelay(): Promise<void> {
  const beginAt = Date.now();
  logTalkInfo("teardown relay begin", {
    action: "relay.teardown.begin",
  });
  const stream = runtime.relay.stream;
  const dataListener = runtime.relay.dataListener;
  const errorListener = runtime.relay.errorListener;

  if (stream && dataListener) {
    stream.off("data", dataListener);
  }
  if (stream && errorListener) {
    stream.off("error", errorListener);
  }

  runtime.relay.stream = null;
  runtime.relay.dataListener = null;
  runtime.relay.errorListener = null;

  if (runtime.relayQueue) {
    await runtime.relayQueue.stop();
    runtime.relayQueue = null;
  }
  logTalkInfo("teardown relay complete", {
    action: "relay.teardown.complete",
    result: "ok",
    durationMs: Date.now() - beginAt,
  });
}

function resolveOnlineConfig(options: StrategyOnlineOptions): { relayEnabled: boolean; relayErrorReply: string } {
  const typed = (isRecord(options) ? options : {}) as TalkOnlineOptions;

  const config = {
    relayEnabled: normalizeBoolean(typed.relayEnabled, DEFAULT_RELAY_ENABLED),
    relayErrorReply: normalizeOptionalString(typed.relayErrorReply) ?? DEFAULT_RELAY_ERROR_REPLY,
  };
  logTalkInfo("resolve online config complete", {
    action: "online-config.resolve",
    config,
  });
  return config;
}

export default {
  method: METHOD_LOCAL,

  async online(options: StrategyOnlineOptions): Promise<void> {
    const beginAt = Date.now();
    logTalkInfo("talk-engine online begin", {
      action: "online.begin",
      options,
    });
    const typedOptions = (isRecord(options) ? options : {}) as TalkOnlineOptions;
    assertLocalMethod(typedOptions.method ?? METHOD_LOCAL, "online");

    if (runtime.online) {
      logTalkInfo("talk-engine online found existing runtime, running offline first", {
        action: "online.pre-offline",
      });
      await this.offline();
    }

    const config = resolveOnlineConfig(options);
    runtime.online = true;
    runtime.relay.enabled = config.relayEnabled;
    runtime.relay.errorReply = config.relayErrorReply;

    try {
      if (runtime.relay.enabled) {
        await setupRelay();
      }

      logger.info("talk-engine online", {
        observability: {
          kind: "node",
          eventType: "online.state",
        },
        relayEnabled: runtime.relay.enabled,
      });
      logTalkInfo("talk-engine online complete", {
        action: "online.complete",
        result: "ok",
        relayEnabled: runtime.relay.enabled,
        durationMs: Date.now() - beginAt,
      });
    } catch (error) {
      logTalkInfo("talk-engine online failed", {
        action: "online.error",
        result: "failed",
        durationMs: Date.now() - beginAt,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.offline();
      throw error;
    }
  },

  async offline(): Promise<void> {
    const beginAt = Date.now();
    logTalkInfo("talk-engine offline begin", {
      action: "offline.begin",
    });
    await teardownRelay();

    runtime.online = false;
    runtime.relay.enabled = DEFAULT_RELAY_ENABLED;
    runtime.relay.errorReply = DEFAULT_RELAY_ERROR_REPLY;

    logger.info("talk-engine offline", {
      stage: "talk-engine",
      observability: {
        kind: "node",
        eventType: "offline.state",
      },
    });
    logTalkInfo("talk-engine offline complete", {
      action: "offline.complete",
      result: "ok",
      durationMs: Date.now() - beginAt,
    });
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    const beginAt = Date.now();
    logTalkInfo("talk-engine restart begin", {
      action: "restart.begin",
      options,
    });
    await this.offline();
    await this.online(options);
    logger.info("talk-engine restarted", {
      stage: "talk-engine",
      observability: {
        kind: "node",
        eventType: "restart.state",
      },
    });
    logTalkInfo("talk-engine restart complete", {
      action: "restart.complete",
      result: "ok",
      durationMs: Date.now() - beginAt,
    });
  },

  async state(): Promise<StateResult> {
    logTalkInfo("talk-engine state begin", {
      action: "state.begin",
      online: runtime.online,
      relayEnabled: runtime.relay.enabled,
      hasRelayQueue: Boolean(runtime.relayQueue),
    });
    if (!runtime.online) {
      logTalkInfo("talk-engine state complete", {
        action: "state.complete",
        status: 0,
      });
      return { status: 0 };
    }
    logTalkInfo("talk-engine state complete", {
      action: "state.complete",
      status: 1,
    });
    return { status: 1 };
  },

  async send(options: SendOptions): Promise<unknown> {
    ensureOnline();
    const beginAt = Date.now();
    logTalkInfo("talk-engine send begin", {
      action: "send.begin",
      optionsSummary: summarizeUnknown(isRecord(options) ? options : { value: options }),
    });

    const input = normalizeTalkInput(options as TalkSendInput);
    const requestId = resolveTalkRequestId(input, "send");
    logTalkInfo("talk-engine send normalized input", {
      action: "send.normalized",
      requestId,
      input: summarizeNormalizedInput(input),
      observability: {
        kind: "node",
        requestId,
        eventType: "send.normalized",
      },
    });
    logTalkRaw("talk-engine send raw options", requestId, "send.options.raw", {
      options: isRecord(options) ? options : { value: options },
    });
    if (input.action === "talk.stream") {
      const result = await this.streamReply(options);
      logTalkInfo("talk-engine send complete", {
        action: "send.complete",
        requestId,
        flow: "stream",
        result: "ok",
        durationMs: Date.now() - beginAt,
        observability: {
          kind: "node",
          requestId,
          eventType: "send.complete",
        },
      });
      return result;
    }

    const result = await this.generateReply(options);
    logTalkInfo("talk-engine send complete", {
      action: "send.complete",
      requestId,
      flow: "nostream",
      result: "ok",
      durationMs: Date.now() - beginAt,
      observability: {
        kind: "node",
        requestId,
        eventType: "send.complete",
      },
    });
    return result;
  },

  async generateReply(options: SendOptions): Promise<TalkNoStreamResult> {
    ensureOnline();
    const beginAt = Date.now();
    logTalkInfo("talk-engine generateReply begin", {
      action: "generate-reply.begin",
      optionsSummary: summarizeUnknown(isRecord(options) ? options : { value: options }),
    });

    const normalizedInput = normalizeTalkInput({
      ...(isRecord(options) ? options : {}),
      action: "talk.nostream",
    });
    const requestId = resolveTalkRequestId(normalizedInput, "generate-reply");
    logTalkInfo("talk-engine generateReply normalized input", {
      action: "generate-reply.normalized",
      requestId,
      input: summarizeNormalizedInput(normalizedInput),
      observability: {
        kind: "node",
        requestId,
        eventType: "generate-reply.normalized",
      },
    });
    logTalkRaw("talk-engine generateReply raw options", requestId, "generate-reply.options.raw", {
      options: isRecord(options) ? options : { value: options },
    });

    const result = await executeNoStreamWithHistory(normalizedInput, requestId);
    logTalkInfo("talk-engine generateReply complete", {
      action: "generate-reply.complete",
      requestId,
      result: "ok",
      reply: summarizeText(result.reply),
      durationMs: Date.now() - beginAt,
      observability: {
        kind: "node",
        requestId,
        eventType: "generate-reply.complete",
        outcome: "success",
      },
    });
    return result;
  },

  async streamReply(options: SendOptions): Promise<LlmStreamEmitter> {
    ensureOnline();
    const beginAt = Date.now();
    logTalkInfo("talk-engine streamReply begin", {
      action: "stream-reply.begin",
      optionsSummary: summarizeUnknown(isRecord(options) ? options : { value: options }),
    });

    const normalizedInput = normalizeTalkInput({
      ...(isRecord(options) ? options : {}),
      action: "talk.stream",
    });
    const requestId = resolveTalkRequestId(normalizedInput, "stream-reply");
    logTalkInfo("talk-engine streamReply normalized input", {
      action: "stream-reply.normalized",
      requestId,
      input: summarizeNormalizedInput(normalizedInput),
      observability: {
        kind: "node",
        requestId,
        eventType: "stream-reply.normalized",
      },
    });
    logTalkRaw("talk-engine streamReply raw options", requestId, "stream-reply.options.raw", {
      options: isRecord(options) ? options : { value: options },
    });

    const stream = await requestStreamWithHistory(normalizedInput, requestId);
    logTalkInfo("talk-engine streamReply complete", {
      action: "stream-reply.complete",
      requestId,
      result: "ok",
      durationMs: Date.now() - beginAt,
      observability: {
        kind: "node",
        requestId,
        eventType: "stream-reply.complete",
      },
    });
    return stream;
  },
};
