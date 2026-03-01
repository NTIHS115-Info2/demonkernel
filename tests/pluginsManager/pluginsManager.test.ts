/* 註解：PluginsManager 行為測試（含虛假插件依賴/錯誤情境）。 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PluginsManager } from "../../src/core/pluginsManager";

type PluginType = "skill" | "system";

type FakePluginOptions = {
  name: string;
  type: PluginType;
  version?: string;
  startupWeight?: number;
  dependencies?: {
    skill?: Record<string, string>;
    system?: Record<string, string>;
  };
  throwOnOnline?: boolean;
  throwOnOffline?: boolean;
  throwOnRestart?: boolean;
  throwOnSend?: boolean;
  throwOnState?: boolean;
  onlineDelayMs?: number;
  invalidPriorityField?: boolean;
};

function createTempPluginRoot(): { root: string; skillPath: string; systemPath: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plugins-manager-test-"));
  const skillPath = path.join(root, "skillPlugins");
  const systemPath = path.join(root, "systemPlugins");

  fs.mkdirSync(skillPath, { recursive: true });
  fs.mkdirSync(systemPath, { recursive: true });

  return { root, skillPath, systemPath };
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function createFakePlugin(basePath: string, options: FakePluginOptions): void {
  const pluginDir = path.join(basePath, options.name);
  fs.mkdirSync(pluginDir, { recursive: true });

  const runtime: Record<string, unknown> = {
    startupWeight: options.startupWeight ?? 0,
    method: ["local"],
    onlineOptions: {
      oneOf: [
        {
          when: { method: "local" },
          schema: {
            method: { type: "string", enum: ["local"] },
          },
        },
      ],
    },
  };

  if (options.invalidPriorityField) {
    runtime.priority = 0;
    delete runtime.startupWeight;
  }

  const manifest = {
    meta: {
      name: options.name,
      version: options.version ?? "1.0.0",
      type: options.type,
      entry: "index.js",
    },
    runtime,
    dependencies: {
      skill: options.dependencies?.skill ?? {},
      system: options.dependencies?.system ?? {},
    },
  };

  writeJson(path.join(pluginDir, "plugin.manifest.json"), manifest);

  const moduleCode = `
const state = { online: false };

module.exports = {
  async online(options) {
    globalThis.__pmEvents?.push("online:${options.type}:${options.name}");
    if (${options.onlineDelayMs ?? 0} > 0) {
      await new Promise((resolve) => setTimeout(resolve, ${options.onlineDelayMs ?? 0}));
    }
    if (${options.throwOnOnline ? "true" : "false"}) {
      throw new Error("online failed ${options.type}:${options.name}");
    }
    state.online = true;
  },

  async offline() {
    globalThis.__pmEvents?.push("offline:${options.type}:${options.name}");
    if (${options.throwOnOffline ? "true" : "false"}) {
      throw new Error("offline failed ${options.type}:${options.name}");
    }
    state.online = false;
  },

  async restart(options) {
    if (${options.throwOnRestart ? "true" : "false"}) {
      throw new Error("restart failed ${options.type}:${options.name}");
    }
    await this.offline();
    await this.online(options);
  },

  async state() {
    if (${options.throwOnState ? "true" : "false"}) {
      throw new Error("state failed ${options.type}:${options.name}");
    }
    return { status: state.online ? 1 : 0 };
  },

  async send(payload) {
    if (${options.throwOnSend ? "true" : "false"}) {
      throw new Error("send failed ${options.type}:${options.name}");
    }
    return payload;
  },
};
`;

  fs.writeFileSync(path.join(pluginDir, "index.js"), moduleCode.trimStart(), "utf-8");
}

describe("pluginsManager", () => {
  let tempRoot: { root: string; skillPath: string; systemPath: string };

  beforeEach(() => {
    tempRoot = createTempPluginRoot();
    (globalThis as any).__pmEvents = [];
  });

  afterEach(() => {
    delete (globalThis as any).__pmEvents;
    fs.rmSync(tempRoot.root, { recursive: true, force: true });
  });

  function createManager(): PluginsManager {
    return new PluginsManager({
      skillPluginsPath: tempRoot.skillPath,
      systemPluginsPath: tempRoot.systemPath,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    });
  }

  it("discovers valid plugins and tracks invalid manifests", () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "good-skill",
      type: "skill",
      startupWeight: 1,
    });

    createFakePlugin(tempRoot.systemPath, {
      name: "good-system",
      type: "system",
      startupWeight: 2,
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "bad-plugin",
      type: "skill",
      invalidPriorityField: true,
    });

    const manager = createManager();
    const summary = manager.discoverPlugins();

    expect(summary.total).toBe(3);
    expect(summary.registered).toBe(2);
    expect(summary.invalid).toBe(1);

    const invalid = manager.getInvalidPlugins();
    expect(invalid).toHaveLength(1);
    expect(invalid[0].reason).toContain("startupWeight");
  });

  it("starts ready plugins in startupWeight order and same wave in parallel", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "high",
      type: "skill",
      startupWeight: 20,
      onlineDelayMs: 120,
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "low",
      type: "skill",
      startupWeight: 5,
      onlineDelayMs: 120,
    });

    const manager = createManager();
    manager.discoverPlugins();

    const start = Date.now();
    const report = await manager.onlineAll();
    const elapsed = Date.now() - start;

    expect(report.failed).toHaveLength(0);
    expect(report.started).toEqual(["skill:high", "skill:low"]);
    expect((globalThis as any).__pmEvents.slice(0, 2)).toEqual([
      "online:skill:high",
      "online:skill:low",
    ]);

    expect(elapsed).toBeLessThan(230);
  });

  it("allows startup when dependency is already online", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "dep",
      type: "skill",
      version: "1.0.0",
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "consumer",
      type: "skill",
      dependencies: {
        skill: { dep: "1.0.0" },
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const depOnline = await manager.online("skill:dep", {
      onlineOptions: { method: "local" },
    });

    expect(depOnline.ok).toBe(true);

    const consumerOnline = await manager.online("skill:consumer", {
      onlineOptions: { method: "local" },
    });

    expect(consumerOnline.ok).toBe(true);
  });

  it("waits for dependency in the same startup queue", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "dep",
      type: "skill",
      startupWeight: 1,
      onlineDelayMs: 60,
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "consumer",
      type: "skill",
      startupWeight: 99,
      dependencies: {
        skill: { dep: "1.0.0" },
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const report = await manager.onlineAll();
    expect(report.failed).toHaveLength(0);
    expect(report.started).toEqual(["skill:dep", "skill:consumer"]);
    expect((globalThis as any).__pmEvents).toEqual([
      "online:skill:dep",
      "online:skill:consumer",
    ]);
  });

  it("fails immediately when dependency is offline and not queued", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "dep",
      type: "skill",
      version: "1.0.0",
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "consumer",
      type: "skill",
      dependencies: {
        skill: { dep: "1.0.0" },
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const result = await manager.online("skill:consumer", {
      onlineOptions: { method: "local" },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not in startup queue");
  });

  it("fails dependent plugin when dependency startup fails", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "dep",
      type: "skill",
      throwOnOnline: true,
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "consumer",
      type: "skill",
      dependencies: {
        skill: { dep: "1.0.0" },
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const report = await manager.onlineAll();

    expect(report.failed.some((item) => item.key === "skill:dep")).toBe(true);
    expect(report.failed.some((item) => item.key === "skill:consumer")).toBe(true);
    const consumerFailure = report.failed.find((item) => item.key === "skill:consumer");
    expect(consumerFailure?.reason).toContain("dependency failed");
  });

  it("detects and blocks cycle dependencies", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "a",
      type: "skill",
      dependencies: {
        skill: { b: "1.0.0" },
      },
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "b",
      type: "skill",
      dependencies: {
        skill: { a: "1.0.0" },
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const report = await manager.onlineAll();

    expect(report.started).toHaveLength(0);
    expect(report.blocked.length).toBeGreaterThanOrEqual(2);
    expect(report.cycles.length).toBeGreaterThanOrEqual(1);
  });

  it("fails on exact dependency version mismatch", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "dep",
      type: "skill",
      version: "1.0.1",
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "consumer",
      type: "skill",
      dependencies: {
        skill: { dep: "1.0.0" },
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const report = await manager.onlineAll();
    const failure = report.failed.find((item) => item.key === "skill:consumer");

    expect(failure).toBeTruthy();
    expect(failure?.reason).toContain("version mismatch");
  });

  it("captures lifecycle errors from plugin methods", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "flaky",
      type: "skill",
      throwOnSend: true,
      throwOnRestart: true,
    });

    const manager = createManager();
    manager.discoverPlugins();

    const online = await manager.online("skill:flaky", {
      onlineOptions: { method: "local" },
    });
    expect(online.ok).toBe(true);

    const send = await manager.send("skill:flaky", { hello: "world" });
    expect(send.ok).toBe(false);

    const restart = await manager.restart("skill:flaky", {
      onlineOptions: { method: "local" },
    });
    expect(restart.ok).toBe(false);

    const runtime = manager.getRuntimeStatus().find((item) => item.key === "skill:flaky");
    expect(runtime?.state).toBe("error");
    expect(runtime?.lastError).toContain("restart failed");
  });

  it("continues offlineAll even when one plugin fails", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "good",
      type: "skill",
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "bad",
      type: "skill",
      throwOnOffline: true,
    });

    const manager = createManager();
    manager.discoverPlugins();
    await manager.onlineAll();

    const results = await manager.offlineAll();

    expect(results.length).toBe(2);
    expect(results.some((item) => item.ok)).toBe(true);
    expect(results.some((item) => !item.ok)).toBe(true);

    const goodRuntime = manager.getRuntimeStatus().find((item) => item.key === "skill:good");
    expect(goodRuntime?.state).toBe("offline");
  });
});
