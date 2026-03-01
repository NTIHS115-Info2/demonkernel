import type { PluginError } from "./types";

export const CoreErrorCode = {
  MANIFEST_INVALID: "MANIFEST_INVALID",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  OPTIONS_INVALID: "OPTIONS_INVALID",
  STRATEGY_NOT_FOUND: "STRATEGY_NOT_FOUND",
  LIFECYCLE_INVALID: "LIFECYCLE_INVALID",
  ONLINE_FAILED: "ONLINE_FAILED",
  OFFLINE_FAILED: "OFFLINE_FAILED",
  RESTART_FAILED: "RESTART_FAILED",
  RUNNING_FAILED: "RUNNING_FAILED",
} as const;

export type CoreErrorCodeKey = keyof typeof CoreErrorCode;

export class PluginSdkError extends Error {
  code: CoreErrorCodeKey;
  cause?: unknown;

  constructor(code: CoreErrorCodeKey, message: string, cause?: unknown) {
    super(message);
    this.name = "PluginSdkError";
    this.code = code;
    this.cause = cause;
  }
}

export function makeError(
  code: CoreErrorCodeKey,
  message: string,
  cause?: unknown
): PluginError {
  return { code, message, cause };
}
