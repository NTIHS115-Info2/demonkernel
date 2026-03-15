export const SecretsErrorCode = {
  UNKNOWN_SECRET_KEY: "UNKNOWN_SECRET_KEY",
  SECRET_NOT_FOUND: "SECRET_NOT_FOUND",
  SECRET_SOURCE_LOAD_FAILED: "SECRET_SOURCE_LOAD_FAILED",
} as const;

export type SecretsErrorCodeKey = keyof typeof SecretsErrorCode;

export class SecretsError extends Error {
  readonly code: SecretsErrorCodeKey;
  readonly cause?: unknown;

  constructor(code: SecretsErrorCodeKey, message: string, cause?: unknown) {
    super(message);
    this.name = "SecretsError";
    this.code = code;
    this.cause = cause;
  }
}
