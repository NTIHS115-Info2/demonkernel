import type {
  SendOptions,
  StateResult,
  StrategyOnlineOptions,
  StrategyRestartOptions,
} from "../../../../core/plugin-sdk";
import { createKernelLogger } from "../../../../core/logger";
import axios from "axios";
import { EventEmitter } from "node:events";
import type { Readable } from "node:stream";

import {
  ACTION_ALIAS_TO_ACTION,
  DEFAULT_RUNTIME_CONFIG,
  METHOD_REMOTE,
  OPENAI_PATHS,
} from "./constants";
import { classifyError, createTypedError, shouldRetryError } from "./errors";
import {
  buildChatPayload,
  extractCompletionContent,
  extractReasoningContent,
  normalizeCompletionChunk,
} from "./payload";
import { extractSseData, splitSseLines } from "./sse";
import type {
  ChatStreamEmitter,
  ChatStreamSendInput,
  GatewayAction,
  HealthCheckResult,
  ModelsListResult,
  RemoteOnlineOptions,
  RemoteSendOptions,
  RuntimeConfig,
} from "./types";

const logger = createKernelLogger("plugin-llm-remote-gateway-remote", {
  plugin: "llm-remote-gateway",
  type: "system",
  strategy: "remote",
});

let runtimeConfig: RuntimeConfig | null = null;
let online = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeNonNegativeInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeHeaders(value: unknown, fallback: Record<string, string>): Record<string, string> {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  const output: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value)) {
    if (typeof headerValue === "string") {
      output[key] = headerValue;
      continue;
    }

    if (typeof headerValue === "number" || typeof headerValue === "boolean") {
      output[key] = String(headerValue);
    }
  }
  return output;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${stripTrailingSlash(baseUrl)}${normalizedPath}`;
}

function resolveOnlineConfig(options: StrategyOnlineOptions): RuntimeConfig {
  if (!isRecord(options)) {
    throw new Error("online options must be an object");
  }

  const typedOptions = options as RemoteOnlineOptions;
  const baseUrl = stripTrailingSlash(normalizeString(typedOptions.baseUrl, "baseUrl"));

  return {
    baseUrl,
    model: normalizeOptionalString(typedOptions.model) ?? DEFAULT_RUNTIME_CONFIG.model,
    timeoutMs: normalizePositiveNumber(typedOptions.timeoutMs, DEFAULT_RUNTIME_CONFIG.timeoutMs),
    connectionTimeoutMs: normalizePositiveNumber(
      typedOptions.connectionTimeoutMs,
      DEFAULT_RUNTIME_CONFIG.connectionTimeoutMs
    ),
    maxRetries: normalizeNonNegativeInteger(typedOptions.maxRetries, DEFAULT_RUNTIME_CONFIG.maxRetries),
    retryDelayBaseMs: normalizePositiveNumber(
      typedOptions.retryDelayBaseMs,
      DEFAULT_RUNTIME_CONFIG.retryDelayBaseMs
    ),
    reqId: normalizeOptionalString(typedOptions.reqId) ?? DEFAULT_RUNTIME_CONFIG.reqId,
    reqIdHeader: normalizeOptionalString(typedOptions.reqIdHeader) ?? DEFAULT_RUNTIME_CONFIG.reqIdHeader,
    headers: normalizeHeaders(typedOptions.headers, DEFAULT_RUNTIME_CONFIG.headers),
  };
}

function resolveRequestConfig(baseConfig: RuntimeConfig, options: Record<string, unknown>): RuntimeConfig {
  return {
    ...baseConfig,
    model: normalizeOptionalString(options.model) ?? baseConfig.model,
    timeoutMs: normalizePositiveNumber(options.timeoutMs, baseConfig.timeoutMs),
    connectionTimeoutMs: normalizePositiveNumber(
      options.connectionTimeoutMs,
      baseConfig.connectionTimeoutMs
    ),
    maxRetries: normalizeNonNegativeInteger(options.maxRetries, baseConfig.maxRetries),
    retryDelayBaseMs: normalizePositiveNumber(options.retryDelayBaseMs, baseConfig.retryDelayBaseMs),
    reqId: normalizeOptionalString(options.reqId) ?? baseConfig.reqId,
    reqIdHeader: normalizeOptionalString(options.reqIdHeader) ?? baseConfig.reqIdHeader,
    headers: {
      ...baseConfig.headers,
      ...normalizeHeaders(options.headers, {}),
    },
  };
}

function resolveAction(options: RemoteSendOptions): GatewayAction {
  if (Array.isArray(options)) {
    return "chat.stream";
  }

  if (!isRecord(options)) {
    throw new Error("send options must be an object or messages array");
  }

  const action = options.action;
  if (typeof action === "string" && action in ACTION_ALIAS_TO_ACTION) {
    return ACTION_ALIAS_TO_ACTION[action as keyof typeof ACTION_ALIAS_TO_ACTION];
  }

  if (Array.isArray(options.messages)) {
    return "chat.stream";
  }

  throw new Error(`unsupported action "${String(action)}"`);
}

function normalizeChatInput(options: RemoteSendOptions): ChatStreamSendInput {
  if (Array.isArray(options)) {
    return {
      action: "chat.stream",
      messages: options,
      stream: true,
    };
  }

  if (!isRecord(options)) {
    throw new Error("chat.stream requires object options or messages array");
  }

  if (!Array.isArray(options.messages)) {
    throw new Error("chat.stream requires messages array");
  }

  return {
    action: options.action as ChatStreamSendInput["action"],
    messages: options.messages,
    model: normalizeOptionalString(options.model),
    stream: true,
    tools: Array.isArray(options.tools) ? options.tools : undefined,
    tool_choice: options.tool_choice,
    params: isRecord(options.params) ? options.params : {},
    timeoutMs: Number(options.timeoutMs),
    connectionTimeoutMs: Number(options.connectionTimeoutMs),
    maxRetries: Number(options.maxRetries),
    retryDelayBaseMs: Number(options.retryDelayBaseMs),
    reqId: normalizeOptionalString(options.reqId),
    reqIdHeader: normalizeOptionalString(options.reqIdHeader) ?? undefined,
    headers: normalizeHeaders(options.headers, {}),
  };
}

function toRequestHeaders(config: RuntimeConfig, reqId: string | null, isJson: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    ...config.headers,
  };

  if (isJson && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (reqId) {
    headers[config.reqIdHeader] = reqId;
  }

  return headers;
}

function buildModelsResultFromStatus(
  status: number,
  raw: unknown,
  message: string,
  errorType: ModelsListResult["errorType"]
): ModelsListResult {
  return {
    ok: false,
    status,
    models: [],
    raw,
    message,
    errorType,
  };
}

async function requestModelsList(
  config: RuntimeConfig,
  options: Record<string, unknown> = {}
): Promise<ModelsListResult> {
  const requestConfig = resolveRequestConfig(config, options);
  const url = buildUrl(requestConfig.baseUrl, OPENAI_PATHS.MODELS);
  const headers = toRequestHeaders(requestConfig, requestConfig.reqId, false);

  try {
    const response = await axios({
      url,
      method: "GET",
      headers,
      timeout: requestConfig.timeoutMs,
      validateStatus: () => true,
    });

    const status = Number(response.status) || 0;
    const raw = response.data;

    if (status >= 400) {
      const errorType = status >= 500 ? "server_error" : "request_error";
      return buildModelsResultFromStatus(
        status,
        raw,
        `models request failed with status ${status}`,
        errorType
      );
    }

    const modelsRaw = isRecord(raw) && Array.isArray(raw.data) ? raw.data : [];
    return {
      ok: true,
      status,
      models: modelsRaw,
      raw,
    };
  } catch (error) {
    const classified = classifyError(error, {
      reqId: requestConfig.reqId,
      phase: "models-list",
      url,
    });
    return buildModelsResultFromStatus(
      classified.status ?? 0,
      null,
      classified.message,
      classified.type
    );
  }
}

async function requestHealthCheck(
  config: RuntimeConfig,
  options: Record<string, unknown> = {}
): Promise<HealthCheckResult> {
  const models = await requestModelsList(config, options);
  if (models.ok) {
    return {
      ok: true,
      status: models.status,
      message: "remote service is healthy",
      raw: models.raw,
    };
  }

  return {
    ok: false,
    status: models.status,
    message: models.message ?? "remote health check failed",
    errorType: models.errorType,
    raw: models.raw,
  };
}

function createChatEmitter(config: RuntimeConfig, input: ChatStreamSendInput): ChatStreamEmitter {
  // 中英註解：此 emitter 對齊舊 LLMStream 契約，維持 data/end/error/abort + abort()
  // EN: Keep backward-compatible LLM stream contract with data/end/error/abort and abort().
  const emitter = new EventEmitter() as ChatStreamEmitter;
  const requestConfig = resolveRequestConfig(config, input as unknown as Record<string, unknown>);
  const reqId = input.reqId ?? requestConfig.reqId;
  const url = buildUrl(requestConfig.baseUrl, OPENAI_PATHS.CHAT_COMPLETIONS);

  const payload = buildChatPayload({
    messages: input.messages as Array<Record<string, unknown>>,
    model: input.model ?? requestConfig.model,
    stream: true,
    tools: Array.isArray(input.tools) && input.tools.length > 0 ? input.tools : null,
    tool_choice: input.tool_choice,
    params: isRecord(input.params) ? input.params : {},
  });

  let stream: Readable | null = null;
  let aborted = false;
  let retryCount = 0;
  let dataTimeout: NodeJS.Timeout | null = null;
  const controller = new AbortController();

  const clearDataTimeout = (): void => {
    if (dataTimeout) {
      clearTimeout(dataTimeout);
      dataTimeout = null;
    }
  };

  const attemptRequest = async (): Promise<void> => {
    if (aborted) {
      return;
    }

    try {
      logger.info("chat stream request attempt", {
        attempt: retryCount + 1,
        maxAttempt: requestConfig.maxRetries + 1,
        url,
      });

      const response = await axios({
        url,
        method: "POST",
        data: payload,
        responseType: "stream",
        timeout: requestConfig.timeoutMs,
        headers: toRequestHeaders(requestConfig, reqId, true),
        signal: controller.signal,
        timeoutErrorMessage: `chat stream timeout (${requestConfig.timeoutMs}ms)`,
      });

      if (!response.data || typeof response.data.on !== "function") {
        throw createTypedError({
          type: "server_error",
          message: "chat stream response missing readable stream",
          reqId,
          phase: "chat-stream-prepare",
          url,
        });
      }

      stream = response.data as Readable;
      let buffer = "";
      let dataReceived = false;

      dataTimeout = setTimeout(() => {
        if (aborted || dataReceived) {
          return;
        }

        clearDataTimeout();
        aborted = true;
        const timeoutError = createTypedError({
          type: "timeout",
          message: "chat stream did not receive data in time",
          reqId,
          phase: "chat-stream-initial-data-timeout",
          url,
        });
        emitter.emit("error", timeoutError);
        controller.abort();
        stream?.destroy();
      }, requestConfig.connectionTimeoutMs);

      // 中英註解：SSE 行解析（data: ...），保留 [DONE] 收尾語義
      // EN: Parse SSE `data:` lines and keep `[DONE]` semantics.
      stream.on("data", (chunk: Buffer | string) => {
        if (aborted) {
          return;
        }

        dataReceived = true;
        clearDataTimeout();

        const textChunk = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
        buffer += textChunk;

        const { lines, rest } = splitSseLines(buffer);
        buffer = rest;

        for (const line of lines) {
          const data = extractSseData(line);
          if (!data) {
            continue;
          }

          if (data === "[DONE]") {
            clearDataTimeout();
            if (aborted) {
              return;
            }
            aborted = true;
            emitter.emit("end");
            controller.abort();
            stream?.destroy();
            return;
          }

          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;
            const normalized = normalizeCompletionChunk(parsed);
            const content = extractCompletionContent(normalized);
            const reasoning = extractReasoningContent(normalized);

            if (content || reasoning) {
              emitter.emit("data", content || "", normalized, reasoning || null);
            }
          } catch (error) {
            logger.warn("chat stream chunk parse failed", { error: String(error), data });
          }
        }
      });

      stream.on("end", () => {
        clearDataTimeout();
        if (aborted) {
          return;
        }
        aborted = true;
        emitter.emit("end");
      });

      stream.on("error", (error) => {
        clearDataTimeout();
        if (aborted) {
          return;
        }
        aborted = true;
        emitter.emit("error", classifyError(error, {
          reqId,
          phase: "chat-stream",
          url,
        }));
      });
    } catch (error) {
      if (aborted) {
        return;
      }

      // 中英註解：只在可重試錯誤上做 exponential backoff
      // EN: Apply exponential backoff only for retryable failures.
      if (shouldRetryError(error, retryCount, requestConfig.maxRetries)) {
        retryCount += 1;
        const delayMs = requestConfig.retryDelayBaseMs * (2 ** (retryCount - 1));
        logger.warn("chat stream request failed and will retry", {
          retryCount,
          delayMs,
          error: String((error as { message?: string }).message ?? error),
        });
        setTimeout(() => {
          void attemptRequest();
        }, delayMs);
        return;
      }

      aborted = true;
      emitter.emit("error", classifyError(error, {
        reqId,
        phase: "chat-request",
        url,
      }));
    }
  };

  void attemptRequest();

  emitter.abort = () => {
    if (aborted) {
      return;
    }

    aborted = true;
    clearDataTimeout();
    controller.abort();
    stream?.destroy();
    emitter.emit("abort");
  };

  return emitter;
}

export default {
  method: METHOD_REMOTE,

  async online(options: StrategyOnlineOptions): Promise<void> {
    runtimeConfig = resolveOnlineConfig(options);
    online = true;
    logger.info("llm-remote-gateway online", {
      baseUrl: runtimeConfig.baseUrl,
      model: runtimeConfig.model,
    });
  },

  async offline(): Promise<void> {
    runtimeConfig = null;
    online = false;
    logger.info("llm-remote-gateway offline");
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    await this.offline();
    await this.online(options);
    logger.info("llm-remote-gateway restarted");
  },

  async state(): Promise<StateResult> {
    if (!online || !runtimeConfig) {
      return { status: 0 };
    }

    const health = await requestHealthCheck(runtimeConfig);
    if (health.ok) {
      return { status: 1 };
    }

    logger.warn("state check failed", { ...health });
    return { status: -1 };
  },

  async send(options: SendOptions): Promise<unknown> {
    if (!runtimeConfig || !online) {
      throw new Error("remote strategy is not online");
    }

    const action = resolveAction(options as RemoteSendOptions);

    switch (action) {
      case "chat.stream":
        return createChatEmitter(runtimeConfig, normalizeChatInput(options as RemoteSendOptions));
      case "models.list":
        return requestModelsList(runtimeConfig, isRecord(options) ? options : {});
      case "health.check":
        return requestHealthCheck(runtimeConfig, isRecord(options) ? options : {});
      default:
        throw new Error(`unsupported action: ${String(action)}`);
    }
  },
};
