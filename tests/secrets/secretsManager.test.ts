import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { SECRET_KEYS, SecretsError, SecretsManager } from "../../src/core/secrets";

type TempEnvFile = {
  root: string;
  envFilePath: string;
};

function createTempEnvFile(content: string): TempEnvFile {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "secrets-manager-test-"));
  const envFilePath = path.join(root, ".env");
  fs.writeFileSync(envFilePath, content, "utf-8");
  return { root, envFilePath };
}

describe("secrets manager", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root) {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("reads secret by schema id", () => {
    const envFile = createTempEnvFile("DISCORD_TOKEN=token-from-file\n");
    tempRoots.push(envFile.root);

    const manager = new SecretsManager({
      env: {},
      envFilePath: envFile.envFilePath,
    });

    expect(manager.get(SECRET_KEYS.DISCORD_TOKEN)).toBe("token-from-file");
  });

  it("reads secret by env name", () => {
    const envFile = createTempEnvFile("DISCORD_TOKEN=token-from-file\n");
    tempRoots.push(envFile.root);

    const manager = new SecretsManager({
      env: {},
      envFilePath: envFile.envFilePath,
    });

    expect(manager.get("DISCORD_TOKEN")).toBe("token-from-file");
  });

  it("uses process env value before .env value", () => {
    const envFile = createTempEnvFile("DISCORD_TOKEN=token-from-file\n");
    tempRoots.push(envFile.root);

    const manager = new SecretsManager({
      env: {
        DISCORD_TOKEN: "token-from-process",
      },
      envFilePath: envFile.envFilePath,
    });

    expect(manager.get(SECRET_KEYS.DISCORD_TOKEN)).toBe("token-from-process");
  });

  it("throws in get() when known secret key has no value", () => {
    const envFile = createTempEnvFile("DISCORD_TOKEN=token-from-file\n");
    tempRoots.push(envFile.root);

    const manager = new SecretsManager({
      env: {},
      envFilePath: envFile.envFilePath,
    });

    expect(() => manager.get(SECRET_KEYS.DISCORD_APPLICATION_ID)).toThrowError(SecretsError);

    try {
      manager.get(SECRET_KEYS.DISCORD_APPLICATION_ID);
    } catch (error) {
      expect((error as SecretsError).code).toBe("SECRET_NOT_FOUND");
    }
  });

  it("returns null in tryGet() when known secret key has no value", () => {
    const envFile = createTempEnvFile("DISCORD_TOKEN=token-from-file\n");
    tempRoots.push(envFile.root);

    const manager = new SecretsManager({
      env: {},
      envFilePath: envFile.envFilePath,
    });

    expect(manager.tryGet(SECRET_KEYS.DISCORD_APPLICATION_ID)).toBeNull();
    expect(manager.has(SECRET_KEYS.DISCORD_APPLICATION_ID)).toBe(false);
  });

  it("throws unknown key error in get/tryGet/has", () => {
    const envFile = createTempEnvFile("DISCORD_TOKEN=token-from-file\n");
    tempRoots.push(envFile.root);

    const manager = new SecretsManager({
      env: {},
      envFilePath: envFile.envFilePath,
    });

    expect(() => manager.get("UNKNOWN_SECRET")).toThrowError(SecretsError);
    expect(() => manager.tryGet("UNKNOWN_SECRET")).toThrowError(SecretsError);
    expect(() => manager.has("UNKNOWN_SECRET")).toThrowError(SecretsError);

    try {
      manager.get("UNKNOWN_SECRET");
    } catch (error) {
      expect((error as SecretsError).code).toBe("UNKNOWN_SECRET_KEY");
    }
  });

  it("reload() reflects updated env source values", () => {
    const envFile = createTempEnvFile("DISCORD_TOKEN=token-v1\n");
    tempRoots.push(envFile.root);

    const envSource: Record<string, string | undefined> = {};
    const manager = new SecretsManager({
      env: envSource,
      envFilePath: envFile.envFilePath,
    });

    expect(manager.get(SECRET_KEYS.DISCORD_TOKEN)).toBe("token-v1");

    fs.writeFileSync(envFile.envFilePath, "DISCORD_TOKEN=token-v2\n", "utf-8");
    manager.reload();
    expect(manager.get(SECRET_KEYS.DISCORD_TOKEN)).toBe("token-v2");

    envSource.DISCORD_TOKEN = "token-v3";
    manager.reload();
    expect(manager.get(SECRET_KEYS.DISCORD_TOKEN)).toBe("token-v3");
  });
});
