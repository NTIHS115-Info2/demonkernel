"use strict";

const path = require("node:path");
const {
  LEVELS,
  DEFAULT_LEVEL,
  normalizeLevel,
  isLevelEnabled,
  resolveLevelList,
} = require("./lib/levels");
const { DEFAULT_REDACTION_PATTERNS } = require("./lib/redaction");
const { buildRecord } = require("./lib/serializer");
const { createLogSession } = require("./lib/session");
const { createTransportFactory, sanitizeLoggerName } = require("./lib/transports");
const { compressPreviousSessions } = require("./lib/compress");

const OBSERVABILITY_OUTCOMES = new Set(["success", "error", "abort", "timeout"]);
const OBSERVABILITY_EXPORT_OUTCOMES = new Set(["error", "abort", "timeout"]);

function parseBooleanEnv(name, fallback = false) {
  const raw = process.env[name];
  if (typeof raw !== "string") {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function buildDefaultConfig() {
  return {
    rootDir: path.resolve(__dirname, "..", "..", "logs"),
    level: DEFAULT_LEVEL,
    consoleEnabled: true,
    consoleLevels: ["warn", "error", "fatal"],
    redaction: {
      enabled: true,
      patterns: [...DEFAULT_REDACTION_PATTERNS],
    },
    observability: {
      diagnosticRingSize: 50,
      diagnosticPreviewChars: 160,
      rawDirectExport: false,
    },
  };
}

function isRawDirectExportEnabled() {
  return parseBooleanEnv("LOG_STREAM_RAW", false) || state.config.observability.rawDirectExport;
}

const state = {
  initialized: false,
  sessionName: "",
  sessionPath: "",
  transportFactory: null,
  compressionTask: Promise.resolve(),
  diagnosticBufferByRequestId: new Map(),
  config: buildDefaultConfig(),
};

function levelsFromMinimum(level) {
  const min = normalizeLevel(level, "warn");
  return Object.keys(LEVELS).filter((item) => isLevelEnabled(item, min));
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePositiveInteger(value, fallback) {
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

function normalizeConfigPatch(options = {}) {
  const patch = {};

  if (options.rootDir) {
    patch.rootDir = path.resolve(String(options.rootDir));
  }

  if (options.level) {
    patch.level = normalizeLevel(options.level, DEFAULT_LEVEL);
  }

  if (Object.prototype.hasOwnProperty.call(options, "redact")) {
    patch.redaction = {
      enabled: Boolean(options.redact),
      patterns: state.config.redaction.patterns,
    };
  }

  if (Array.isArray(options.redactionPatterns) && options.redactionPatterns.length > 0) {
    const enabled =
      patch.redaction && typeof patch.redaction.enabled === "boolean"
        ? patch.redaction.enabled
        : state.config.redaction.enabled;
    patch.redaction = {
      enabled,
      patterns: options.redactionPatterns.filter((item) => item instanceof RegExp),
    };
  }

  if (options.console && typeof options.console === "object") {
    patch.consoleEnabled = Object.prototype.hasOwnProperty.call(
      options.console,
      "enabled"
    )
      ? Boolean(options.console.enabled)
      : state.config.consoleEnabled;

    if (Array.isArray(options.console.levels)) {
      patch.consoleLevels = resolveLevelList(
        options.console.levels,
        state.config.consoleLevels
      );
    } else if (options.console.level) {
      patch.consoleLevels = levelsFromMinimum(options.console.level);
    }
  }

  if (options.observability && typeof options.observability === "object") {
    const next = {
      ...state.config.observability,
    };

    if (Object.prototype.hasOwnProperty.call(options.observability, "diagnosticRingSize")) {
      next.diagnosticRingSize = normalizePositiveInteger(
        options.observability.diagnosticRingSize,
        state.config.observability.diagnosticRingSize
      );
    }

    if (Object.prototype.hasOwnProperty.call(options.observability, "diagnosticPreviewChars")) {
      next.diagnosticPreviewChars = normalizePositiveInteger(
        options.observability.diagnosticPreviewChars,
        state.config.observability.diagnosticPreviewChars
      );
    }

    if (Object.prototype.hasOwnProperty.call(options.observability, "rawDirectExport")) {
      next.rawDirectExport = Boolean(options.observability.rawDirectExport);
    }

    patch.observability = next;
  }

  return patch;
}

function applyConfigPatch(options) {
  const patch = normalizeConfigPatch(options);
  const next = {
    ...state.config,
    ...patch,
  };

  if (patch.redaction) {
    next.redaction = patch.redaction;
  } else {
    next.redaction = state.config.redaction;
  }

  if (patch.observability) {
    next.observability = patch.observability;
  } else {
    next.observability = state.config.observability;
  }

  state.config = next;
}

function onInternalError(error, context = {}) {
  const details = [];
  if (context.logger) {
    details.push(`logger=${context.logger}`);
  }
  if (context.filePath) {
    details.push(`file=${context.filePath}`);
  }
  if (context.sourcePath) {
    details.push(`source=${context.sourcePath}`);
  }
  if (context.archivePath) {
    details.push(`archive=${context.archivePath}`);
  }
  const detailLine = details.length ? ` (${details.join(", ")})` : "";
  console.error(`[logger] ${error.message || error}${detailLine}`);
}

function ensureInitialized() {
  if (state.initialized) {
    return;
  }

  const session = createLogSession(state.config.rootDir);
  state.sessionName = session.sessionName;
  state.sessionPath = session.sessionPath;
  state.transportFactory = createTransportFactory({
    sessionPath: state.sessionPath,
    onError: onInternalError,
  });

  state.compressionTask = compressPreviousSessions({
    rootDir: state.config.rootDir,
    currentSessionName: state.sessionName,
    onError: onInternalError,
  }).catch((error) => {
    onInternalError(error);
  });

  state.initialized = true;
}

function shouldWriteConsole(level) {
  return (
    state.config.consoleEnabled &&
    Array.isArray(state.config.consoleLevels) &&
    state.config.consoleLevels.includes(level)
  );
}

function writeConsole(level, textLine) {
  if (!shouldWriteConsole(level)) {
    return;
  }

  if (level === "warn") {
    console.warn(textLine);
    return;
  }

  if (level === "error" || level === "fatal") {
    console.error(textLine);
    return;
  }

  if (level === "debug") {
    console.debug(textLine);
    return;
  }

  console.log(textLine);
}

function writeRecordDirect(params) {
  const {
    timestamp,
    loggerName,
    level,
    message,
    meta,
    bindings,
  } = params;

  const normalizedLevel = normalizeLevel(level, "info");
  const record = buildRecord({
    timestamp,
    level: normalizedLevel,
    loggerName,
    message,
    meta,
    bindings,
    redaction: state.config.redaction,
  });

  state.transportFactory.write(loggerName, record);
  writeConsole(normalizedLevel, record.textLine);
}

function normalizeObservability(value) {
  if (!isRecord(value)) {
    return null;
  }

  const kind = value.kind === "raw" ? "raw" : "node";
  const requestId = normalizeOptionalString(value.requestId);
  const eventType = normalizeOptionalString(value.eventType);
  const outcomeRaw = normalizeOptionalString(value.outcome);
  const outcome = outcomeRaw && OBSERVABILITY_OUTCOMES.has(outcomeRaw)
    ? outcomeRaw
    : null;

  return {
    kind,
    requestId,
    eventType,
    outcome,
  };
}

function splitMetaObservability(meta) {
  if (!isRecord(meta)) {
    return {
      cleanMeta: meta,
      observability: null,
    };
  }

  const output = {
    ...meta,
  };

  const observability = normalizeObservability(output.observability);
  delete output.observability;

  return {
    cleanMeta: Object.keys(output).length > 0 ? output : undefined,
    observability,
  };
}

function previewString(value, maxChars) {
  if (value.length <= maxChars) {
    return {
      preview: value,
      length: value.length,
      truncated: false,
    };
  }

  return {
    preview: `${value.slice(0, maxChars)}...`,
    length: value.length,
    truncated: true,
  };
}

function toPreview(value, maxChars, depth = 0) {
  if (value === null || value === undefined) {
    return value;
  }

  const valueType = typeof value;
  if (valueType === "string") {
    return previewString(value, maxChars);
  }

  if (valueType === "number" || valueType === "boolean") {
    return value;
  }

  if (valueType !== "object") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, 3).map((item) =>
      depth >= 1 ? String(item) : toPreview(item, maxChars, depth + 1)
    );

    return {
      type: "array",
      length: value.length,
      previewItems: items,
      truncated: value.length > items.length,
    };
  }

  if (!isRecord(value)) {
    return String(value);
  }

  const keys = Object.keys(value);
  const selectedKeys = keys.slice(0, 8);
  const preview = {};
  for (const key of selectedKeys) {
    preview[key] = depth >= 1 ? String(value[key]) : toPreview(value[key], maxChars, depth + 1);
  }

  return {
    type: "object",
    keys: selectedKeys,
    preview,
    truncated: keys.length > selectedKeys.length,
  };
}

function computeSerializedSize(value) {
  if (value === undefined) {
    return 0;
  }

  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch (_) {
    return null;
  }
}

function extractContentLength(message, meta) {
  if (isRecord(meta) && Number.isFinite(meta.contentLength)) {
    return Number(meta.contentLength);
  }

  if (isRecord(meta)) {
    for (const key of ["content", "chunk", "message", "reply"]) {
      if (typeof meta[key] === "string") {
        return meta[key].length;
      }
    }
  }

  if (typeof message === "string") {
    return message.length;
  }

  return null;
}

function appendRawDiagnosticTrace(requestId, trace) {
  const existing = state.diagnosticBufferByRequestId.get(requestId) ?? [];
  existing.push(trace);

  while (existing.length > state.config.observability.diagnosticRingSize) {
    existing.shift();
  }

  state.diagnosticBufferByRequestId.set(requestId, existing);
}

function clearRawDiagnosticTrace(requestId) {
  if (!requestId) {
    return;
  }

  state.diagnosticBufferByRequestId.delete(requestId);
}

function exportRawDiagnosticTrace(params) {
  const { requestId, trigger, triggerLoggerName } = params;

  if (!requestId) {
    return;
  }

  const traces = state.diagnosticBufferByRequestId.get(requestId) ?? [];
  if (traces.length === 0) {
    state.diagnosticBufferByRequestId.delete(requestId);
    return;
  }

  const loggerName = sanitizeLoggerName(triggerLoggerName || traces[traces.length - 1].loggerName);
  const exportTimestamp = new Date().toISOString();

  writeRecordDirect({
    timestamp: exportTimestamp,
    loggerName,
    level: "error",
    message: "diagnostic context export begin",
    meta: {
      stage: "observability",
      action: "diagnostic.export.begin",
      requestId,
      trigger,
      traceCount: traces.length,
    },
    bindings: {},
  });

  for (let index = 0; index < traces.length; index += 1) {
    const trace = traces[index];
    writeRecordDirect({
      timestamp: exportTimestamp,
      loggerName: trace.loggerName,
      level: trace.level,
      message: "diagnostic raw trace",
      meta: {
        stage: "observability",
        action: "diagnostic.export.trace",
        requestId,
        trigger,
        sequence: index + 1,
        total: traces.length,
        eventType: trace.eventType,
        bufferedAt: trace.timestamp,
        payloadSize: trace.payloadSize,
        contentLength: trace.contentLength,
        trace: {
          message: trace.message,
          meta: trace.meta,
        },
      },
      bindings: {},
    });
  }

  writeRecordDirect({
    timestamp: exportTimestamp,
    loggerName,
    level: "error",
    message: "diagnostic context export complete",
    meta: {
      stage: "observability",
      action: "diagnostic.export.complete",
      requestId,
      trigger,
      traceCount: traces.length,
    },
    bindings: {},
  });

  state.diagnosticBufferByRequestId.delete(requestId);
}

function writeEntry(params) {
  const { loggerName, level, message, meta, bindings } = params;
  ensureInitialized();

  const normalizedLevel = normalizeLevel(level, "info");
  const { cleanMeta, observability } = splitMetaObservability(meta);
  const shouldWriteByLevel = isLevelEnabled(normalizedLevel, state.config.level);

  if (
    observability
    && observability.kind === "raw"
    && shouldWriteByLevel
    && !isRawDirectExportEnabled()
  ) {
    if (observability.requestId) {
      appendRawDiagnosticTrace(observability.requestId, {
        timestamp: new Date().toISOString(),
        loggerName,
        level: normalizedLevel,
        eventType: observability.eventType,
        payloadSize: computeSerializedSize(cleanMeta),
        contentLength: extractContentLength(message, cleanMeta),
        message: toPreview(message, state.config.observability.diagnosticPreviewChars),
        meta: toPreview(cleanMeta, state.config.observability.diagnosticPreviewChars),
      });
    } else {
      writeRecordDirect({
        timestamp: new Date().toISOString(),
        loggerName,
        level: normalizedLevel,
        message,
        meta: {
          ...(isRecord(cleanMeta) ? cleanMeta : { value: cleanMeta }),
          observabilityFallback: "raw_missing_request_id",
        },
        bindings,
      });
    }
  } else if (shouldWriteByLevel) {
    writeRecordDirect({
      timestamp: new Date().toISOString(),
      loggerName,
      level: normalizedLevel,
      message,
      meta: cleanMeta,
      bindings,
    });
  }

  if (observability && observability.requestId && observability.outcome) {
    if (OBSERVABILITY_EXPORT_OUTCOMES.has(observability.outcome)) {
      exportRawDiagnosticTrace({
        requestId: observability.requestId,
        trigger: observability.outcome,
        triggerLoggerName: loggerName,
      });
      return;
    }

    if (observability.outcome === "success") {
      clearRawDiagnosticTrace(observability.requestId);
    }
  }
}

class Logger {
  constructor(name, bindings = {}) {
    this.name = sanitizeLoggerName(name);
    this.bindings = bindings && typeof bindings === "object" ? bindings : {};
  }

  child(bindings = {}) {
    return new Logger(this.name, {
      ...this.bindings,
      ...bindings,
    });
  }

  isLevelEnabled(level) {
    return isLevelEnabled(level, state.config.level);
  }

  trace(message, meta) {
    writeEntry({
      loggerName: this.name,
      level: "trace",
      message,
      meta,
      bindings: this.bindings,
    });
  }

  debug(message, meta) {
    writeEntry({
      loggerName: this.name,
      level: "debug",
      message,
      meta,
      bindings: this.bindings,
    });
  }

  info(message, meta) {
    writeEntry({
      loggerName: this.name,
      level: "info",
      message,
      meta,
      bindings: this.bindings,
    });
  }

  warn(message, meta) {
    writeEntry({
      loggerName: this.name,
      level: "warn",
      message,
      meta,
      bindings: this.bindings,
    });
  }

  error(message, meta) {
    writeEntry({
      loggerName: this.name,
      level: "error",
      message,
      meta,
      bindings: this.bindings,
    });
  }

  fatal(message, meta) {
    writeEntry({
      loggerName: this.name,
      level: "fatal",
      message,
      meta,
      bindings: this.bindings,
    });
  }
}

function configureLogger(options = {}) {
  const wasInitialized = state.initialized;
  const previousRootDir = state.config.rootDir;
  applyConfigPatch(options);

  if (wasInitialized && previousRootDir !== state.config.rootDir) {
    console.warn(
      "[logger] rootDir cannot be changed after initialization. " +
        `Current rootDir is still ${previousRootDir}`
    );
    state.config.rootDir = previousRootDir;
  }
}

function getLogger(name, bindings = {}) {
  ensureInitialized();
  return new Logger(name, bindings);
}

async function flushLogs() {
  if (!state.initialized || !state.transportFactory) {
    return;
  }

  await Promise.all([
    state.transportFactory.flushAll(),
    state.compressionTask.catch((error) => {
      onInternalError(error);
    }),
  ]);
}

async function shutdownLogger() {
  if (!state.initialized || !state.transportFactory) {
    return;
  }

  await flushLogs();
  await state.transportFactory.closeAll();
  state.initialized = false;
  state.transportFactory = null;
  state.sessionName = "";
  state.sessionPath = "";
  state.compressionTask = Promise.resolve();
  state.diagnosticBufferByRequestId.clear();
}

function getCurrentLogSessionPath() {
  ensureInitialized();
  return state.sessionPath;
}

async function __resetForTests() {
  await shutdownLogger();
  state.config = buildDefaultConfig();
  state.diagnosticBufferByRequestId = new Map();
}

module.exports = {
  configureLogger,
  getLogger,
  flushLogs,
  shutdownLogger,
  getCurrentLogSessionPath,
  __resetForTests,
};
