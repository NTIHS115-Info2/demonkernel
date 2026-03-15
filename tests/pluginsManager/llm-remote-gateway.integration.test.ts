import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CapabilitiesManager } from "../../src/core/capabilities";
import { PluginsManager } from "../../src/core/pluginsManager";
import { CapabilityRegistry } from "../../src/core/registry";

type TempRoot = {
  root: string;
  skillPath: string;
  systemPath: string;
};

function createTempRoot(): TempRoot {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "llm-remote-gateway-integration-"));
  const skillPath = path.join(root, "skillPlugins");
  const systemPath = path.join(root, "systemPlugins");
  fs.mkdirSync(skillPath, { recursive: true });
  fs.mkdirSync(systemPath, { recursive: true });
  return { root, skillPath, systemPath };
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function writeGatewayFixturePlugin(basePath: string): void {
  const pluginDir = path.join(basePath, "llm-remote-gateway");
  fs.mkdirSync(pluginDir, { recursive: true });

  const sourceManifestPath = path.join(
    process.cwd(),
    "src",
    "systemPlugins",
    "llm-remote-gateway",
    "plugin.manifest.json"
  );
  const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, "utf-8")) as Record<string, unknown>;
  (sourceManifest.meta as Record<string, unknown>).entry = "index.js";

  writeJson(path.join(pluginDir, "plugin.manifest.json"), sourceManifest);

  const moduleCode = `
const { EventEmitter } = require("events");
let online = false;

module.exports = {
  async online() { online = true; },
  async offline() { online = false; },
  async restart(options) { await this.offline(); await this.online(options); },
  async state() { return { status: online ? 1 : 0 }; },
  async send(payload) {
    const action = Array.isArray(payload) || Array.isArray(payload?.messages)
      ? "chat.stream"
      : payload?.action;

    if (action === "chat.stream" || action === "system.llm.remote.chat.stream") {
      const emitter = new EventEmitter();
      emitter.abort = () => emitter.emit("abort");
      setTimeout(() => {
        emitter.emit("data", "hello", { choices: [{ delta: { content: "hello" } }] }, null);
        emitter.emit("end");
      }, 0);
      return emitter;
    }

    if (action === "models.list" || action === "system.llm.remote.models.list") {
      return {
        ok: true,
        status: 200,
        models: [{ id: "fixture-model" }],
        raw: { data: [{ id: "fixture-model" }] }
      };
    }

    if (action === "health.check" || action === "system.llm.remote.health.check") {
      return {
        ok: true,
        status: 200,
        message: "ok"
      };
    }

    throw new Error("unsupported action");
  }
};
`;

  fs.writeFileSync(path.join(pluginDir, "index.js"), moduleCode.trimStart(), "utf-8");
}

describe("pluginsManager integration: llm-remote-gateway capabilities", () => {
  let tempRoot: TempRoot;
  let capabilitiesManager: CapabilitiesManager;
  let capabilityRegistry: CapabilityRegistry;

  beforeEach(() => {
    tempRoot = createTempRoot();
    capabilitiesManager = new CapabilitiesManager();
    capabilityRegistry = new CapabilityRegistry({ capabilitiesManager });
    writeGatewayFixturePlugin(tempRoot.systemPath);
  });

  afterEach(() => {
    fs.rmSync(tempRoot.root, { recursive: true, force: true });
  });

  function createManager(): PluginsManager {
    return new PluginsManager({
      skillPluginsPath: tempRoot.skillPath,
      systemPluginsPath: tempRoot.systemPath,
      capabilitiesManager,
      capabilityRegistry,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    });
  }

  it("discovers 3 gateway capabilities and registers providers after online", async () => {
    const manager = createManager();
    const summary = manager.discoverPlugins();
    const gatewayCapabilities = capabilitiesManager.listCapabilitiesByPlugin("system:llm-remote-gateway");

    expect(summary.invalid).toBe(0);
    expect(gatewayCapabilities.map((item) => item.id)).toEqual([
      "system.llm.remote.chat.stream",
      "system.llm.remote.health.check",
      "system.llm.remote.models.list",
    ]);
    const capabilityById = new Map(gatewayCapabilities.map((capability) => [capability.id, capability]));
    expect(capabilityById.get("system.llm.remote.models.list")?.input.required).toContain("action");
    expect(capabilityById.get("system.llm.remote.health.check")?.input.required).toContain("action");

    const online = await manager.online("system:llm-remote-gateway", {
      onlineOptions: {
        method: "remote",
        baseUrl: "http://localhost:8080",
      },
    });
    expect(online.ok).toBe(true);

    const chatProvider = capabilityRegistry.resolve("system.llm.remote.chat.stream");
    const modelsProvider = capabilityRegistry.resolve("system.llm.remote.models.list");
    const healthProvider = capabilityRegistry.resolve("system.llm.remote.health.check");

    const chatResult = await chatProvider.send({
      action: "system.llm.remote.chat.stream",
      messages: [{ role: "user", content: "hello" }],
    }) as { on?: (...args: unknown[]) => unknown; abort?: () => void };
    expect(typeof chatResult.on).toBe("function");
    expect(typeof chatResult.abort).toBe("function");

    const modelsResult = await modelsProvider.send({
      action: "system.llm.remote.models.list",
    }) as { ok: boolean; status: number };
    expect(modelsResult.ok).toBe(true);
    expect(modelsResult.status).toBe(200);

    const healthResult = await healthProvider.send({
      action: "system.llm.remote.health.check",
    }) as { ok: boolean; status: number; message: string };
    expect(healthResult.ok).toBe(true);
    expect(healthResult.status).toBe(200);
    expect(healthResult.message).toBe("ok");
  });
});
