"use strict";

const MIN_MASK_LENGTH = 6;

const DEFAULT_REDACTION_PATTERNS = Object.freeze([
  /token["\s]*[:=]["\s]*([a-zA-Z0-9._-]+)/gi,
  /api[_-]?key["\s]*[:=]["\s]*([a-zA-Z0-9._-]+)/gi,
  /password["\s]*[:=]["\s]*([^\s"]+)/gi,
  /secret["\s]*[:=]["\s]*([a-zA-Z0-9._-]+)/gi,
  /authorization["\s]*:[\s"]*([a-zA-Z0-9._-]+)/gi,
  /bearer\s+([a-zA-Z0-9._-]+)/gi,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  /x-api-key["\s]*[:=]["\s]*([a-zA-Z0-9._-]+)/gi,
  /client[_-]?secret["\s]*[:=]["\s]*([a-zA-Z0-9._-]+)/gi,
  /refresh[_-]?token["\s]*[:=]["\s]*([a-zA-Z0-9._-]+)/gi,
]);

function maskToken(token) {
  if (token.length <= MIN_MASK_LENGTH) {
    return "*".repeat(token.length);
  }
  return `${token.slice(0, 3)}${"*".repeat(token.length - 3)}`;
}

function redactString(value, patterns = DEFAULT_REDACTION_PATTERNS) {
  let redacted = value;
  for (const pattern of patterns) {
    redacted = redacted.replace(pattern, (match, sensitiveValue) => {
      if (sensitiveValue && typeof sensitiveValue === "string") {
        const index = match.indexOf(sensitiveValue);
        const prefix = index >= 0 ? match.slice(0, index) : "";
        return `${prefix}${maskToken(sensitiveValue)}`;
      }
      return maskToken(match);
    });
  }
  return redacted;
}

function redactUnknown(value, redactEnabled, patterns, visited = new WeakSet()) {
  if (!redactEnabled) {
    return value;
  }

  if (typeof value === "string") {
    return redactString(value, patterns);
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (visited.has(value)) {
    return "[Circular]";
  }

  visited.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, redactEnabled, patterns, visited));
  }

  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = redactUnknown(entry, redactEnabled, patterns, visited);
  }
  return result;
}

module.exports = {
  DEFAULT_REDACTION_PATTERNS,
  redactString,
  redactUnknown,
};
