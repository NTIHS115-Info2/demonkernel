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
  };
}

const state = {
  initialized: false,
  sessionName: "",
  sessionPath: "",
  transportFactory: null,
  compressionTask: Promise.resolve(),
  config: buildDefaultConfig(),
};

function levelsFromMinimum(level) {
  const min = normalizeLevel(level, "warn");
  return Object.keys(LEVELS).filter((item) => isLevelEnabled(item, min));
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

function writeEntry(params) {
  const { loggerName, level, message, meta, bindings } = params;
  ensureInitialized();

  const normalizedLevel = normalizeLevel(level, "info");
  if (!isLevelEnabled(normalizedLevel, state.config.level)) {
    return;
  }

  const record = buildRecord({
    timestamp: new Date().toISOString(),
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
}

function getCurrentLogSessionPath() {
  ensureInitialized();
  return state.sessionPath;
}

async function __resetForTests() {
  await shutdownLogger();
  state.config = buildDefaultConfig();
}

module.exports = {
  configureLogger,
  getLogger,
  flushLogs,
  shutdownLogger,
  getCurrentLogSessionPath,
  __resetForTests,
};
