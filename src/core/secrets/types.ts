import type { SECRET_KEYS } from "./schema/secretKeys";

export type SecretEnvName = keyof typeof SECRET_KEYS;
export type SecretId = (typeof SECRET_KEYS)[SecretEnvName];
export type SecretLookupKey = SecretEnvName | SecretId | string;

export interface SecretsManagerOptions {
  env?: Record<string, string | undefined>;
  envFilePath?: string;
}
