import { EventEmitter } from "node:events";

import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
} from "discord.js";

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
import secretsManager, { SECRET_KEYS } from "../../../../core/secrets";

import { TypingSessionManager } from "./typingSessionManager";
import type {
  DiscordConversationEvent,
  DiscordConversationSource,
  DiscordConversationStream,
  DiscordMessageSendResult,
  DiscordTypingControlResult,
} from "./types";

type LocalOnlineOptions = StrategyOnlineOptions & {
  method?: "local";
  channelId?: unknown;
  ownerUserId?: unknown;
  nonOwnerDmReply?: unknown;
  typingIntervalMs?: unknown;
};

type LocalRuntime = {
  client: Client | null;
  messageListener: ((message: Message) => Promise<void>) | null;
  online: boolean;
  channelId: string | null;
  ownerUserId: string | null;
  nonOwnerDmReply: string;
  typingIntervalMs: number;
  typingSessionManager: TypingSessionManager | null;
};

const METHOD_LOCAL = "local" as const;
const ACTION_CONVERSATION_STREAM = "conversation.stream";
const ACTION_CONVERSATION_STREAM_CAPABILITY = "system.discord.conversation.stream";
const ACTION_MESSAGE_SEND = "message.send";
const ACTION_MESSAGE_SEND_CAPABILITY = "system.discord.message.send";
const ACTION_TYPING_START = "typing.start";
const ACTION_TYPING_START_CAPABILITY = "system.discord.typing.start";
const ACTION_TYPING_STOP = "typing.stop";
const ACTION_TYPING_STOP_CAPABILITY = "system.discord.typing.stop";

const DEFAULT_NON_OWNER_DM_REPLY = "我還學不會跟別人說話";
const DEFAULT_TYPING_INTERVAL_MS = 9000;

const logger = createKernelLogger("plugin-discord-local", {
  plugin: "discord",
  type: "system",
  strategy: "local",
});

