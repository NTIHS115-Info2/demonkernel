import type {
  SendOptions,
  StateResult,
  StrategyOnlineOptions,
  StrategyRestartOptions,
} from "../../../../core/plugin-sdk";
import { createKernelLogger } from "../../../../core/logger";
import capabilityRegistry from "../../../../core/registry";

import {
  CAPABILITY_DISCORD_SEND,
  CAPABILITY_DISCORD_STREAM,
  CAPABILITY_DISCORD_TYPING_START,
  CAPABILITY_DISCORD_TYPING_STOP,
  CAPABILITY_LLM_CHAT_STREAM,
  DEFAULT_RELAY_ENABLED,
  DEFAULT_RELAY_ERROR_REPLY,
  METHOD_LOCAL,
} from "./constants";
import { buildGatewayPayload, normalizeTalkInput } from "./input";
import { RelayQueue } from "./relayQueue";
import { collectStreamReply } from "./streamCollector";
import type {
  DiscordConversationEvent,
  DiscordConversationProvider,
  DiscordConversationStream,
  DiscordMessageSendProvider,
  DiscordTypingStartProvider,
  DiscordTypingStopProvider,
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
  return capabilityRegistry.resolve(capabilityId);
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

async function requestTalkStream(input: NormalizedTalkInput): Promise<LlmStreamEmitter> {
  const llmProvider = resolveLlmProvider();
  const payload = buildGatewayPayload(input);
  const stream = await llmProvider.streamChat(payload);
  return assertLlmStream(stream);
}

async function executeNoStream(input: NormalizedTalkInput): Promise<TalkNoStreamResult> {
  const stream = await requestTalkStream(input);
  const reply = await collectStreamReply(stream);
  return { reply };
}

async function sendDiscordMessage(channelId: string, message: string): Promise<void> {
  const provider = resolveDiscordSendProvider();
  await provider.sendMessage({
    channelId,
    message,
  });
}

async function startDiscordTyping(channelId: string): Promise<void> {
  const provider = resolveDiscordTypingStartProvider();
  await provider.startTyping({
    channelId,
  });
}

async function stopDiscordTyping(channelId: string): Promise<void> {
  const provider = resolveDiscordTypingStopProvider();
  await provider.stopTyping({
    channelId,
  });
}

async function handleRelayEvent(event: DiscordConversationEvent): Promise<void> {
  if (!event || typeof event !== "object") {
    return;
  }

  const channelId = normalizeOptionalString(event.channelId);
  if (!channelId) {
    logger.warn("relay event skipped: missing channelId");
    return;
  }

  const content = normalizeOptionalString(event.content);
  if (!content) {
    logger.warn("relay event skipped: missing content", { channelId });
    return;
  }

  const talker = normalizeOptionalString(event.author?.name);
  const normalizedInput: NormalizedTalkInput = {
    action: "talk.nostream",
    message: content,
    talker,
    params: {},
  };

  await startDiscordTyping(channelId);

  try {
    const response = await executeNoStream(normalizedInput);
    await sendDiscordMessage(channelId, response.reply || " ");
  } catch (error) {
    logger.error("relay event processing failed", {
      channelId,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      await sendDiscordMessage(channelId, runtime.relay.errorReply);
    } catch (sendError) {
      logger.error("relay fallback reply failed", {
        channelId,
        error: sendError instanceof Error ? sendError.message : String(sendError),
      });
    }
  } finally {
    try {
      await stopDiscordTyping(channelId);
    } catch (error) {
      logger.warn("relay typing stop failed", {
        channelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function setupRelay(): Promise<void> {
  const streamProvider = resolveDiscordConversationProvider();
  const streamResult = await streamProvider.openConversationStream();
  const stream = assertDiscordConversationStream(streamResult);

  const relayQueue = new RelayQueue<DiscordConversationEvent>({
    handler: handleRelayEvent,
    onError: (event, error) => {
      logger.error("relay queue handler failed", {
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
      error: error instanceof Error ? error.message : String(error),
    });
  };

  stream.on("data", dataListener);
  stream.on("error", errorListener);

  runtime.relay.stream = stream;
  runtime.relay.dataListener = dataListener;
  runtime.relay.errorListener = errorListener;
  runtime.relayQueue = relayQueue;
}

async function teardownRelay(): Promise<void> {
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
}

function resolveOnlineConfig(options: StrategyOnlineOptions): { relayEnabled: boolean; relayErrorReply: string } {
  const typed = (isRecord(options) ? options : {}) as TalkOnlineOptions;

  return {
    relayEnabled: normalizeBoolean(typed.relayEnabled, DEFAULT_RELAY_ENABLED),
    relayErrorReply: normalizeOptionalString(typed.relayErrorReply) ?? DEFAULT_RELAY_ERROR_REPLY,
  };
}

export default {
  method: METHOD_LOCAL,

  async online(options: StrategyOnlineOptions): Promise<void> {
    const typedOptions = (isRecord(options) ? options : {}) as TalkOnlineOptions;
    assertLocalMethod(typedOptions.method ?? METHOD_LOCAL, "online");

    if (runtime.online) {
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
        relayEnabled: runtime.relay.enabled,
      });
    } catch (error) {
      await this.offline();
      throw error;
    }
  },

  async offline(): Promise<void> {
    await teardownRelay();

    runtime.online = false;
    runtime.relay.enabled = DEFAULT_RELAY_ENABLED;
    runtime.relay.errorReply = DEFAULT_RELAY_ERROR_REPLY;

    logger.info("talk-engine offline");
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    await this.offline();
    await this.online(options);
    logger.info("talk-engine restarted");
  },

  async state(): Promise<StateResult> {
    if (!runtime.online) {
      return { status: 0 };
    }
    return { status: 1 };
  },

  async send(options: SendOptions): Promise<unknown> {
    ensureOnline();

    const input = normalizeTalkInput(options as TalkSendInput);
    if (input.action === "talk.stream") {
      return this.streamReply(options);
    }

    return this.generateReply(options);
  },

  async generateReply(options: SendOptions): Promise<TalkNoStreamResult> {
    ensureOnline();

    const normalizedInput = normalizeTalkInput({
      ...(isRecord(options) ? options : {}),
      action: "talk.nostream",
    });

    return executeNoStream(normalizedInput);
  },

  async streamReply(options: SendOptions): Promise<LlmStreamEmitter> {
    ensureOnline();

    const normalizedInput = normalizeTalkInput({
      ...(isRecord(options) ? options : {}),
      action: "talk.stream",
    });

    return requestTalkStream(normalizedInput);
  },
};
