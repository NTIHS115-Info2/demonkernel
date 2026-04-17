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

function logGatewayInfo(message: string, meta: Record<string, unknown> = {}): void {
  logger.info(message, {
    stage: "llm-remote-gateway",
    ...meta,
  });
}

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

type UpstreamStreamError = {
  message: string;
  details: unknown;
};

type StreamChunkKind = "content" | "reasoning" | "empty";

type ClassifiedStreamChunk = {
  kind: StreamChunkKind;
  content: string;
  reasoning: string;
};

type ReasoningDiagnostics = {
  chunkCount: number;
  totalLength: number;
  firstChunkIndex: number | null;
  snippets: string[];
};

function createReasoningDiagnostics(): ReasoningDiagnostics {
  return {
    chunkCount: 0,
    totalLength: 0,
    firstChunkIndex: null,
    snippets: [],
  };
}

function trackReasoningChunk(
  diagnostics: ReasoningDiagnostics,
  reasoning: string,
  chunkIndex: number
): void {
  if (reasoning.length === 0) {
    return;
  }

  diagnostics.chunkCount += 1;
  diagnostics.totalLength += reasoning.length;
  if (diagnostics.firstChunkIndex === null) {
    diagnostics.firstChunkIndex = chunkIndex;
  }
  if (diagnostics.snippets.length < 3) {
    diagnostics.snippets.push(reasoning.slice(0, 120));
  }
}

function classifyStreamChunk(payload: Record<string, unknown>): ClassifiedStreamChunk {
  const content = extractCompletionContent(payload);
  const reasoning = extractReasoningContent(payload);

  if (content.length > 0) {
    return {
      kind: "content",
      content,
      reasoning,
    };
  }

  if (reasoning.length > 0) {
    return {
      kind: "reasoning",
      content: "",
      reasoning,
    };
  }

  return {
    kind: "empty",
    content: "",
    reasoning: "",
  };
}

function extractUpstreamStreamError(payload: Record<string, unknown>): UpstreamStreamError | null {
  const rawError = payload.error;
  if (rawError === null || rawError === undefined) {
    return null;
  }

  if (typeof rawError === "string") {
    const message = rawError.trim();
    return {
      message: message.length > 0 ? message : "upstream stream error",
      details: rawError,
    };
  }

  if (!isRecord(rawError)) {
    return {
      message: "upstream stream error",
      details: rawError,
    };
  }

  return {
    message: normalizeOptionalString(rawError.message)
      ?? normalizeOptionalString(rawError.type)
      ?? "upstream stream error",
    details: rawError,
  };
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
  const beginAt = Date.now();
  const requestConfig = resolveRequestConfig(config, options);
  const url = buildUrl(requestConfig.baseUrl, OPENAI_PATHS.MODELS);
  const headers = toRequestHeaders(requestConfig, requestConfig.reqId, false);
  logGatewayInfo("models list request begin", {
    action: "models.list.begin",
    url,
    options,
  });

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
    const result = {
      ok: true,
      status,
      models: modelsRaw,
      raw,
    };
    logGatewayInfo("models list request complete", {
      action: "models.list.complete",
      result: "ok",
      status: result.status,
      modelCount: result.models.length,
      durationMs: Date.now() - beginAt,
    });
    return result;
  } catch (error) {
    const classified = classifyError(error, {
      reqId: requestConfig.reqId,
      phase: "models-list",
      url,
    });
    const failed = buildModelsResultFromStatus(
      classified.status ?? 0,
      null,
      classified.message,
      classified.type
    );
    logGatewayInfo("models list request failed", {
      action: "models.list.error",
      result: "failed",
      status: failed.status,
      errorType: failed.errorType,
      message: failed.message,
      durationMs: Date.now() - beginAt,
    });
    return failed;
  }
}

