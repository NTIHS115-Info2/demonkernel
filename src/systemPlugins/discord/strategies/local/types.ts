import type { EventEmitter } from "node:events";

export type DiscordConversationSource = "mention" | "reply" | "owner_dm";

export interface DiscordConversationEvent {
  source: DiscordConversationSource;
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

export interface DiscordMessageSendResult {
  ok: boolean;
  channelId: string;
  messageId: string | null;
}
