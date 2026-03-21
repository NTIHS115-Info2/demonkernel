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
  DiscordConversationStream,
  LlmStreamEmitter,
  NormalizedTalkInput,
  RelayRuntime,
  TalkNoStreamResult,
  TalkOnlineOptions,
  TalkSendInput,
} from "./types";

type CapabilityProvider = {
  send(input: SendOptions): Promise<unknown>;
};

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

function resolveProvider(capabilityId: string): CapabilityProvider {
  const provider = capabilityRegistry.resolve(capabilityId) as CapabilityProvider;
  if (!provider || typeof provider.send !== "function") {
    throw new Error(`capability provider is invalid: ${capabilityId}`);
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
  const llmProvider = resolveProvider(CAPABILITY_LLM_CHAT_STREAM);
  const payload = buildGatewayPayload(input);
  const stream = await llmProvider.send(payload as SendOptions);
  return assertLlmStream(stream);
}

async function executeNoStream(input: NormalizedTalkInput): Promise<TalkNoStreamResult> {
  const stream = await requestTalkStream(input);
  const reply = await collectStreamReply(stream);
  return { reply };
}

async function sendDiscordMessage(channelId: string, message: string): Promise<void> {
  const provider = resolveProvider(CAPABILITY_DISCORD_SEND);
  await provider.send({
    action: "system.discord.message.send",
    channelId,
    message,
  });
}

async function startDiscordTyping(channelId: string): Promise<void> {
  const provider = resolveProvider(CAPABILITY_DISCORD_TYPING_START);
  await provider.send({
    action: "system.discord.typing.start",
    channelId,
  });
}

async function stopDiscordTyping(channelId: string): Promise<void> {
  const provider = resolveProvider(CAPABILITY_DISCORD_TYPING_STOP);
  await provider.send({
    action: "system.discord.typing.stop",
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
  const streamProvider = resolveProvider(CAPABILITY_DISCORD_STREAM);
  const streamResult = await streamProvider.send({
    action: "system.discord.conversation.stream",
  });
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
      return requestTalkStream(input);
    }

    return executeNoStream(input);
  },
};

