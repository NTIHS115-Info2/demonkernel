import type { SendOptions, StrategyOnlineOptions } from "../../../../core/plugin-sdk";
import type { EventEmitter } from "node:events";

export type GatewayAction = "chat.stream" | "models.list" | "health.check";

export type GatewayCapabilityAction =
  | "system.llm.remote.chat.stream"
  | "system.llm.remote.models.list"
  | "system.llm.remote.health.check";

export type GatewayActionInput = GatewayAction | GatewayCapabilityAction;

export type RemoteErrorType = "request_error" | "server_error" | "timeout" | "parse_error";

export interface RuntimeConfig {
  baseUrl: string;
  model: string | null;
  timeoutMs: number;
  connectionTimeoutMs: number;
  maxRetries: number;
  retryDelayBaseMs: number;
  reqId: string | null;
  reqIdHeader: string;
  headers: Record<string, string>;
}

export type RuntimeConfigOverrides = Partial<Omit<RuntimeConfig, "baseUrl">>;

export interface ChatStreamSendInput {
  action?: GatewayActionInput;
  messages: unknown[];
  model?: string | null;
  stream?: boolean;
  tools?: unknown[];
  tool_choice?: unknown;
  params?: Record<string, unknown>;
  timeoutMs?: number;
  connectionTimeoutMs?: number;
  maxRetries?: number;
  retryDelayBaseMs?: number;
  reqId?: string | null;
  reqIdHeader?: string;
  headers?: Record<string, string>;
}

export interface ModelsListSendInput {
  action: GatewayActionInput;
  timeoutMs?: number;
  reqId?: string | null;
  reqIdHeader?: string;
  headers?: Record<string, string>;
}

export interface HealthCheckSendInput {
  action: GatewayActionInput;
  timeoutMs?: number;
  reqId?: string | null;
  reqIdHeader?: string;
  headers?: Record<string, string>;
}

export interface NormalizedChatPayload {
  messages: Array<Record<string, unknown>>;
  model: string | null;
  stream: boolean;
  tools: unknown[] | null;
  tool_choice: unknown;
  params: Record<string, unknown>;
}

export interface TypedRemoteError extends Error {
  type: RemoteErrorType;
  status?: number;
  code?: string;
  reqId?: string | null;
  phase?: string;
  url?: string;
  details?: unknown;
  originalError?: unknown;
}

export type ChatStreamEmitter = EventEmitter & {
  abort: () => void;
};

export interface ModelsListResult {
  ok: boolean;
  status: number;
  models: unknown[];
  raw: unknown;
  message?: string;
  errorType?: RemoteErrorType | "network_error" | "unknown_error";
}

export interface HealthCheckResult {
  ok: boolean;
  status: number;
  message: string;
  errorType?: RemoteErrorType | "network_error" | "unknown_error";
  raw?: unknown;
}

export type RemoteOnlineOptions = StrategyOnlineOptions & {
  method?: "remote";
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  connectionTimeoutMs?: number;
  maxRetries?: number;
  retryDelayBaseMs?: number;
  reqId?: string;
  reqIdHeader?: string;
  headers?: Record<string, string>;
};

export type RemoteSendOptions = SendOptions | unknown[] | ChatStreamSendInput;
