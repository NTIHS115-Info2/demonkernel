import type {
  SendOptions,
  StrategyOnlineOptions,
} from "../../../../core/plugin-sdk";

export type ConversationRole = "system" | "user" | "assistant" | "tool";

export interface ConversationHistoryMessage {
  role: ConversationRole;
  content: string;
  timestamp: number;
}

export type ConversationScopeInput = {
  conversationId?: unknown;
  userId?: unknown;
};

export type ConversationHistoryAppendInput = ConversationScopeInput & {
  role?: unknown;
  content?: unknown;
};

export type ConversationHistorySendInput = SendOptions & {
  action?: unknown;
  role?: unknown;
  content?: unknown;
  conversationId?: unknown;
  userId?: unknown;
  limit?: unknown;
};

export type ConversationHistoryOnlineOptions = StrategyOnlineOptions & {
  method?: unknown;
  historyDir?: unknown;
  maxMessages?: unknown;
  expireDays?: unknown;
  backupCount?: unknown;
  maxFileSize?: unknown;
};

export type ConversationHistoryConfig = {
  historyDir: string;
  maxMessages: number;
  expireDays: number;
  backupCount: number;
  maxFileSize: number;
};
