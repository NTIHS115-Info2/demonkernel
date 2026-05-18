import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CapabilitiesManager } from "../../src/core/capabilities";
import { PluginsManager } from "../../src/core/pluginsManager";
import { CapabilityRegistry } from "../../src/core/registry";

const CAPABILITY_SYSTEM_PROMPT_GET = "system.prompt.manager.get";

type TempRoot = {
  root: string;
  skillPath: string;
  systemPath: string;
};

function createTempRoot(): TempRoot {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "system-prompt-manager-integration-"));
  const skillPath = path.join(root, "skillPlugins");
  const systemPath = path.join(root, "systemPlugins");
  fs.mkdirSync(skillPath, { recursive: true });
  fs.mkdirSync(systemPath, { recursive: true });
  return { root, skillPath, systemPath };
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function writeSystemPromptManagerFixturePlugin(basePath: string): void {
  const pluginDir = path.join(basePath, "system-prompt-manager");
  fs.mkdirSync(pluginDir, { recursive: true });

  const sourceManifestPath = path.join(
    process.cwd(),
    "src",
    "systemPlugins",
    "system-prompt-manager",
    "plugin.manifest.json"
  );
  const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, "utf-8")) as Record<string, unknown>;
  (sourceManifest.meta as Record<string, unknown>).entry = "index.js";
  writeJson(path.join(pluginDir, "plugin.manifest.json"), sourceManifest);

  const moduleCode = `
let online = false;

module.exports = {
  async online(options) {
    if (options?.method && options.method !== "local") {
      throw new Error('online requires method="local"');
    }
    online = true;
  },
  async offline() { online = false; },
  async restart(options) { await this.offline(); await this.online(options); },
  async state() { return { status: online ? 1 : 0 }; },
  async getSystemPrompt(payload) {
    return "fixture:" + (payload?.state || "missing");
  },
  getCapabilityBindings() {
    return [
      {
        capabilityId: "${CAPABILITY_SYSTEM_PROMPT_GET}",
        createProvider(pluginInstance) {
          return { getSystemPrompt: pluginInstance.getSystemPrompt.bind(pluginInstance) };
        }
      }
    ];
  },
  async send(payload) {
    const action = payload?.action;
    if (action === "${CAPABILITY_SYSTEM_PROMPT_GET}" || action === "prompt.get") {
      return this.getSystemPrompt(payload);
    }
    throw new Error("unsupported action");
  }
};
`;

  fs.writeFileSync(path.join(pluginDir, "index.js"), moduleCode.trimStart(), "utf-8");
}

describe("pluginsManager integration: system-prompt-manager capabilities", () => {
  let tempRoot: TempRoot;
  let capabilitiesManager: CapabilitiesManager;
  let capabilityRegistry: CapabilityRegistry;

  beforeEach(() => {
    tempRoot = createTempRoot();
    capabilitiesManager = new CapabilitiesManager();
    capabilityRegistry = new CapabilityRegistry({ capabilitiesManager });
    writeSystemPromptManagerFixturePlugin(tempRoot.systemPath);
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

  it("discovers system-prompt-manager, brings it online, and registers its prompt provider", async () => {
    const manager = createManager();
    const summary = manager.discoverPlugins();
    expect(summary.invalid).toBe(0);

    const discoveredPromptManager = manager
      .getRegistrySnapshot()
      .find((item) => item.key === "system:system-prompt-manager");
    expect(discoveredPromptManager).toEqual(expect.objectContaining({
      key: "system:system-prompt-manager",
      type: "system",
      name: "system-prompt-manager",
    }));

    const promptCapabilities = capabilitiesManager.listCapabilitiesByPlugin("system:system-prompt-manager");
    expect(promptCapabilities.map((item) => item.id)).toEqual([CAPABILITY_SYSTEM_PROMPT_GET]);

    const online = await manager.online("system:system-prompt-manager", {
      onlineOptions: { method: "local" },
    });
    expect(online.ok).toBe(true);
    expect(manager.getRuntimeStatus()).toContainEqual(expect.objectContaining({
      key: "system:system-prompt-manager",
      state: "online",
      onlineMethod: "local",
    }));

    const provider = capabilityRegistry.resolve(CAPABILITY_SYSTEM_PROMPT_GET) as {
      getSystemPrompt(input: { state: string }): Promise<string>;
    };
    await expect(provider.getSystemPrompt({ state: "common" })).resolves.toBe("fixture:common");
    expect(capabilityRegistry.list()).toContainEqual(expect.objectContaining({
      capabilityId: CAPABILITY_SYSTEM_PROMPT_GET,
      metadata: expect.objectContaining({
        pluginKey: "system:system-prompt-manager",
      }),
    }));
  });
});