async function requestHealthCheck(
  config: RuntimeConfig,
  options: Record<string, unknown> = {}
): Promise<HealthCheckResult> {
  const beginAt = Date.now();
  logGatewayInfo("health check begin", {
    action: "health.check.begin",
    options,
  });
  const models = await requestModelsList(config, options);
  if (models.ok) {
    const result = {
      ok: true,
      status: models.status,
      message: "remote service is healthy",
      raw: models.raw,
    };
    logGatewayInfo("health check complete", {
      action: "health.check.complete",
      result: "ok",
      status: result.status,
      durationMs: Date.now() - beginAt,
    });
    return result;
  }

  const failed = {
    ok: false,
    status: models.status,
    message: models.message ?? "remote health check failed",
    errorType: models.errorType,
    raw: models.raw,
  };
  logGatewayInfo("health check failed", {
    action: "health.check.error",
    result: "failed",
    status: failed.status,
    errorType: failed.errorType ?? null,
    message: failed.message,
    durationMs: Date.now() - beginAt,
  });
  return failed;
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
  logGatewayInfo("chat stream payload built", {
    action: "chat.stream.payload",
    url,
    reqId,
    payload,
  });

  let stream: Readable | null = null;
  let aborted = false;
  let retryCount = 0;
  let dataTimeout: NodeJS.Timeout | null = null;
  let hasVisibleContent = false;
  let sseChunkIndex = 0;
  let contentChunkCount = 0;
  let reasoningOnlyChunkCount = 0;
  let emptyChunkCount = 0;
  const reasoningDiagnostics = createReasoningDiagnostics();
  let reasoningDiagnosticsFlushed = false;
  const controller = new AbortController();

  const clearDataTimeout = (): void => {
    if (dataTimeout) {
      clearTimeout(dataTimeout);
      dataTimeout = null;
    }
  };

  const emitTerminalEvent = (): void => {
    flushReasoningDiagnostics("stream_terminal");
    logGatewayInfo("chat stream terminal event", {
      action: "chat.stream.terminal",
      reqId,
      hasVisibleContent,
      sseChunkIndex,
      contentChunkCount,
      reasoningOnlyChunkCount,
      emptyChunkCount,
    });

    if (hasVisibleContent) {
      emitter.emit("end");
      return;
    }

    emitter.emit("error", createTypedError({
      type: "parse_error",
      message: "chat stream ended without visible content",
      reqId,
      phase: "chat-stream-empty-content",
      url,
    }));
  };

  const flushReasoningDiagnostics = (reason: string): void => {
    if (reasoningDiagnosticsFlushed) {
      return;
    }
    reasoningDiagnosticsFlushed = true;

    if (reasoningDiagnostics.chunkCount === 0) {
      logger.info("chat stream reasoning summary", {
        reason,
        chunkCount: 0,
        totalLength: 0,
      });
      return;
    }

    logger.info("chat stream reasoning summary", {
      reason,
      chunkCount: reasoningDiagnostics.chunkCount,
      totalLength: reasoningDiagnostics.totalLength,
      firstChunkIndex: reasoningDiagnostics.firstChunkIndex,
      snippets: reasoningDiagnostics.snippets,
    });
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
            emitTerminalEvent();
            controller.abort();
            stream?.destroy();
            return;
          }

          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;
            sseChunkIndex += 1;
            const upstreamError = extractUpstreamStreamError(parsed);
            if (upstreamError) {
              clearDataTimeout();
              if (aborted) {
                return;
              }

              aborted = true;
              flushReasoningDiagnostics("upstream_error_payload");
              emitter.emit("error", createTypedError({
                type: "server_error",
                message: upstreamError.message,
                reqId,
                phase: "chat-stream-upstream-error",
                url,
                details: upstreamError.details,
              }));
              controller.abort();
              stream?.destroy();
              return;
            }

            const normalized = normalizeCompletionChunk(parsed);
            const chunk = classifyStreamChunk(normalized);
            if (chunk.kind === "empty") {
              emptyChunkCount += 1;
              continue;
            }

            if (chunk.reasoning.length > 0) {
              trackReasoningChunk(reasoningDiagnostics, chunk.reasoning, sseChunkIndex);
            }

            if (chunk.kind === "content") {
              hasVisibleContent = true;
              contentChunkCount += 1;
              emitter.emit("data", chunk.content, normalized, chunk.reasoning || null);
              continue;
            }

            // 中英註解：reasoning-only chunk 保留內部語義，content 仍保持空字串。
            // EN: reasoning-only chunk stays internal; visible content remains empty.
            reasoningOnlyChunkCount += 1;
            emitter.emit("data", "", normalized, chunk.reasoning || null);
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
        logGatewayInfo("chat stream end event", {
          action: "chat.stream.end-event",
          reqId,
          sseChunkIndex,
          contentChunkCount,
          reasoningOnlyChunkCount,
          emptyChunkCount,
        });
        emitTerminalEvent();
      });

      stream.on("error", (error) => {
        clearDataTimeout();
        if (aborted) {
          return;
        }
        aborted = true;
        flushReasoningDiagnostics("stream_error");
        logGatewayInfo("chat stream error event", {
          action: "chat.stream.error-event",
          reqId,
          sseChunkIndex,
          contentChunkCount,
          reasoningOnlyChunkCount,
          emptyChunkCount,
          error: error instanceof Error ? error.message : String(error),
        });
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
      flushReasoningDiagnostics("request_error");
      logGatewayInfo("chat stream request failed", {
        action: "chat.stream.error",
        reqId,
        retryCount,
        sseChunkIndex,
        contentChunkCount,
        reasoningOnlyChunkCount,
        emptyChunkCount,
        error: error instanceof Error ? error.message : String(error),
      });
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
    flushReasoningDiagnostics("abort");
    logGatewayInfo("chat stream abort invoked", {
      action: "chat.stream.abort",
      reqId,
      retryCount,
      sseChunkIndex,
      contentChunkCount,
      reasoningOnlyChunkCount,
      emptyChunkCount,
    });
    emitter.emit("abort");
  };

  return emitter;
}

