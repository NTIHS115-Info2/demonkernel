"use strict";

const os = require("node:os");
const util = require("node:util");
const { redactUnknown } = require("./redaction");

function safeSerialize(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (_, current) => {
    if (typeof current === "bigint") {
      return current.toString();
    }
    if (typeof current === "object" && current !== null) {
      if (seen.has(current)) {
        return "[Circular]";
      }
      seen.add(current);
    }
    return current;
  });
}

function normalizeMeta(meta) {
  if (meta === undefined) {
    return undefined;
  }
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return meta;
  }
  return { value: meta };
}

function serializeError(error, redaction) {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const details = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  if (Object.prototype.hasOwnProperty.call(error, "code")) {
    details.code = error.code;
  }

  if (error.cause instanceof Error) {
    details.cause = serializeError(error.cause, redaction);
  }

  return redactUnknown(details, redaction.enabled, redaction.patterns);
}

function stringifyForText(value) {
  if (value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  try {
    return safeSerialize(value);
  } catch (_) {
    return util.inspect(value, { depth: 5, breakLength: 120 });
  }
}

function normalizeMessage(message, redaction) {
  if (message instanceof Error) {
    const redactedMessage = redactUnknown(
      message.message,
      redaction.enabled,
      redaction.patterns
    );
    return {
      text: String(redactedMessage),
      err: serializeError(message, redaction),
    };
  }

  const text = redactUnknown(
    stringifyForText(message),
    redaction.enabled,
    redaction.patterns
  );
  return {
    text: String(text),
    err: undefined,
  };
}

function buildRecord(params) {
  const {
    timestamp,
    level,
    loggerName,
    message,
    meta,
    bindings,
    redaction,
  } = params;

  const normalizedMeta = normalizeMeta(meta);
  const redactedMeta = redactUnknown(
    normalizedMeta,
    redaction.enabled,
    redaction.patterns
  );
  const redactedBindings = redactUnknown(
    bindings || {},
    redaction.enabled,
    redaction.patterns
  );

  const normalizedMessage = normalizeMessage(message, redaction);
  const errFromMeta =
    normalizedMeta && normalizedMeta.error instanceof Error
      ? serializeError(normalizedMeta.error, redaction)
      : undefined;

  const err = normalizedMessage.err || errFromMeta;
  const jsonPayload = {
    timestamp,
    level,
    logger: loggerName,
    message: normalizedMessage.text,
    bindings: redactedBindings,
    pid: process.pid,
    hostname: os.hostname(),
  };

  if (redactedMeta !== undefined) {
    jsonPayload.meta = redactedMeta;
  }

  if (err) {
    jsonPayload.err = err;
  }

  const textChunks = [
    timestamp,
    level.toUpperCase(),
    `[${loggerName}]`,
    normalizedMessage.text,
  ];

  if (redactedMeta !== undefined) {
    textChunks.push(`meta=${stringifyForText(redactedMeta)}`);
  }

  if (err) {
    textChunks.push(`err=${stringifyForText(err)}`);
  }

  return {
    jsonLine: safeSerialize(jsonPayload),
    textLine: textChunks.join(" "),
  };
}

module.exports = {
  safeSerialize,
  serializeError,
  buildRecord,
};
