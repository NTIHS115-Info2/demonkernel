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
  try {
    if (message.author.bot) {
      return;
    }

    if (!message.content || message.content.trim().length === 0) {
      return;
    }

    // 訊息白名單：DM 只允許 owner；群組只處理 mention/reply。
    if (isDirectMessage(message)) {
      const ownerUserId = runtime.ownerUserId;
      const isOwnerDirectMessage = ownerUserId !== null && message.author.id === ownerUserId;

      if (!isOwnerDirectMessage) {
        await replyToNonOwnerDirectMessage(message);
        return;
      }

      conversationStream.emit(
        "data",
        buildConversationEvent(message, "owner_dm", message.content.trim())
      );
      return;
    }

    // channelId 僅過濾群組訊息，DM 由 owner 規則處理。
    if (runtime.channelId && message.channel.id !== runtime.channelId) {
      return;
    }

    const client = runtime.client;
    const botUserId = client?.user?.id;
    if (!botUserId) {
      return;
    }

    if (isReplyToBotMessage(message, botUserId)) {
      conversationStream.emit(
        "data",
        buildConversationEvent(message, "reply", message.content.trim())
      );
      return;
    }

    if (isMentionMessage(message, botUserId)) {
      const cleanedContent = removeMentionFromContent(message.content, botUserId);
      if (!cleanedContent) {
        return;
      }

      conversationStream.emit(
        "data",
        buildConversationEvent(message, "mention", cleanedContent)
      );
    }
  } catch (error) {
    conversationStream.emit("error", error);
    logger.error("discord inbound message handling failed", {
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
  const payload = isRecord(options) ? options : {};
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
  return {
    ok: true,
    channelId,
    messageId: typeof sent?.id === "string" ? sent.id : null,
  };
}

async function sendTypingControl(options: SendOptions, mode: "start" | "stop"): Promise<DiscordTypingControlResult> {
  const payload = isRecord(options) ? options : {};
  const channelId = normalizeChannelId(payload.channelId) ?? runtime.channelId;
  if (!channelId) {
    throw new Error(`${mode === "start" ? ACTION_TYPING_START : ACTION_TYPING_STOP} requires channelId or online channelId default`);
  }

  const manager = getTypingManager();
  if (mode === "start") {
    return manager.start(channelId);
  }

  return manager.stop(channelId);
}

function openConversationStream(): DiscordConversationStream {
  getRuntimeClient();
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
        channelId: channelId ?? "global",
        ownerUserId: ownerUserId ?? "unset",
        typingIntervalMs,
      });
    } catch (error) {
      await typingSessionManager.clear();
      try {
        await client.destroy();
      } catch {
        // ignore cleanup errors
      }

      throw error;
    }
  },

  async offline(): Promise<void> {
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

    logger.info("discord plugin offline");
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    await this.offline();
    await this.online(options);
    logger.info("discord plugin restarted");
  },

  async state(): Promise<StateResult> {
    if (!runtime.client || !runtime.online) {
      return { status: 0 };
    }

    if (typeof runtime.client.isReady === "function" && !runtime.client.isReady()) {
      return { status: -1 };
    }

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
