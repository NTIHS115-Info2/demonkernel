import type { GatewayAction, GatewayActionInput, RuntimeConfig } from "./types";

export const METHOD_REMOTE = "remote" as const;

export const OPENAI_PATHS = Object.freeze({
  MODELS: "/v1/models",
  CHAT_COMPLETIONS: "/v1/chat/completions",
});

export const DEFAULT_RUNTIME_CONFIG: Omit<RuntimeConfig, "baseUrl"> = Object.freeze({
  model: null,
  timeoutMs: 30000,
  connectionTimeoutMs: 10000,
  maxRetries: 3,
  retryDelayBaseMs: 1000,
  reqId: null,
  reqIdHeader: "X-Request-Id",
  headers: {},
});

export const ACTION_ALIAS_TO_ACTION: Readonly<Record<GatewayActionInput, GatewayAction>> = Object.freeze({
  "chat.stream": "chat.stream",
  "models.list": "models.list",
  "health.check": "health.check",
  "system.llm.remote.chat.stream": "chat.stream",
  "system.llm.remote.models.list": "models.list",
  "system.llm.remote.health.check": "health.check",
});

export const RETRYABLE_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENETUNREACH",
  "EAI_AGAIN",
]);
