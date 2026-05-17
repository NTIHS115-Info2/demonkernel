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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "discord-plugin-integration-"));
  const skillPath = path.join(root, "skillPlugins");
  const systemPath = path.join(root, "systemPlugins");
  fs.mkdirSync(skillPath, { recursive: true });
  fs.mkdirSync(systemPath, { recursive: true });
  return { root, skillPath, systemPath };
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function writeDiscordFixturePlugin(basePath: string): void {
  const pluginDir = path.join(basePath, "discord");
  fs.mkdirSync(pluginDir, { recursive: true });

  const sourceManifestPath = path.join(
    process.cwd(),
    "src",
    "systemPlugins",
    "discord",
    "plugin.manifest.json"
  );
  const sourceManifest = JSON.parse(
    fs.readFileSync(sourceManifestPath, "utf-8")
  ) as Record<string, unknown>;
  (sourceManifest.meta as Record<string, unknown>).entry = "index.js";

  writeJson(path.join(pluginDir, "plugin.manifest.json"), sourceManifest);

  const moduleCode = `
const { EventEmitter } = require("events");
let online = false;
const conversation = new EventEmitter();

module.exports = {
  async online() { online = true; },
  async offline() { online = false; },
  async restart(options) { await this.offline(); await this.online(options); },
  async state() { return { status: online ? 1 : 0 }; },
  async openConversationStream() {
    return conversation;
  },
  async sendMessage(payload) {
    return {
      ok: true,
      channelId: payload?.channelId ?? "fixture-channel",
      messageId: "fixture-message-id"
    };
  },
  async startTyping(payload) {
    return {
      ok: true,
      channelId: payload?.channelId ?? "fixture-channel",
      active: true,
      refCount: 1
    };
  },
  async stopTyping(payload) {
    return {
      ok: true,
      channelId: payload?.channelId ?? "fixture-channel",
      active: false,
      refCount: 0
    };
  },
  getCapabilityBindings() {
    return [
      {
        capabilityId: "system.discord.conversation.stream",
        createProvider(pluginInstance) {
          return { openConversationStream: pluginInstance.openConversationStream.bind(pluginInstance) };
        }
      },
      {
        capabilityId: "system.discord.message.send",
        createProvider(pluginInstance) {
          return { sendMessage: pluginInstance.sendMessage.bind(pluginInstance) };
        }
      },
      {
        capabilityId: "system.discord.typing.start",
        createProvider(pluginInstance) {
          return { startTyping: pluginInstance.startTyping.bind(pluginInstance) };
        }
      },
      {
        capabilityId: "system.discord.typing.stop",
        createProvider(pluginInstance) {
          return { stopTyping: pluginInstance.stopTyping.bind(pluginInstance) };
        }
      }
    ];
  },
  async send(payload) {
    const action = payload?.action;

    if (action === "conversation.stream" || action === "system.discord.conversation.stream") {
      return this.openConversationStream();
    }

    if (action === "message.send" || action === "system.discord.message.send") {
      return this.sendMessage(payload);
    }

    if (action === "typing.start" || action === "system.discord.typing.start") {
      return this.startTyping(payload);
    }

    if (action === "typing.stop" || action === "system.discord.typing.stop") {
      return this.stopTyping(payload);
    }

    throw new Error("unsupported action");
  }
};
`;

  fs.writeFileSync(path.join(pluginDir, "index.js"), moduleCode.trimStart(), "utf-8");
}

describe("pluginsManager integration: discord capabilities", () => {
  let tempRoot: TempRoot;
  let capabilitiesManager: CapabilitiesManager;
  let capabilityRegistry: CapabilityRegistry;

  beforeEach(() => {
    tempRoot = createTempRoot();
    capabilitiesManager = new CapabilitiesManager();
    capabilityRegistry = new CapabilityRegistry({ capabilitiesManager });
    writeDiscordFixturePlugin(tempRoot.systemPath);
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

  it("discovers discord capabilities and registers providers after online", async () => {
    const manager = createManager();
    const summary = manager.discoverPlugins();

    expect(summary.invalid).toBe(0);
    expect(
      capabilitiesManager
        .listCapabilitiesByPlugin("system:discord")
        .map((item) => item.id)
    ).toEqual([
      "system.discord.conversation.stream",
      "system.discord.message.send",
      "system.discord.typing.start",
      "system.discord.typing.stop",
    ]);

    const onlineResult = await manager.online("system:discord", {
      onlineOptions: {
        method: "local",
      },
    });
    expect(onlineResult.ok).toBe(true);

    const streamProvider = capabilityRegistry.resolve("system.discord.conversation.stream");
    const sendProvider = capabilityRegistry.resolve("system.discord.message.send");
    const typingStartProvider = capabilityRegistry.resolve("system.discord.typing.start");
    const typingStopProvider = capabilityRegistry.resolve("system.discord.typing.stop");

    expect((sendProvider as Record<string, unknown>).startTyping).toBeUndefined();
    expect((typingStartProvider as Record<string, unknown>).sendMessage).toBeUndefined();

    const streamResult = await (
      streamProvider as { openConversationStream: () => Promise<{ on?: (...args: unknown[]) => unknown }> }
    ).openConversationStream();
    expect(typeof streamResult.on).toBe("function");

    const sendResult = await (
      sendProvider as {
        sendMessage: (input: { channelId: string; message: string }) => Promise<{
          ok: boolean;
          channelId: string;
          messageId: string | null;
        }>;
      }
    ).sendMessage({
      channelId: "target-channel",
      message: "hello",
    });
    expect(sendResult).toEqual({
      ok: true,
      channelId: "target-channel",
      messageId: "fixture-message-id",
    });

    const typingStartResult = await (
      typingStartProvider as {
        startTyping: (input: { channelId: string }) => Promise<{
          ok: boolean;
          channelId: string;
          active: boolean;
          refCount: number;
        }>;
      }
    ).startTyping({
      channelId: "target-channel",
    });
    expect(typingStartResult).toEqual({
      ok: true,
      channelId: "target-channel",
      active: true,
      refCount: 1,
    });

    const typingStopResult = await (
      typingStopProvider as {
        stopTyping: (input: { channelId: string }) => Promise<{
          ok: boolean;
          channelId: string;
          active: boolean;
          refCount: number;
        }>;
      }
    ).stopTyping({
      channelId: "target-channel",
    });
    expect(typingStopResult).toEqual({
      ok: true,
      channelId: "target-channel",
      active: false,
      refCount: 0,
    });
  });
});
