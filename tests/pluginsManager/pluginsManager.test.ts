/* 註解：PluginsManager 行為測試（含虛假插件依賴/錯誤情境）。 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import defaultCapabilitiesManager, { CapabilitiesManager } from "../../src/core/capabilities";
import { CapabilityRegistry } from "../../src/core/registry";
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
  capabilities?: {
    provides: Array<string | Record<string, unknown>>;
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
    ...(options.capabilities ? { capabilities: options.capabilities } : {}),
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
  let capabilitiesManager: CapabilitiesManager;
  let capabilityRegistry: CapabilityRegistry;

  beforeEach(() => {
    tempRoot = createTempPluginRoot();
    capabilitiesManager = new CapabilitiesManager();
    capabilityRegistry = new CapabilityRegistry({ capabilitiesManager });
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
      capabilitiesManager,
      capabilityRegistry,
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

  it("starts two-node cyclic dependencies by startupWeight", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "a",
      type: "skill",
      startupWeight: 20,
      dependencies: {
        skill: { b: "1.0.0" },
      },
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "b",
      type: "skill",
      startupWeight: 10,
      dependencies: {
        skill: { a: "1.0.0" },
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const report = await manager.onlineAll();

    expect(report.failed).toHaveLength(0);
    expect(report.blocked).toHaveLength(0);
    expect(report.started).toEqual(["skill:a", "skill:b"]);
    expect(report.cycles.length).toBeGreaterThanOrEqual(1);
  });

  it("starts equal-weight cyclic dependencies in the same wave", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "a",
      type: "skill",
      startupWeight: 10,
      onlineDelayMs: 120,
      dependencies: {
        skill: { b: "1.0.0" },
      },
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "b",
      type: "skill",
      startupWeight: 10,
      onlineDelayMs: 120,
      dependencies: {
        skill: { a: "1.0.0" },
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const start = Date.now();
    const report = await manager.onlineAll();
    const elapsed = Date.now() - start;

    expect(report.failed).toHaveLength(0);
    expect(report.blocked).toHaveLength(0);
    expect(report.started).toEqual(["skill:a", "skill:b"]);
    expect((globalThis as any).__pmEvents.slice(0, 2)).toEqual([
      "online:skill:a",
      "online:skill:b",
    ]);
    expect(elapsed).toBeLessThan(230);
  });

  it("handles three-node cycle with mixed startupWeight by waves", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "a",
      type: "skill",
      startupWeight: 30,
      dependencies: {
        skill: { b: "1.0.0" },
      },
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "b",
      type: "skill",
      startupWeight: 20,
      dependencies: {
        skill: { c: "1.0.0" },
      },
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "c",
      type: "skill",
      startupWeight: 10,
      dependencies: {
        skill: { a: "1.0.0" },
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const report = await manager.onlineAll();

    expect(report.failed).toHaveLength(0);
    expect(report.blocked).toHaveLength(0);
    expect(report.started).toEqual(["skill:a", "skill:b", "skill:c"]);
    expect(report.cycles.some((cycle) => cycle.includes("skill:a"))).toBe(true);
  });

  it("handles multi-dependency dense SCC: A->BCD, B/C/D->A", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "a",
      type: "skill",
      startupWeight: 40,
      dependencies: {
        skill: { b: "1.0.0", c: "1.0.0", d: "1.0.0" },
      },
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "b",
      type: "skill",
      startupWeight: 20,
      dependencies: {
        skill: { a: "1.0.0" },
      },
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "c",
      type: "skill",
      startupWeight: 20,
      dependencies: {
        skill: { a: "1.0.0" },
      },
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "d",
      type: "skill",
      startupWeight: 10,
      dependencies: {
        skill: { a: "1.0.0" },
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const report = await manager.onlineAll();

    expect(report.failed).toHaveLength(0);
    expect(report.blocked).toHaveLength(0);
    expect(report.started).toEqual(["skill:a", "skill:b", "skill:c", "skill:d"]);
    expect(report.cycles.some((cycle) => cycle.includes("skill:a"))).toBe(true);
  });

  it("handles mixed graph: C outside SCC, then A/B/D SCC by weight", async () => {
    createFakePlugin(tempRoot.skillPath, {
      name: "a",
      type: "skill",
      startupWeight: 40,
      dependencies: {
        skill: { b: "1.0.0", c: "1.0.0", d: "1.0.0" },
      },
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "b",
      type: "skill",
      startupWeight: 30,
      dependencies: {
        skill: { c: "1.0.0", d: "1.0.0" },
      },
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "c",
      type: "skill",
      startupWeight: 50,
    });

    createFakePlugin(tempRoot.skillPath, {
      name: "d",
      type: "skill",
      startupWeight: 20,
      dependencies: {
        skill: { a: "1.0.0", c: "1.0.0" },
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const report = await manager.onlineAll();

    expect(report.failed).toHaveLength(0);
    expect(report.blocked).toHaveLength(0);
    expect(report.started).toEqual(["skill:c", "skill:a", "skill:b", "skill:d"]);
    expect(report.cycles.some((cycle) => cycle.includes("skill:a") && cycle.includes("skill:d"))).toBe(true);
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

  it("keeps capability provider mapping when restart preflight validation fails", async () => {
    createFakePlugin(tempRoot.systemPath, {
      name: "provider-restart-validation-system",
      type: "system",
      capabilities: {
        provides: ["system.echo.message"],
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const online = await manager.online("system:provider-restart-validation-system", {
      onlineOptions: { method: "local" },
    });
    expect(online.ok).toBe(true);
    expect(capabilityRegistry.has("system.echo.message")).toBe(true);

    const restart = await manager.restart("system:provider-restart-validation-system", {
      onlineOptions: { method: "remote" },
    });
    expect(restart.ok).toBe(false);
    expect(restart.error).toContain("method remote is not allowed");

    expect(capabilityRegistry.has("system.echo.message")).toBe(true);
    const provider = capabilityRegistry.resolve("system.echo.message");
    await expect(provider.send({ message: "still-routable" })).resolves.toEqual({
      message: "still-routable",
    });
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

  it("registers system plugin capabilities during discovery", () => {
    createFakePlugin(tempRoot.systemPath, {
      name: "cap-system",
      type: "system",
      capabilities: {
        provides: ["system.echo.message"],
      },
    });

    const manager = createManager();
    const summary = manager.discoverPlugins();

    expect(summary.invalid).toBe(0);
    expect(capabilitiesManager.listProviders("system.echo.message")).toEqual(["system:cap-system"]);
    expect(capabilitiesManager.listCapabilitiesByPlugin("system:cap-system").map((item) => item.id)).toEqual([
      "system.echo.message",
    ]);
  });

  it("registers capability provider after plugin online and allows direct send()", async () => {
    createFakePlugin(tempRoot.systemPath, {
      name: "provider-system",
      type: "system",
      capabilities: {
        provides: ["system.echo.message"],
      },
    });

    const manager = createManager();
    const summary = manager.discoverPlugins();
    expect(summary.invalid).toBe(0);

    const report = await manager.onlineAll({
      defaultOnlineOptions: { method: "local" },
    });

    expect(report.failed).toHaveLength(0);
    expect(capabilityRegistry.has("system.echo.message")).toBe(true);

    const provider = capabilityRegistry.resolve("system.echo.message");
    const result = await provider.send({ message: "hello registry" });
    expect(result).toEqual({ message: "hello registry" });
  });

  it("removes capability provider when plugin goes offline", async () => {
    createFakePlugin(tempRoot.systemPath, {
      name: "provider-offline-system",
      type: "system",
      capabilities: {
        provides: ["system.echo.message"],
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const online = await manager.online("system:provider-offline-system", {
      onlineOptions: { method: "local" },
    });
    expect(online.ok).toBe(true);
    expect(capabilityRegistry.has("system.echo.message")).toBe(true);

    const offline = await manager.offline("system:provider-offline-system");
    expect(offline.ok).toBe(true);
    expect(capabilityRegistry.has("system.echo.message")).toBe(false);
    expect(capabilityRegistry.tryResolve("system.echo.message")).toBeNull();
  });

  it("clears stale capability mappings when discover rescans and plugin is removed", async () => {
    const pluginDir = path.join(tempRoot.systemPath, "provider-discover-system");
    createFakePlugin(tempRoot.systemPath, {
      name: "provider-discover-system",
      type: "system",
      capabilities: {
        provides: ["system.echo.message"],
      },
    });

    const manager = createManager();
    manager.discoverPlugins();

    const online = await manager.online("system:provider-discover-system", {
      onlineOptions: { method: "local" },
    });
    expect(online.ok).toBe(true);
    expect(capabilityRegistry.has("system.echo.message")).toBe(true);

    fs.rmSync(pluginDir, { recursive: true, force: true });

    const summary = manager.discoverPlugins();
    expect(summary.registered).toBe(0);
    expect(capabilityRegistry.has("system.echo.message")).toBe(false);
  });

  it("fails second plugin startup when capability provider is already registered", async () => {
    createFakePlugin(tempRoot.systemPath, {
      name: "provider-a-system",
      type: "system",
      capabilities: {
        provides: ["system.echo.message"],
      },
    });

    createFakePlugin(tempRoot.systemPath, {
      name: "provider-b-system",
      type: "system",
      capabilities: {
        provides: ["system.echo.message"],
      },
    });

    const manager = createManager();
    const summary = manager.discoverPlugins();
    expect(summary.invalid).toBe(0);

    const report = await manager.onlineAll({
      defaultOnlineOptions: { method: "local" },
    });

    expect(report.started).toHaveLength(1);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0].reason).toContain("capability already registered");
    expect(capabilityRegistry.has("system.echo.message")).toBe(true);
  });

  it("marks system plugin invalid when capability default id is unknown", () => {
    createFakePlugin(tempRoot.systemPath, {
      name: "bad-cap-system",
      type: "system",
      capabilities: {
        provides: ["system.missing.capability"],
      },
    });

    const manager = createManager();
    const summary = manager.discoverPlugins();

    expect(summary.registered).toBe(0);
    expect(summary.invalid).toBe(1);

    const invalid = manager.getInvalidPlugins();
    expect(invalid[0].reason).toContain("unknown default capability id");
  });

  it("uses isolated capabilities manager when options.capabilitiesManager is not provided", () => {
    defaultCapabilitiesManager.reset();

    createFakePlugin(tempRoot.systemPath, {
      name: "isolated-cap-system",
      type: "system",
      capabilities: {
        provides: ["system.echo.message"],
      },
    });

    const manager = new PluginsManager({
      skillPluginsPath: tempRoot.skillPath,
      systemPluginsPath: tempRoot.systemPath,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    });
    const summary = manager.discoverPlugins();

    expect(summary.invalid).toBe(0);
    expect(defaultCapabilitiesManager.listProviders("system.echo.message")).toEqual([]);

    defaultCapabilitiesManager.reset();
  });
});
