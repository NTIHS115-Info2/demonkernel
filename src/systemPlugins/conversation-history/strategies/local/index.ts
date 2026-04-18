import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

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

import {
  DEFAULT_BACKUP_COUNT,
  DEFAULT_EXPIRE_DAYS,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_MESSAGES,
  HISTORY_ACTION_ALIAS_TO_OPERATION,
  METHOD_LOCAL,
} from "./constants";
import type {
  ConversationHistoryAppendInput,
  ConversationHistoryConfig,
  ConversationHistoryMessage,
  ConversationHistoryOnlineOptions,
  ConversationHistorySendInput,
  ConversationRole,
  ConversationScopeInput,
} from "./types";

const logger = createKernelLogger("plugin-conversation-history-local", {
  plugin: "conversation-history",
  type: "system",
  strategy: "local",
});

function logHistoryInfo(message: string, meta: Record<string, unknown> = {}): void {
  const hasObservability = isRecord(meta.observability);
  logger.info(
    message,
    withObservability(
      {
        stage: "conversation-history",
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

function logHistoryWarn(message: string, meta: Record<string, unknown> = {}): void {
  const hasObservability = isRecord(meta.observability);
  logger.warn(
    message,
    withObservability(
      {
        stage: "conversation-history",
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

function logHistoryError(message: string, meta: Record<string, unknown> = {}): void {
  const hasObservability = isRecord(meta.observability);
  logger.error(
    message,
    withObservability(
      {
        stage: "conversation-history",
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

function logHistoryRaw(
  message: string,
  requestId: string,
  eventType: string,
  meta: Record<string, unknown> = {}
): void {
  logger.info(
    message,
    withObservability(
      {
        stage: "conversation-history",
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

function createHistoryRequestId(
  scope: string,
  seed: {
    requestId?: string | null;
    conversationId?: string | null;
    userId?: string | null;
  } = {}
): string {
  return createObservabilityRequestId(`conversation-history:${scope}`, {
    requestId: seed.requestId,
    conversationId: seed.conversationId,
    userId: seed.userId,
  });
}

const VALID_ROLES = new Set<ConversationRole>(["system", "user", "assistant", "tool"]);

type LocalRuntime = {
  online: boolean;
  config: ConversationHistoryConfig;
  cache: Map<string, ConversationHistoryMessage[]>;
  scopeLocks: Map<string, Promise<void>>;
};

let runtime: LocalRuntime = {
  online: false,
  config: {
    historyDir: path.resolve(process.cwd(), "history"),
    maxMessages: DEFAULT_MAX_MESSAGES,
    expireDays: DEFAULT_EXPIRE_DAYS,
    backupCount: DEFAULT_BACKUP_COUNT,
    maxFileSize: DEFAULT_MAX_FILE_SIZE,
  },
  cache: new Map(),
  scopeLocks: new Map(),
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

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.floor(parsed);
  if (normalized <= 0) {
    return fallback;
  }

  return normalized;
}

function normalizeNonNegativeInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.floor(parsed);
  if (normalized < 0) {
    return fallback;
  }

  return normalized;
}

function assertLocalMethod(method: unknown, operation: string): void {
  if (method !== METHOD_LOCAL) {
    throw new Error(`${operation} requires method="local"`);
  }
}

function ensureOnline(): void {
  if (!runtime.online) {
    throw new Error("conversation-history local strategy is not online");
  }
}

function resolveScopeKey(scope: ConversationScopeInput): string {
  const conversationId = normalizeOptionalString(scope.conversationId);
  if (conversationId) {
    const key = `conversation:${conversationId}`;
    logHistoryInfo("resolve scope key by conversationId", {
      action: "scope.resolve",
      conversationId,
      scopeKey: key,
    });
    return key;
  }

  const userId = normalizeOptionalString(scope.userId);
  if (userId) {
    const key = `user:${userId}`;
    logHistoryInfo("resolve scope key by userId", {
      action: "scope.resolve",
      userId,
      scopeKey: key,
    });
    return key;
  }

  throw new Error("conversation history requires conversationId or userId");
}

function resolveHistoryFilePath(scopeKey: string): string {
  const safeName = scopeKey.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(runtime.config.historyDir, `${safeName}.json`);
}

function normalizeRole(value: unknown): ConversationRole {
  if (typeof value !== "string" || !VALID_ROLES.has(value as ConversationRole)) {
    throw new Error(`conversation history role is invalid: ${String(value)}`);
  }

  return value as ConversationRole;
}

function normalizeContent(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("conversation history content must be a string");
  }

  if (value.length === 0) {
    throw new Error("conversation history content must not be empty");
  }

  return value;
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber;
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function sanitizeLoadedMessages(value: unknown): ConversationHistoryMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sanitized: ConversationHistoryMessage[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const role = item.role;
    const content = item.content;
    const timestamp = normalizeTimestamp(item.timestamp);

    if (typeof role !== "string" || !VALID_ROLES.has(role as ConversationRole)) {
      continue;
    }
    if (typeof content !== "string" || content.length === 0) {
      continue;
    }
    if (!timestamp) {
      continue;
    }

    sanitized.push({
      role: role as ConversationRole,
      content,
      timestamp,
    });
  }

  return sanitized;
}

function pruneMessages(messages: ConversationHistoryMessage[]): ConversationHistoryMessage[] {
  const now = Date.now();
  const expireMs = runtime.config.expireDays * 24 * 60 * 60 * 1000;
  const notExpired = messages.filter((message) => now - message.timestamp <= expireMs);
  return notExpired.slice(-runtime.config.maxMessages);
}

async function ensureHistoryDirectory(): Promise<void> {
  await fsPromises.mkdir(runtime.config.historyDir, { recursive: true });
}

async function loadMessages(scopeKey: string): Promise<ConversationHistoryMessage[]> {
  const cached = runtime.cache.get(scopeKey);
  if (cached) {
    logHistoryInfo("history load cache hit", {
      action: "load.cache-hit",
      scopeKey,
      cachedCount: cached.length,
    });
    return cached;
  }

  const filePath = resolveHistoryFilePath(scopeKey);
  try {
    const content = await fsPromises.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);
    const sanitized = sanitizeLoadedMessages(parsed);
    runtime.cache.set(scopeKey, sanitized);
    logHistoryInfo("history load file success", {
      action: "load.file",
      scopeKey,
      filePath,
      loadedCount: sanitized.length,
    });
    return sanitized;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ENOENT") {
      logHistoryError("history load failed", {
        action: "load.file.error",
        scopeKey,
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    runtime.cache.set(scopeKey, []);
    logHistoryInfo("history load file fallback empty", {
      action: "load.file",
      scopeKey,
      filePath,
      result: "fallback-empty",
    });
    return runtime.cache.get(scopeKey) as ConversationHistoryMessage[];
  }
}

async function moveWithOverwrite(fromPath: string, toPath: string): Promise<void> {
  try {
    await fsPromises.unlink(toPath);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
  await fsPromises.rename(fromPath, toPath);
}

async function rotateIfNeeded(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const stats = await fsPromises.stat(filePath);
  if (stats.size < runtime.config.maxFileSize) {
    logHistoryInfo("history rotate skipped by size", {
      action: "rotate.skip",
      filePath,
      fileSize: stats.size,
      maxFileSize: runtime.config.maxFileSize,
    });
    return;
  }

  if (runtime.config.backupCount <= 0) {
    logHistoryInfo("history rotate skipped by backupCount", {
      action: "rotate.skip",
      filePath,
      backupCount: runtime.config.backupCount,
    });
    return;
  }

  for (let index = runtime.config.backupCount; index > 1; index -= 1) {
    const oldBackup = `${filePath}.${index - 1}`;
    const newBackup = `${filePath}.${index}`;
    if (fs.existsSync(oldBackup)) {
      await moveWithOverwrite(oldBackup, newBackup);
    }
  }

  await moveWithOverwrite(filePath, `${filePath}.1`);
  logHistoryInfo("history rotate complete", {
    action: "rotate.complete",
    filePath,
    backupCount: runtime.config.backupCount,
  });
}

async function saveMessages(scopeKey: string): Promise<void> {
  const filePath = resolveHistoryFilePath(scopeKey);
  const messages = runtime.cache.get(scopeKey) ?? [];
  logHistoryInfo("history save begin", {
    action: "save.begin",
    scopeKey,
    filePath,
    messageCount: messages.length,
  });

  await ensureHistoryDirectory();
  await rotateIfNeeded(filePath);

  await fsPromises.writeFile(filePath, JSON.stringify(messages, null, 2), "utf-8");
  logHistoryInfo("history save complete", {
    action: "save.complete",
    scopeKey,
    filePath,
    messageCount: messages.length,
  });
}

function applyPruneToCache(scopeKey: string): void {
  const current = runtime.cache.get(scopeKey) ?? [];
  const pruned = pruneMessages(current);
  runtime.cache.set(scopeKey, pruned);
  logHistoryInfo("history prune cache", {
    action: "cache.prune",
    scopeKey,
    beforeCount: current.length,
    afterCount: pruned.length,
  });
}

function normalizeRuntimeConfig(options: StrategyOnlineOptions): ConversationHistoryConfig {
  const typedOptions = (isRecord(options) ? options : {}) as ConversationHistoryOnlineOptions;
  const historyDir = normalizeOptionalString(typedOptions.historyDir) ?? path.resolve(process.cwd(), "history");

  return {
    historyDir: path.resolve(historyDir),
    maxMessages: normalizePositiveInteger(typedOptions.maxMessages, DEFAULT_MAX_MESSAGES),
    expireDays: normalizePositiveInteger(typedOptions.expireDays, DEFAULT_EXPIRE_DAYS),
    backupCount: normalizeNonNegativeInteger(typedOptions.backupCount, DEFAULT_BACKUP_COUNT),
    maxFileSize: normalizePositiveInteger(typedOptions.maxFileSize, DEFAULT_MAX_FILE_SIZE),
  };
}

function normalizeLimit(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  const normalized = Math.floor(parsed);
  if (normalized <= 0) {
    return undefined;
  }

  return normalized;
}

function resolveRecentLimit(limit: unknown): number | undefined {
  if (limit === undefined) {
    return undefined;
  }

  return normalizeLimit(limit);
}

function ensureScope(scope: ConversationScopeInput): string {
  if (!isRecord(scope)) {
    throw new Error("conversation history scope must be an object");
  }
  return resolveScopeKey(scope);
}

async function runScopeExclusive<T>(scopeKey: string, operation: () => Promise<T>): Promise<T> {
  const previous = runtime.scopeLocks.get(scopeKey) ?? Promise.resolve();

  let resolveCurrentLock!: () => void;
  const currentLock = new Promise<void>((resolve) => {
    resolveCurrentLock = resolve;
  });

  const chainedLock = previous.catch(() => undefined).then(() => currentLock);
  runtime.scopeLocks.set(scopeKey, chainedLock);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    resolveCurrentLock();
    if (runtime.scopeLocks.get(scopeKey) === chainedLock) {
      runtime.scopeLocks.delete(scopeKey);
    }
  }
}

async function deleteScopeHistoryFiles(filePath: string): Promise<void> {
  const directoryPath = path.dirname(filePath);
  const baseName = path.basename(filePath);

  let fileNames: string[] = [];
  try {
    fileNames = await fsPromises.readdir(directoryPath);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const fileName of fileNames) {
    if (fileName === baseName) {
      try {
        await fsPromises.unlink(path.join(directoryPath, fileName));
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "ENOENT") {
          throw error;
        }
      }
      continue;
    }

    if (!fileName.startsWith(`${baseName}.`)) {
      continue;
    }

    const suffix = fileName.slice(baseName.length + 1);
    if (!/^\d+$/.test(suffix)) {
      continue;
    }

    try {
      await fsPromises.unlink(path.join(directoryPath, fileName));
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  }
}

async function appendInternal(input: ConversationHistoryAppendInput): Promise<void> {
  const beginAt = Date.now();
  const scopeKey = ensureScope(input);
  const requestIdSeed = isRecord(input)
    ? normalizeOptionalString((input as Record<string, unknown>).reqId)
    : null;
  const requestId = createHistoryRequestId("append", {
    requestId: requestIdSeed,
    conversationId: normalizeOptionalString(input.conversationId),
    userId: normalizeOptionalString(input.userId),
  });
  const role = normalizeRole(input.role);
  const content = normalizeContent(input.content);
  logHistoryInfo("history append begin", {
    action: "append.begin",
    requestId,
    scopeKey,
    role,
    content: summarizeText(content, 160),
    observability: {
      kind: "node",
      requestId,
      eventType: "append.begin",
    },
  });
  logHistoryRaw("history append raw content", requestId, "append.content.raw", {
    content,
  });

  try {
    await runScopeExclusive(scopeKey, async () => {
      const history = await loadMessages(scopeKey);
      history.push({
        role,
        content,
        timestamp: Date.now(),
      });

      applyPruneToCache(scopeKey);
      await saveMessages(scopeKey);
    });
    logHistoryInfo("history append complete", {
      action: "append.complete",
      requestId,
      scopeKey,
      role,
      durationMs: Date.now() - beginAt,
      observability: {
        kind: "node",
        requestId,
        eventType: "append.complete",
        outcome: "success",
      },
    });
  } catch (error) {
    logHistoryError("history append failed", {
      action: "append.error",
      requestId,
      scopeKey,
      role,
      error: error instanceof Error ? error.message : String(error),
      observability: {
        kind: "node",
        requestId,
        eventType: "append.complete",
        outcome: "error",
      },
    });
    throw error;
  }
}

async function getRecentInternal(scope: ConversationScopeInput, limit?: unknown): Promise<ConversationHistoryMessage[]> {
  const beginAt = Date.now();
  const scopeKey = ensureScope(scope);
  const requestId = createHistoryRequestId("recent", {
    requestId: isRecord(scope)
      ? normalizeOptionalString((scope as Record<string, unknown>).reqId)
      : null,
    conversationId: normalizeOptionalString(scope.conversationId),
    userId: normalizeOptionalString(scope.userId),
  });
  logHistoryInfo("history recent begin", {
    action: "recent.begin",
    requestId,
    scopeKey,
    limit: limit ?? null,
    observability: {
      kind: "node",
      requestId,
      eventType: "recent.begin",
    },
  });
  return runScopeExclusive(scopeKey, async () => {
    await loadMessages(scopeKey);

    applyPruneToCache(scopeKey);
    await saveMessages(scopeKey);

    const history = runtime.cache.get(scopeKey) ?? [];
    const normalizedLimit = resolveRecentLimit(limit);
    if (!normalizedLimit) {
      logHistoryInfo("history recent complete", {
        action: "recent.complete",
        requestId,
        scopeKey,
        resultCount: history.length,
        durationMs: Date.now() - beginAt,
        observability: {
          kind: "node",
          requestId,
          eventType: "recent.complete",
          outcome: "success",
        },
      });
      return [...history];
    }
    const result = history.slice(-normalizedLimit);
    logHistoryInfo("history recent complete", {
      action: "recent.complete",
      requestId,
      scopeKey,
      resultCount: result.length,
      requestedLimit: normalizedLimit,
      durationMs: Date.now() - beginAt,
      observability: {
        kind: "node",
        requestId,
        eventType: "recent.complete",
        outcome: "success",
      },
    });
    return result;
  });
}

async function clearInternal(scope: ConversationScopeInput): Promise<void> {
  const beginAt = Date.now();
  const scopeKey = ensureScope(scope);
  const requestId = createHistoryRequestId("clear", {
    requestId: isRecord(scope)
      ? normalizeOptionalString((scope as Record<string, unknown>).reqId)
      : null,
    conversationId: normalizeOptionalString(scope.conversationId),
    userId: normalizeOptionalString(scope.userId),
  });
  logHistoryInfo("history clear begin", {
    action: "clear.begin",
    requestId,
    scopeKey,
    observability: {
      kind: "node",
      requestId,
      eventType: "clear.begin",
    },
  });
  await runScopeExclusive(scopeKey, async () => {
    runtime.cache.set(scopeKey, []);

    const filePath = resolveHistoryFilePath(scopeKey);
    try {
      await deleteScopeHistoryFiles(filePath);
    } catch (error) {
      logHistoryError("history clear failed", {
        action: "clear.error",
        requestId,
        scopeKey,
        filePath,
        error: error instanceof Error ? error.message : String(error),
        observability: {
          kind: "node",
          requestId,
          eventType: "clear.complete",
          outcome: "error",
        },
      });
    }
  });
  logHistoryInfo("history clear complete", {
    action: "clear.complete",
    requestId,
    scopeKey,
    durationMs: Date.now() - beginAt,
    observability: {
      kind: "node",
      requestId,
      eventType: "clear.complete",
      outcome: "success",
    },
  });
}

export default {
  method: METHOD_LOCAL,

  async online(options: StrategyOnlineOptions): Promise<void> {
    const beginAt = Date.now();
    const requestId = createHistoryRequestId("online", {
      requestId: normalizeOptionalString(isRecord(options) ? options.reqId : null),
    });
    logHistoryInfo("conversation-history online begin", {
      action: "online.begin",
      requestId,
      optionsSummary: summarizeUnknown(options),
      observability: {
        kind: "node",
        requestId,
        eventType: "online.begin",
      },
    });
    logHistoryRaw("conversation-history online raw options", requestId, "online.options.raw", {
      options: isRecord(options) ? options : { value: options },
    });
    const typedOptions = (isRecord(options) ? options : {}) as ConversationHistoryOnlineOptions;
    assertLocalMethod(typedOptions.method ?? METHOD_LOCAL, "online");

    runtime.config = normalizeRuntimeConfig(options);
    runtime.cache.clear();
    runtime.scopeLocks.clear();
    runtime.online = true;

    await ensureHistoryDirectory();

    logHistoryInfo("conversation-history online", {
      action: "online.state",
      requestId,
      historyDir: runtime.config.historyDir,
      maxMessages: runtime.config.maxMessages,
      expireDays: runtime.config.expireDays,
      backupCount: runtime.config.backupCount,
      maxFileSize: runtime.config.maxFileSize,
      observability: {
        kind: "node",
        requestId,
        eventType: "online.state",
      },
    });
    logHistoryInfo("conversation-history online complete", {
      action: "online.complete",
      requestId,
      result: "ok",
      config: summarizeUnknown(runtime.config),
      durationMs: Date.now() - beginAt,
      observability: {
        kind: "node",
        requestId,
        eventType: "online.complete",
        outcome: "success",
      },
    });
  },

  async offline(): Promise<void> {
    const beginAt = Date.now();
    const requestId = createHistoryRequestId("offline");
    logHistoryInfo("conversation-history offline begin", {
      action: "offline.begin",
      requestId,
      observability: {
        kind: "node",
        requestId,
        eventType: "offline.begin",
      },
    });
    runtime.online = false;
    runtime.cache.clear();
    runtime.scopeLocks.clear();
    logHistoryInfo("conversation-history offline", {
      action: "offline.state",
      requestId,
      observability: {
        kind: "node",
        requestId,
        eventType: "offline.state",
      },
    });
    logHistoryInfo("conversation-history offline complete", {
      action: "offline.complete",
      requestId,
      result: "ok",
      durationMs: Date.now() - beginAt,
      observability: {
        kind: "node",
        requestId,
        eventType: "offline.complete",
        outcome: "success",
      },
    });
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    const beginAt = Date.now();
    const requestId = createHistoryRequestId("restart", {
      requestId: normalizeOptionalString(isRecord(options) ? options.reqId : null),
    });
    logHistoryInfo("conversation-history restart begin", {
      action: "restart.begin",
      requestId,
      optionsSummary: summarizeUnknown(options),
      observability: {
        kind: "node",
        requestId,
        eventType: "restart.begin",
      },
    });
    logHistoryRaw("conversation-history restart raw options", requestId, "restart.options.raw", {
      options: isRecord(options) ? options : { value: options },
    });
    await this.offline();
    await this.online(options);
    logHistoryInfo("conversation-history restarted", {
      action: "restart.state",
      requestId,
      observability: {
        kind: "node",
        requestId,
        eventType: "restart.state",
      },
    });
    logHistoryInfo("conversation-history restart complete", {
      action: "restart.complete",
      requestId,
      result: "ok",
      durationMs: Date.now() - beginAt,
      observability: {
        kind: "node",
        requestId,
        eventType: "restart.complete",
        outcome: "success",
      },
    });
  },

  async state(): Promise<StateResult> {
    logHistoryInfo("conversation-history state begin", {
      action: "state.begin",
      online: runtime.online,
    });
    if (!runtime.online) {
      logHistoryInfo("conversation-history state complete", {
        action: "state.complete",
        status: 0,
      });
      return { status: 0 };
    }
    logHistoryInfo("conversation-history state complete", {
      action: "state.complete",
      status: 1,
    });
    return { status: 1 };
  },

  async appendMessage(input: SendOptions): Promise<void> {
    ensureOnline();
    await appendInternal(input as ConversationHistoryAppendInput);
  },

  async getRecentMessages(scope: ConversationScopeInput, limit?: number): Promise<ConversationHistoryMessage[]> {
    ensureOnline();
    return getRecentInternal(scope, limit);
  },

  async clearConversation(scope: ConversationScopeInput): Promise<void> {
    ensureOnline();
    await clearInternal(scope);
  },

  async send(options: SendOptions): Promise<unknown> {
    ensureOnline();
    const input = (isRecord(options) ? options : {}) as ConversationHistorySendInput;
    const requestId = createHistoryRequestId("send", {
      requestId: normalizeOptionalString(isRecord(options) ? options.reqId : null),
      conversationId: normalizeOptionalString(input.conversationId),
      userId: normalizeOptionalString(input.userId),
    });
    logHistoryInfo("conversation-history send begin", {
      action: "send.begin",
      requestId,
      input: summarizeUnknown(input),
      observability: {
        kind: "node",
        requestId,
        eventType: "send.begin",
      },
    });
    logHistoryRaw("conversation-history send raw input", requestId, "send.input.raw", {
      input,
    });

    const action = normalizeOptionalString(input.action);
    if (!action || !(action in HISTORY_ACTION_ALIAS_TO_OPERATION)) {
      logHistoryWarn("conversation-history send invalid action", {
        action: "send.error",
        requestId,
        inputAction: String(input.action),
        observability: {
          kind: "node",
          requestId,
          eventType: "send.complete",
          outcome: "error",
        },
      });
      throw new Error(`unsupported action: ${String(input.action)}`);
    }

    const operation = HISTORY_ACTION_ALIAS_TO_OPERATION[action];
    if (operation === "append") {
      await appendInternal(input);
      logHistoryInfo("conversation-history send complete", {
        action: "send.complete",
        requestId,
        operation,
        result: "ok",
        observability: {
          kind: "node",
          requestId,
          eventType: "send.complete",
          outcome: "success",
        },
      });
      return null;
    }
    if (operation === "recent") {
      const result = await getRecentInternal(input, input.limit);
      logHistoryInfo("conversation-history send complete", {
        action: "send.complete",
        requestId,
        operation,
        resultCount: result.length,
        result: "ok",
        observability: {
          kind: "node",
          requestId,
          eventType: "send.complete",
          outcome: "success",
        },
      });
      return result;
    }

    await clearInternal(input);
    logHistoryInfo("conversation-history send complete", {
      action: "send.complete",
      requestId,
      operation,
      result: "ok",
      observability: {
        kind: "node",
        requestId,
        eventType: "send.complete",
        outcome: "success",
      },
    });
    return null;
  },
};