export default {
  method: METHOD_REMOTE,

  async online(options: StrategyOnlineOptions): Promise<void> {
    const beginAt = Date.now();
    logGatewayInfo("llm-remote-gateway online begin", {
      action: "online.begin",
      options,
    });
    runtimeConfig = resolveOnlineConfig(options);
    online = true;
    logger.info("llm-remote-gateway online", {
      baseUrl: runtimeConfig.baseUrl,
      model: runtimeConfig.model,
    });
    logGatewayInfo("llm-remote-gateway online complete", {
      action: "online.complete",
      result: "ok",
      baseUrl: runtimeConfig.baseUrl,
      model: runtimeConfig.model,
      durationMs: Date.now() - beginAt,
    });
  },

  async offline(): Promise<void> {
    const beginAt = Date.now();
    logGatewayInfo("llm-remote-gateway offline begin", {
      action: "offline.begin",
    });
    runtimeConfig = null;
    online = false;
    logger.info("llm-remote-gateway offline");
    logGatewayInfo("llm-remote-gateway offline complete", {
      action: "offline.complete",
      result: "ok",
      durationMs: Date.now() - beginAt,
    });
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    const beginAt = Date.now();
    logGatewayInfo("llm-remote-gateway restart begin", {
      action: "restart.begin",
      options,
    });
    await this.offline();
    await this.online(options);
    logger.info("llm-remote-gateway restarted");
    logGatewayInfo("llm-remote-gateway restart complete", {
      action: "restart.complete",
      result: "ok",
      durationMs: Date.now() - beginAt,
    });
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

  async streamChat(input: RemoteSendOptions): Promise<ChatStreamEmitter> {
    if (!runtimeConfig || !online) {
      throw new Error("remote strategy is not online");
    }

    const normalized = normalizeChatInput(input);
    logGatewayInfo("streamChat begin", {
      action: "stream-chat.begin",
      input: normalized,
    });
    const emitter = createChatEmitter(runtimeConfig, normalized);
    logGatewayInfo("streamChat emitter created", {
      action: "stream-chat.complete",
      result: "ok",
    });
    return emitter;
  },

  async listModels(input: Record<string, unknown> = {}): Promise<ModelsListResult> {
    if (!runtimeConfig || !online) {
      throw new Error("remote strategy is not online");
    }

    logGatewayInfo("listModels begin", {
      action: "list-models.begin",
      input,
    });
    const result = await requestModelsList(runtimeConfig, isRecord(input) ? input : {});
    logGatewayInfo("listModels complete", {
      action: "list-models.complete",
      result: result.ok ? "ok" : "failed",
      status: result.status,
      modelCount: result.models.length,
      errorType: result.errorType ?? null,
      message: result.message ?? null,
    });
    return result;
  },

  async checkHealth(input: Record<string, unknown> = {}): Promise<HealthCheckResult> {
    if (!runtimeConfig || !online) {
      throw new Error("remote strategy is not online");
    }

    logGatewayInfo("checkHealth begin", {
      action: "check-health.begin",
      input,
    });
    const result = await requestHealthCheck(runtimeConfig, isRecord(input) ? input : {});
    logGatewayInfo("checkHealth complete", {
      action: "check-health.complete",
      result: result.ok ? "ok" : "failed",
      status: result.status,
      errorType: result.errorType ?? null,
      message: result.message,
    });
    return result;
  },

  async send(options: SendOptions): Promise<unknown> {
    if (!runtimeConfig || !online) {
      throw new Error("remote strategy is not online");
    }

    const action = resolveAction(options as RemoteSendOptions);
    logGatewayInfo("send route begin", {
      action: "send.route.begin",
      route: action,
      options: isRecord(options) ? options : { value: options },
    });

    switch (action) {
      case "chat.stream":
        return this.streamChat(options as RemoteSendOptions);
      case "models.list":
        return this.listModels(isRecord(options) ? options : {});
      case "health.check":
        return this.checkHealth(isRecord(options) ? options : {});
      default:
        throw new Error(`unsupported action: ${String(action)}`);
    }
  },
};
