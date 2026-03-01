/* 註解：PluginsManager 錯誤碼、錯誤類型與錯誤訊息工具。 */
export const PluginsManagerErrorCode = {
  INVALID_PLUGIN_REF: "INVALID_PLUGIN_REF",
  PLUGIN_NOT_FOUND: "PLUGIN_NOT_FOUND",
  PLUGIN_AMBIGUOUS: "PLUGIN_AMBIGUOUS",
  MANIFEST_INVALID: "MANIFEST_INVALID",
  ENTRY_NOT_FOUND: "ENTRY_NOT_FOUND",
  MODULE_LOAD_FAILED: "MODULE_LOAD_FAILED",
  LIFECYCLE_CONTRACT_INVALID: "LIFECYCLE_CONTRACT_INVALID",
  DEPENDENCY_NOT_FOUND: "DEPENDENCY_NOT_FOUND",
  DEPENDENCY_VERSION_MISMATCH: "DEPENDENCY_VERSION_MISMATCH",
  DEPENDENCY_NOT_ONLINE: "DEPENDENCY_NOT_ONLINE",
  DEPENDENCY_FAILED: "DEPENDENCY_FAILED",
  DEPENDENCY_CYCLE: "DEPENDENCY_CYCLE",
  DEPENDENCY_DEADLOCK: "DEPENDENCY_DEADLOCK",
  ONLINE_FAILED: "ONLINE_FAILED",
  OFFLINE_FAILED: "OFFLINE_FAILED",
  RESTART_FAILED: "RESTART_FAILED",
  SEND_FAILED: "SEND_FAILED",
  STATE_FAILED: "STATE_FAILED",
} as const;

export type PluginsManagerErrorCodeKey = keyof typeof PluginsManagerErrorCode;

export class PluginsManagerError extends Error {
  code: PluginsManagerErrorCodeKey;
  cause?: unknown;

  constructor(code: PluginsManagerErrorCodeKey, message: string, cause?: unknown) {
    super(message);
    this.name = "PluginsManagerError";
    this.code = code;
    this.cause = cause;
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
