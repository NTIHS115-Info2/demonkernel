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
    return `conversation:${conversationId}`;
  }

  const userId = normalizeOptionalString(scope.userId);
  if (userId) {
    return `user:${userId}`;
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
    return cached;
  }

  const filePath = resolveHistoryFilePath(scopeKey);
  try {
    const content = await fsPromises.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);
    const sanitized = sanitizeLoadedMessages(parsed);
    runtime.cache.set(scopeKey, sanitized);
    return sanitized;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ENOENT") {
      logger.error("history load failed", {
        scopeKey,
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    runtime.cache.set(scopeKey, []);
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
    return;
  }

  if (runtime.config.backupCount <= 0) {
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
}

async function saveMessages(scopeKey: string): Promise<void> {
  const filePath = resolveHistoryFilePath(scopeKey);
  const messages = runtime.cache.get(scopeKey) ?? [];

  await ensureHistoryDirectory();
  await rotateIfNeeded(filePath);

  await fsPromises.writeFile(filePath, JSON.stringify(messages, null, 2), "utf-8");
}

function applyPruneToCache(scopeKey: string): void {
  const current = runtime.cache.get(scopeKey) ?? [];
  const pruned = pruneMessages(current);
  runtime.cache.set(scopeKey, pruned);
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
  const scopeKey = ensureScope(input);
  const role = normalizeRole(input.role);
  const content = normalizeContent(input.content);

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
}

async function getRecentInternal(scope: ConversationScopeInput, limit?: unknown): Promise<ConversationHistoryMessage[]> {
  const scopeKey = ensureScope(scope);
  return runScopeExclusive(scopeKey, async () => {
    await loadMessages(scopeKey);

    applyPruneToCache(scopeKey);
    await saveMessages(scopeKey);

    const history = runtime.cache.get(scopeKey) ?? [];
    const normalizedLimit = resolveRecentLimit(limit);
    if (!normalizedLimit) {
      return [...history];
    }

    return history.slice(-normalizedLimit);
  });
}

async function clearInternal(scope: ConversationScopeInput): Promise<void> {
  const scopeKey = ensureScope(scope);
  await runScopeExclusive(scopeKey, async () => {
    runtime.cache.set(scopeKey, []);

    const filePath = resolveHistoryFilePath(scopeKey);
    try {
      await deleteScopeHistoryFiles(filePath);
    } catch (error) {
      logger.error("history clear failed", {
        scopeKey,
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

export default {
  method: METHOD_LOCAL,

  async online(options: StrategyOnlineOptions): Promise<void> {
    const typedOptions = (isRecord(options) ? options : {}) as ConversationHistoryOnlineOptions;
    assertLocalMethod(typedOptions.method ?? METHOD_LOCAL, "online");

    runtime.config = normalizeRuntimeConfig(options);
    runtime.cache.clear();
    runtime.scopeLocks.clear();
    runtime.online = true;

    await ensureHistoryDirectory();

    logger.info("conversation-history online", {
      historyDir: runtime.config.historyDir,
      maxMessages: runtime.config.maxMessages,
      expireDays: runtime.config.expireDays,
      backupCount: runtime.config.backupCount,
      maxFileSize: runtime.config.maxFileSize,
    });
  },

  async offline(): Promise<void> {
    runtime.online = false;
    runtime.cache.clear();
    runtime.scopeLocks.clear();
    logger.info("conversation-history offline");
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    await this.offline();
    await this.online(options);
    logger.info("conversation-history restarted");
  },

  async state(): Promise<StateResult> {
    if (!runtime.online) {
      return { status: 0 };
    }
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

    const action = normalizeOptionalString(input.action);
    if (!action || !(action in HISTORY_ACTION_ALIAS_TO_OPERATION)) {
      throw new Error(`unsupported action: ${String(input.action)}`);
    }

    const operation = HISTORY_ACTION_ALIAS_TO_OPERATION[action];
    if (operation === "append") {
      await appendInternal(input);
      return null;
    }
    if (operation === "recent") {
      return getRecentInternal(input, input.limit);
    }

    await clearInternal(input);
    return null;
  },
};
