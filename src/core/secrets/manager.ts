import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

import { SecretsError } from "./errors";
import { SECRET_KEYS } from "./schema/secretKeys";
import type { SecretEnvName, SecretId, SecretLookupKey, SecretsManagerOptions } from "./types";

type DotenvValues = Record<string, string>;

function normalizeNonEmptyValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class SecretsManager {
  private readonly env: Record<string, string | undefined>;
  private readonly envFilePath: string;
  private readonly idToEnvName = new Map<SecretId, SecretEnvName>();
  private readonly knownEnvNames = new Set<SecretEnvName>();
  private valuesByEnvName = new Map<SecretEnvName, string>();

  constructor(options: SecretsManagerOptions = {}) {
    this.env = options.env ?? process.env;
    this.envFilePath = options.envFilePath ?? path.resolve(process.cwd(), ".env");

    for (const [envName, secretId] of Object.entries(SECRET_KEYS) as Array<[SecretEnvName, SecretId]>) {
      this.knownEnvNames.add(envName);
      this.idToEnvName.set(secretId, envName);
    }

    this.reload();
  }

  get(key: SecretLookupKey): string {
    const envName = this.resolveEnvName(key);
    const value = this.valuesByEnvName.get(envName) ?? null;

    if (value === null) {
      throw new SecretsError(
        "SECRET_NOT_FOUND",
        `secret not found for key "${String(key)}" (${envName})`
      );
    }

    return value;
  }

  tryGet(key: SecretLookupKey): string | null {
    const envName = this.resolveEnvName(key);
    return this.valuesByEnvName.get(envName) ?? null;
  }

  has(key: SecretLookupKey): boolean {
    return this.tryGet(key) !== null;
  }

  reload(): void {
    const dotenvValues = this.loadDotenvValues();
    const nextValues = new Map<SecretEnvName, string>();

    for (const envName of this.knownEnvNames) {
      // Normalize source keys and enforce precedence: process.env > .env file.
      const fromProcessEnv = normalizeNonEmptyValue(this.env[envName]);
      if (fromProcessEnv !== null) {
        nextValues.set(envName, fromProcessEnv);
        continue;
      }

      const fromDotenv = normalizeNonEmptyValue(dotenvValues[envName]);
      if (fromDotenv !== null) {
        nextValues.set(envName, fromDotenv);
      }
    }

    this.valuesByEnvName = nextValues;
  }

  private resolveEnvName(key: SecretLookupKey): SecretEnvName {
    if (typeof key !== "string" || key.trim().length === 0) {
      throw new SecretsError("UNKNOWN_SECRET_KEY", "secret key must be a non-empty string");
    }

    // Accept both registered env names and schema ids.
    const normalized = key.trim();

    if (this.knownEnvNames.has(normalized as SecretEnvName)) {
      return normalized as SecretEnvName;
    }

    const envName = this.idToEnvName.get(normalized as SecretId);
    if (envName) {
      return envName;
    }

    throw new SecretsError("UNKNOWN_SECRET_KEY", `unknown secret key: ${normalized}`);
  }

  private loadDotenvValues(): DotenvValues {
    if (!fs.existsSync(this.envFilePath)) {
      return {};
    }

    try {
      const source = fs.readFileSync(this.envFilePath, "utf-8");
      return parse(source);
    } catch (error) {
      throw new SecretsError(
        "SECRET_SOURCE_LOAD_FAILED",
        `failed to load .env file: ${this.envFilePath}`,
        error
      );
    }
  }
}