function logDiscordInfo(message: string, meta: Record<string, unknown> = {}): void {
  const hasObservability = isRecord(meta.observability);
  logger.info(
    message,
    withObservability(
      {
        stage: "discord",
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

function logDiscordRaw(
  message: string,
  requestId: string,
  eventType: string,
  meta: Record<string, unknown> = {}
): void {
  logger.info(
    message,
    withObservability(
      {
        stage: "discord",
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

const conversationStream = new EventEmitter() as DiscordConversationStream;
conversationStream.setMaxListeners(0);

let runtime: LocalRuntime = {
  client: null,
  messageListener: null,
  online: false,
  channelId: null,
  ownerUserId: null,
  nonOwnerDmReply: DEFAULT_NON_OWNER_DM_REPLY,
  typingIntervalMs: DEFAULT_TYPING_INTERVAL_MS,
  typingSessionManager: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function normalizeChannelId(value: unknown): string | null {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }

  return normalized.toLowerCase() === "global" ? null : normalized;
}

function resolveOwnerUserId(options: LocalOnlineOptions): string | null {
  const fromOptions = normalizeOptionalString(options.ownerUserId);
  if (fromOptions) {
    return fromOptions;
  }

  return normalizeOptionalString(secretsManager.tryGet(SECRET_KEYS.DISCORD_USER_ID));
}

function resolveChannelId(options: LocalOnlineOptions): string | null {
  if ("channelId" in options) {
    return normalizeChannelId(options.channelId);
  }

  return normalizeChannelId(secretsManager.tryGet(SECRET_KEYS.DISCORD_CHANNEL_ID));
}

function resolveNonOwnerDmReply(options: LocalOnlineOptions): string {
  const fromOptions = normalizeOptionalString(options.nonOwnerDmReply);
  return fromOptions ?? DEFAULT_NON_OWNER_DM_REPLY;
}

function resolveTypingIntervalMs(options: LocalOnlineOptions): number {
  return normalizePositiveNumber(options.typingIntervalMs, DEFAULT_TYPING_INTERVAL_MS);
}

function isDirectMessage(message: Message): boolean {
  return !message.guildId;
}

function isReplyToBotMessage(message: Message, botUserId: string): boolean {
  const repliedUserId = message.mentions.repliedUser?.id;
  if (!repliedUserId) {
    return false;
  }

  return Boolean(message.reference?.messageId) && repliedUserId === botUserId;
}

function isMentionMessage(message: Message, botUserId: string): boolean {
  return message.mentions.has(botUserId);
}

function removeMentionFromContent(rawContent: string, botUserId: string): string {
  const mentionPattern = new RegExp(`<@!?${botUserId}>`, "g");
  return rawContent.replace(mentionPattern, "").trim();
}

function resolveAuthorName(message: Message): string {
  return message.member?.displayName
    ?? message.author.displayName
    ?? message.author.username
    ?? "unknown";
}

function buildConversationEvent(
  message: Message,
  source: DiscordConversationSource,
  content: string
): DiscordConversationEvent {
  const ownerUserId = runtime.ownerUserId;
  const authorId = message.author.id;

  return {
    source,
    content,
    rawContent: message.content,
    channelId: message.channel.id,
    guildId: message.guildId ?? null,
    messageId: message.id,
    replyToMessageId: message.reference?.messageId ?? null,
    author: {
      id: authorId,
      name: resolveAuthorName(message),
      isOwner: ownerUserId !== null && authorId === ownerUserId,
    },
    receivedAt: new Date(message.createdTimestamp || Date.now()).toISOString(),
  };
}

async function replyToNonOwnerDirectMessage(message: Message): Promise<void> {
  if (!runtime.nonOwnerDmReply) {
    return;
  }

  try {
    await message.reply(runtime.nonOwnerDmReply);
  } catch (error) {
    logger.warn("failed to reply non-owner DM", {
      stage: "discord",
      observability: {
        kind: "node",
        eventType: "inbound.dm.non-owner.reply",
      },
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function getRuntimeClient(): Client {
  if (!runtime.client || !runtime.online) {
    throw new Error("discord local strategy is not online");
  }

  return runtime.client;
}

function getTypingManager(): TypingSessionManager {
  if (!runtime.typingSessionManager) {
    throw new Error("discord typing session manager is not ready");
  }

  return runtime.typingSessionManager;
}

async function handleInboundMessage(message: Message): Promise<void> {
  const requestId = createObservabilityRequestId("discord:inbound", {
    requestId: normalizeOptionalString(message.id),
    channelId: normalizeOptionalString(message.channel?.id),
    userId: normalizeOptionalString(message.author?.id),
  });
  try {
    logDiscordInfo("discord inbound message received", {
      action: "inbound.receive",
      requestId,
      channelId: message.channel?.id ?? null,
      guildId: message.guildId ?? null,
      messageId: message.id,
      authorId: message.author?.id ?? null,
      content: summarizeText(message.content),
      observability: {
        kind: "node",
        requestId,
        eventType: "inbound.receive",
      },
    });
    logDiscordRaw("discord inbound raw payload", requestId, "inbound.payload.raw", {
      content: message.content,
      messageId: message.id,
      channelId: message.channel?.id ?? null,
      authorId: message.author?.id ?? null,
    });
    if (message.author.bot) {
      logDiscordInfo("discord inbound skipped bot message", {
        action: "inbound.skip",
        requestId,
        reason: "author_is_bot",
        messageId: message.id,
        observability: {
          kind: "node",
          requestId,
          eventType: "inbound.filter",
        },
      });
      return;
    }

    if (!message.content || message.content.trim().length === 0) {
      logDiscordInfo("discord inbound skipped empty content", {
        action: "inbound.skip",
        requestId,
        reason: "empty_content",
        messageId: message.id,
        observability: {
          kind: "node",
          requestId,
          eventType: "inbound.filter",
        },
      });
      return;
    }

    // 訊息白名單：DM 只允許 owner；群組只處理 mention/reply。
    if (isDirectMessage(message)) {
      const ownerUserId = runtime.ownerUserId;
      const isOwnerDirectMessage = ownerUserId !== null && message.author.id === ownerUserId;

      if (!isOwnerDirectMessage) {
        await replyToNonOwnerDirectMessage(message);
        logDiscordInfo("discord inbound non-owner dm replied", {
          action: "inbound.dm.non-owner.reply",
          requestId,
          messageId: message.id,
          authorId: message.author.id,
          observability: {
            kind: "node",
            requestId,
            eventType: "inbound.dm.reply",
          },
        });
        return;
      }

      const event = buildConversationEvent(message, "owner_dm", message.content.trim());
      conversationStream.emit(
        "data",
        event
      );
      logDiscordInfo("discord inbound owner dm emitted", {
        action: "inbound.emit",
        requestId,
        source: "owner_dm",
        eventSummary: summarizeUnknown(event),
        observability: {
          kind: "node",
          requestId,
          eventType: "inbound.emit",
        },
      });
      logDiscordRaw("discord inbound owner dm raw event", requestId, "inbound.emit.raw", {
        event,
      });
      return;
    }

    // channelId 僅過濾群組訊息，DM 由 owner 規則處理。
    if (runtime.channelId && message.channel.id !== runtime.channelId) {
      logDiscordInfo("discord inbound skipped by channel filter", {
        action: "inbound.skip",
        requestId,
        reason: "channel_filter",
        configuredChannelId: runtime.channelId,
        messageChannelId: message.channel.id,
        observability: {
          kind: "node",
          requestId,
          eventType: "inbound.filter",
        },
      });
      return;
    }

    const client = runtime.client;
    const botUserId = client?.user?.id;
    if (!botUserId) {
      logDiscordInfo("discord inbound skipped bot user unavailable", {
        action: "inbound.skip",
        requestId,
        reason: "bot_user_unavailable",
        observability: {
          kind: "node",
          requestId,
          eventType: "inbound.filter",
        },
      });
      return;
    }

    if (isReplyToBotMessage(message, botUserId)) {
      const event = buildConversationEvent(message, "reply", message.content.trim());
      conversationStream.emit(
        "data",
        event
      );
      logDiscordInfo("discord inbound reply emitted", {
        action: "inbound.emit",
        requestId,
        source: "reply",
        eventSummary: summarizeUnknown(event),
        observability: {
          kind: "node",
          requestId,
          eventType: "inbound.emit",
        },
      });
      logDiscordRaw("discord inbound reply raw event", requestId, "inbound.emit.raw", {
        event,
      });
      return;
    }

    if (isMentionMessage(message, botUserId)) {
      const cleanedContent = removeMentionFromContent(message.content, botUserId);
      if (!cleanedContent) {
        logDiscordInfo("discord inbound mention skipped empty cleaned content", {
          action: "inbound.skip",
          requestId,
          reason: "mention_cleaned_empty",
          messageId: message.id,
          observability: {
            kind: "node",
            requestId,
            eventType: "inbound.filter",
          },
        });
        return;
      }

      const event = buildConversationEvent(message, "mention", cleanedContent);
      conversationStream.emit(
        "data",
        event
      );
      logDiscordInfo("discord inbound mention emitted", {
        action: "inbound.emit",
        requestId,
        source: "mention",
        eventSummary: summarizeUnknown(event),
        observability: {
          kind: "node",
          requestId,
          eventType: "inbound.emit",
        },
      });
      logDiscordRaw("discord inbound mention raw event", requestId, "inbound.emit.raw", {
        event,
      });
      return;
    }
    logDiscordInfo("discord inbound skipped non-target message", {
      action: "inbound.skip",
      requestId,
      reason: "not_mention_or_reply",
      messageId: message.id,
      observability: {
        kind: "node",
        requestId,
        eventType: "inbound.filter",
      },
    });
  } catch (error) {
    conversationStream.emit("error", error);
    logger.error("discord inbound message handling failed", {
      stage: "discord",
      observability: {
        kind: "node",
        requestId,
        eventType: "inbound.complete",
        outcome: "error",
      },
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function resolveAction(options: SendOptions): string {
  if (!isRecord(options)) {
    throw new Error("send options must be an object");
  }

  const action = options.action;
  if (typeof action !== "string" || action.trim().length === 0) {
    throw new Error("send options.action must be a non-empty string");
  }

  return action.trim();
}

async function sendMessageInternal(options: SendOptions): Promise<DiscordMessageSendResult> {
  const beginAt = Date.now();
  const payload = isRecord(options) ? options : {};
  const requestId = createObservabilityRequestId("discord:send-message", {
    requestId: normalizeOptionalString(payload.reqId),
    channelId: normalizeChannelId(payload.channelId),
  });
  logDiscordInfo("discord sendMessage begin", {
    action: "message.send.begin",
    requestId,
    optionsSummary: summarizeUnknown(isRecord(options) ? options : { value: options }),
    observability: {
      kind: "node",
      requestId,
      eventType: "message.send.begin",
    },
  });
  logDiscordRaw("discord sendMessage raw options", requestId, "message.send.options.raw", {
    options: payload,
  });
  const message = normalizeOptionalString(payload.message);
  if (!message) {
    throw new Error("message.send requires non-empty string field: message");
  }

  const channelId = normalizeChannelId(payload.channelId) ?? runtime.channelId;
  if (!channelId) {
    throw new Error("message.send requires channelId or online channelId default");
  }

  const client = getRuntimeClient();
  const channel = await client.channels.fetch(channelId);
  if (!channel) {
    throw new Error(`discord channel not found: ${channelId}`);
  }

  const sendMethod = (channel as { send?: unknown }).send;
  if (typeof sendMethod !== "function") {
    throw new Error(`discord channel does not support send(): ${channelId}`);
  }

  // 中英註解：保留 channel 作為 this，避免 discord.js 方法脫綁後讀不到 this.client。
  // EN: Keep `channel` as method receiver to avoid losing `this.client` in discord.js internals.
  const sent = await (sendMethod as (this: unknown, content: string) => Promise<{ id?: unknown }>).call(
    channel,
    message
  );
  const result = {
    ok: true,
    channelId,
    messageId: typeof sent?.id === "string" ? sent.id : null,
  };
  logDiscordInfo("discord sendMessage complete", {
    action: "message.send.complete",
    requestId,
    channelId,
    message: summarizeText(message),
    result,
    durationMs: Date.now() - beginAt,
    observability: {
      kind: "node",
      requestId,
      eventType: "message.send.complete",
      outcome: "success",
    },
  });
  logDiscordRaw("discord sendMessage raw content", requestId, "message.send.content.raw", {
    channelId,
    message,
  });
  return result;
}

async function sendTypingControl(options: SendOptions, mode: "start" | "stop"): Promise<DiscordTypingControlResult> {
  const beginAt = Date.now();
  const payload = isRecord(options) ? options : {};
  const requestId = createObservabilityRequestId(`discord:typing-${mode}`, {
    requestId: normalizeOptionalString(payload.reqId),
    channelId: normalizeChannelId(payload.channelId),
  });
  logDiscordInfo("discord typing control begin", {
    action: mode === "start" ? "typing.start.begin" : "typing.stop.begin",
    requestId,
    mode,
    optionsSummary: summarizeUnknown(isRecord(options) ? options : { value: options }),
    observability: {
      kind: "node",
      requestId,
      eventType: mode === "start" ? "typing.start.begin" : "typing.stop.begin",
    },
  });
  logDiscordRaw("discord typing raw options", requestId, `typing.${mode}.options.raw`, {
    options: payload,
  });
  const channelId = normalizeChannelId(payload.channelId) ?? runtime.channelId;
  if (!channelId) {
    throw new Error(`${mode === "start" ? ACTION_TYPING_START : ACTION_TYPING_STOP} requires channelId or online channelId default`);
  }

  const manager = getTypingManager();
  if (mode === "start") {
    const result = await manager.start(channelId);
    logDiscordInfo("discord typing control complete", {
      action: "typing.start.complete",
      requestId,
      mode,
      channelId,
      result,
      durationMs: Date.now() - beginAt,
      observability: {
        kind: "node",
        requestId,
        eventType: "typing.start.complete",
        outcome: "success",
      },
    });
    return result;
  }

  const result = await manager.stop(channelId);
  logDiscordInfo("discord typing control complete", {
    action: "typing.stop.complete",
    requestId,
    mode,
    channelId,
    result,
    durationMs: Date.now() - beginAt,
    observability: {
      kind: "node",
      requestId,
      eventType: "typing.stop.complete",
      outcome: "success",
    },
  });
  return result;
}

function openConversationStream(): DiscordConversationStream {
  getRuntimeClient();
  logDiscordInfo("discord open conversation stream", {
    action: "conversation.stream.open",
    result: "ok",
  });
  return conversationStream;
}

function assertLocalMethod(method: unknown, operation: string): void {
  if (method !== METHOD_LOCAL) {
    throw new Error(`${operation} requires method=\"local\"`);
  }
}

export default {
  method: METHOD_LOCAL,

  async online(options: StrategyOnlineOptions): Promise<void> {
    const beginAt = Date.now();
    logDiscordInfo("discord online begin", {
      action: "online.begin",
      options,
    });
    const typedOptions = (isRecord(options) ? options : {}) as LocalOnlineOptions;
    assertLocalMethod(typedOptions.method ?? METHOD_LOCAL, "online");

    if (runtime.online) {
      await this.offline();
    }

    // 密鑰統一由 SecretsManager 讀取，不允許直接存取環境變數來源。
    const token = secretsManager.get(SECRET_KEYS.DISCORD_TOKEN);
    const ownerUserId = resolveOwnerUserId(typedOptions);
    const channelId = resolveChannelId(typedOptions);
    const nonOwnerDmReply = resolveNonOwnerDmReply(typedOptions);
    const typingIntervalMs = resolveTypingIntervalMs(typedOptions);

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });

    const messageListener = async (message: Message): Promise<void> => {
      await handleInboundMessage(message);
    };

    const typingSessionManager = new TypingSessionManager({
      intervalMs: typingIntervalMs,
      fetchChannel: async (targetChannelId: string) => {
        const runtimeClient = getRuntimeClient();
        return runtimeClient.channels.fetch(targetChannelId);
      },
    });

    try {
      await client.login(token);
      client.on("messageCreate", messageListener);

      runtime = {
        client,
        messageListener,
        online: true,
        channelId,
        ownerUserId,
        nonOwnerDmReply,
        typingIntervalMs,
        typingSessionManager,
      };

      logger.info("discord plugin online", {
        observability: {
          kind: "node",
          eventType: "online.state",
        },
        channelId: channelId ?? "global",
        ownerUserId: ownerUserId ?? "unset",
        typingIntervalMs,
      });
      logDiscordInfo("discord online complete", {
        action: "online.complete",
        channelId: channelId ?? "global",
        ownerUserId: ownerUserId ?? "unset",
        typingIntervalMs,
        result: "ok",
        durationMs: Date.now() - beginAt,
      });
    } catch (error) {
      await typingSessionManager.clear();
      try {
        await client.destroy();
      } catch {
        // ignore cleanup errors
      }

      logDiscordInfo("discord online failed", {
        action: "online.error",
        result: "failed",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - beginAt,
      });
      throw error;
    }
  },

  async offline(): Promise<void> {
    const beginAt = Date.now();
    logDiscordInfo("discord offline begin", {
      action: "offline.begin",
    });
    const client = runtime.client;
    const messageListener = runtime.messageListener;
    const typingSessionManager = runtime.typingSessionManager;

    if (typingSessionManager) {
      await typingSessionManager.clear();
    }

    if (!client) {
      runtime = {
        ...runtime,
        online: false,
        messageListener: null,
        typingSessionManager: null,
      };
      logDiscordInfo("discord offline complete without client", {
        action: "offline.complete",
        result: "ok",
        durationMs: Date.now() - beginAt,
      });
      return;
    }

    if (messageListener) {
      client.off("messageCreate", messageListener);
    }

    await client.destroy();

    runtime = {
      client: null,
      messageListener: null,
      online: false,
      channelId: null,
      ownerUserId: null,
      nonOwnerDmReply: DEFAULT_NON_OWNER_DM_REPLY,
      typingIntervalMs: DEFAULT_TYPING_INTERVAL_MS,
      typingSessionManager: null,
    };

    logger.info("discord plugin offline", {
      stage: "discord",
      observability: {
        kind: "node",
        eventType: "offline.state",
      },
    });
    logDiscordInfo("discord offline complete", {
      action: "offline.complete",
      result: "ok",
      durationMs: Date.now() - beginAt,
    });
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    const beginAt = Date.now();
    logDiscordInfo("discord restart begin", {
      action: "restart.begin",
      options,
    });
    await this.offline();
    await this.online(options);
    logger.info("discord plugin restarted", {
      stage: "discord",
      observability: {
        kind: "node",
        eventType: "restart.state",
      },
    });
    logDiscordInfo("discord restart complete", {
      action: "restart.complete",
      result: "ok",
      durationMs: Date.now() - beginAt,
    });
  },

  async state(): Promise<StateResult> {
    logDiscordInfo("discord state begin", {
      action: "state.begin",
      online: runtime.online,
      hasClient: Boolean(runtime.client),
    });
    if (!runtime.client || !runtime.online) {
      logDiscordInfo("discord state complete", {
        action: "state.complete",
        status: 0,
      });
      return { status: 0 };
    }

    if (typeof runtime.client.isReady === "function" && !runtime.client.isReady()) {
      logDiscordInfo("discord state complete", {
        action: "state.complete",
        status: -1,
      });
      return { status: -1 };
    }

    logDiscordInfo("discord state complete", {
      action: "state.complete",
      status: 1,
    });
    return { status: 1 };
  },

  async openConversationStream(): Promise<DiscordConversationStream> {
    return openConversationStream();
  },

  async sendMessage(input: SendOptions): Promise<DiscordMessageSendResult> {
    getRuntimeClient();
    return sendMessageInternal(input);
  },

  async startTyping(input: SendOptions): Promise<DiscordTypingControlResult> {
    getRuntimeClient();
    return sendTypingControl(input, "start");
  },

  async stopTyping(input: SendOptions): Promise<DiscordTypingControlResult> {
    getRuntimeClient();
    return sendTypingControl(input, "stop");
  },

  async send(options: SendOptions): Promise<unknown> {
    getRuntimeClient();

    const action = resolveAction(options);
    const requestId = createObservabilityRequestId("discord:send-route", {
      requestId: normalizeOptionalString((isRecord(options) ? options.reqId : null) ?? null),
      channelId: normalizeChannelId(isRecord(options) ? options.channelId : null),
    });
    logDiscordInfo("discord send route begin", {
      action: "send.route.begin",
      requestId,
      route: action,
      optionsSummary: summarizeUnknown(isRecord(options) ? options : { value: options }),
      observability: {
        kind: "node",
        requestId,
        eventType: "send.route.begin",
      },
    });
    logDiscordRaw("discord send route raw options", requestId, "send.route.options.raw", {
      route: action,
      options: isRecord(options) ? options : { value: options },
    });
    if (action === ACTION_CONVERSATION_STREAM || action === ACTION_CONVERSATION_STREAM_CAPABILITY) {
      return this.openConversationStream();
    }

    if (action === ACTION_MESSAGE_SEND || action === ACTION_MESSAGE_SEND_CAPABILITY) {
      return this.sendMessage(options);
    }

    if (action === ACTION_TYPING_START || action === ACTION_TYPING_START_CAPABILITY) {
      return this.startTyping(options);
    }

    if (action === ACTION_TYPING_STOP || action === ACTION_TYPING_STOP_CAPABILITY) {
      return this.stopTyping(options);
    }

    throw new Error(`unsupported action: ${action}`);
  },
};
