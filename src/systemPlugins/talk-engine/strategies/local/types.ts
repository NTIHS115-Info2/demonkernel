import type { EventEmitter } from "node:events";

import type { SendOptions, StrategyOnlineOptions } from "../../../../core/plugin-sdk";

export type TalkAction = "talk.nostream" | "talk.stream";

export type TalkActionInput =
  | TalkAction
  | "system.talk.engine.nostream"
  | "system.talk.engine.stream";

export type TalkOnlineOptions = StrategyOnlineOptions & {
  method?: "local";
  relayEnabled?: unknown;
  relayErrorReply?: unknown;
};

export type TalkSendInput = SendOptions & {
  action?: TalkActionInput;
  message?: unknown;
  talker?: unknown;
  model?: unknown;
  tools?: unknown;
  tool_choice?: unknown;
  params?: unknown;
  timeoutMs?: unknown;
  connectionTimeoutMs?: unknown;
  maxRetries?: unknown;
  retryDelayBaseMs?: unknown;
  reqId?: unknown;
  reqIdHeader?: unknown;
  headers?: unknown;
};

export interface NormalizedTalkInput {
  action: TalkAction;
  message: string;
  talker: string | null;
  model?: string;
  tools?: unknown[];
  toolChoice?: unknown;
  params: Record<string, unknown>;
  timeoutMs?: number;
  connectionTimeoutMs?: number;
  maxRetries?: number;
  retryDelayBaseMs?: number;
  reqId?: string;
  reqIdHeader?: string;
  headers?: Record<string, string>;
}

export interface TalkPromptMessage {
  role: "user";
  content: string;
}

export interface DiscordConversationEvent {
  source: "mention" | "reply" | "owner_dm";
  content: string;
  rawContent: string;
  channelId: string;
  guildId: string | null;
  messageId: string;
  replyToMessageId: string | null;
  author: {
    id: string;
    name: string;
    isOwner: boolean;
  };
  receivedAt: string;
}

export type DiscordConversationStream = EventEmitter & {
  on(event: "data", listener: (payload: DiscordConversationEvent) => void): DiscordConversationStream;
  on(event: "error", listener: (error: unknown) => void): DiscordConversationStream;
};

export type LlmStreamEmitter = EventEmitter & {
  abort?: () => void;
};

export interface TalkNoStreamResult {
  reply: string;
}

export interface LlmChatStreamProvider {
  streamChat(input: Record<string, unknown>): Promise<LlmStreamEmitter>;
}

export interface DiscordConversationProvider {
  openConversationStream(): Promise<DiscordConversationStream>;
}

export interface DiscordMessageSendProvider {
  sendMessage(input: { channelId?: unknown; message?: unknown }): Promise<unknown>;
}

export interface DiscordTypingStartProvider {
  startTyping(input: { channelId?: unknown }): Promise<unknown>;
}

export interface DiscordTypingStopProvider {
  stopTyping(input: { channelId?: unknown }): Promise<unknown>;
}

export interface RelayRuntime {
  enabled: boolean;
  errorReply: string;
  stream: DiscordConversationStream | null;
  dataListener: ((event: DiscordConversationEvent) => void) | null;
  errorListener: ((error: unknown) => void) | null;
}
