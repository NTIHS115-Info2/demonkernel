import { EventEmitter } from "node:events";
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "talk-engine-integration-"));
  const skillPath = path.join(root, "skillPlugins");
  const systemPath = path.join(root, "systemPlugins");
  fs.mkdirSync(skillPath, { recursive: true });
  fs.mkdirSync(systemPath, { recursive: true });
  return { root, skillPath, systemPath };
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function writeLlmFixturePlugin(basePath: string): void {
  const pluginDir = path.join(basePath, "llm-remote-gateway");
  fs.mkdirSync(pluginDir, { recursive: true });

  writeJson(path.join(pluginDir, "plugin.manifest.json"), {
    meta: {
      name: "llm-remote-gateway",
      version: "1.1.0",
      type: "system",
      entry: "index.js",
    },
    runtime: {
      startupWeight: 10,
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
    },
    dependencies: {
      skill: {},
      system: {},
    },
    capabilities: {
      provides: [
        {
          id: "system.llm.remote.chat.stream",
          displayName: "LLM Remote Chat Stream",
          description: "fixture",
          version: "1.0.0",
          input: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: true,
          },
          output: {
            type: "object",
            additionalProperties: true,
          },
        },
      ],
    },
  });

  const moduleCode = `
const { EventEmitter } = require("events");
let online = false;

module.exports = {
  async online() { online = true; },
  async offline() { online = false; },
  async restart(options) { await this.offline(); await this.online(options); },
  async state() { return { status: online ? 1 : 0 }; },
  async streamChat(payload) {
    const emitter = new EventEmitter();
    emitter.abort = () => emitter.emit("abort");
    setTimeout(() => {
      const content = payload?.messages?.[0]?.content || "";
      emitter.emit("data", "fixture:" + content, { choices: [{ delta: { content: "fixture:" + content } }] }, null);
      emitter.emit("end");
    }, 0);
    return emitter;
  },
  getCapabilityBindings() {
    return [
      {
        capabilityId: "system.llm.remote.chat.stream",
        createProvider(pluginInstance) {
          return { streamChat: pluginInstance.streamChat.bind(pluginInstance) };
        }
      }
    ];
  },
  async send(payload) {
    return this.streamChat(payload);
  }
};
`;

  fs.writeFileSync(path.join(pluginDir, "index.js"), moduleCode.trimStart(), "utf-8");
}

function writeDiscordFixturePlugin(basePath: string): void {
  const pluginDir = path.join(basePath, "discord");
  fs.mkdirSync(pluginDir, { recursive: true });

  writeJson(path.join(pluginDir, "plugin.manifest.json"), {
    meta: {
      name: "discord",
      version: "0.3.0",
      type: "system",
      entry: "index.js",
    },
    runtime: {
      startupWeight: 50,
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
    },
    dependencies: {
      skill: {},
      system: {},
    },
    capabilities: {
      provides: [
        {
          id: "system.discord.conversation.stream",
          displayName: "Discord Conversation Stream",
          description: "fixture",
          version: "1.0.0",
          input: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: true,
          },
          output: {
            type: "object",
            additionalProperties: true,
          },
        },
        {
          id: "system.discord.message.send",
          displayName: "Discord Message Send",
          description: "fixture",
          version: "1.0.0",
          input: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: true,
          },
          output: {
            type: "object",
            additionalProperties: true,
          },
        },
        {
          id: "system.discord.typing.start",
          displayName: "Discord Typing Start",
          description: "fixture",
          version: "1.0.0",
          input: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: true,
          },
          output: {
            type: "object",
            additionalProperties: true,
          },
        },
        {
          id: "system.discord.typing.stop",
          displayName: "Discord Typing Stop",
          description: "fixture",
          version: "1.0.0",
          input: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: true,
          },
          output: {
            type: "object",
            additionalProperties: true,
          },
        },
      ],
    },
  });

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
    return { ok: true, channelId: payload?.channelId || "fixture-channel", messageId: "fixture-message" };
  },
  async startTyping(payload) {
    return { ok: true, channelId: payload?.channelId || "fixture-channel", active: true, refCount: 1 };
  },
  async stopTyping(payload) {
    return { ok: true, channelId: payload?.channelId || "fixture-channel", active: false, refCount: 0 };
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
    if (action === "system.discord.conversation.stream" || action === "conversation.stream") {
      return this.openConversationStream();
    }
    if (action === "system.discord.message.send" || action === "message.send") {
      return this.sendMessage(payload);
    }
    if (action === "system.discord.typing.start" || action === "typing.start") {
      return this.startTyping(payload);
    }
    if (action === "system.discord.typing.stop" || action === "typing.stop") {
      return this.stopTyping(payload);
    }
    throw new Error("unsupported action");
  }
};
`;

  fs.writeFileSync(path.join(pluginDir, "index.js"), moduleCode.trimStart(), "utf-8");
}

function writeTalkEngineFixturePlugin(basePath: string): void {
  const pluginDir = path.join(basePath, "talk-engine");
  fs.mkdirSync(pluginDir, { recursive: true });

  const sourceManifestPath = path.join(
    process.cwd(),
    "src",
    "systemPlugins",
    "talk-engine",
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
  async generateReply(payload) {
    return { reply: "fixture:" + (payload?.message || "") };
  },
  async streamReply() {
    const emitter = new EventEmitter();
    emitter.abort = () => emitter.emit("abort");
    setTimeout(() => {
      emitter.emit("data", "fixture-stream");
      emitter.emit("end");
    }, 0);
    return emitter;
  },
  getCapabilityBindings() {
    return [
      {
        capabilityId: "system.talk.engine.nostream",
        createProvider(pluginInstance) {
          return { generateReply: pluginInstance.generateReply.bind(pluginInstance) };
        }
      },
      {
        capabilityId: "system.talk.engine.stream",
        createProvider(pluginInstance) {
          return { streamReply: pluginInstance.streamReply.bind(pluginInstance) };
        }
      }
    ];
  },
  async send(payload) {
    const action = payload?.action;
    if (action === "talk.nostream" || action === "system.talk.engine.nostream") {
      return this.generateReply(payload);
    }
    if (action === "talk.stream" || action === "system.talk.engine.stream") {
      return this.streamReply(payload);
    }
    throw new Error("unsupported action");
  }
};
`;

  fs.writeFileSync(path.join(pluginDir, "index.js"), moduleCode.trimStart(), "utf-8");
}

describe("pluginsManager integration: talk-engine capabilities", () => {
  let tempRoot: TempRoot;
  let capabilitiesManager: CapabilitiesManager;
  let capabilityRegistry: CapabilityRegistry;

  beforeEach(() => {
    tempRoot = createTempRoot();
    capabilitiesManager = new CapabilitiesManager();
    capabilityRegistry = new CapabilityRegistry({ capabilitiesManager });

    writeLlmFixturePlugin(tempRoot.systemPath);
    writeDiscordFixturePlugin(tempRoot.systemPath);
    writeTalkEngineFixturePlugin(tempRoot.systemPath);
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

  it("discovers talk-engine capabilities and registers providers after online", async () => {
    const manager = createManager();
    const summary = manager.discoverPlugins();
    expect(summary.invalid).toBe(0);

    const talkCapabilities = capabilitiesManager.listCapabilitiesByPlugin("system:talk-engine");
    expect(talkCapabilities.map((item) => item.id)).toEqual([
      "system.talk.engine.nostream",
      "system.talk.engine.stream",
    ]);

    const startup = await manager.onlineAll({
      defaultOnlineOptions: { method: "local" },
    });
    expect(startup.failed).toHaveLength(0);
    expect(startup.blocked).toHaveLength(0);

    const noStreamProvider = capabilityRegistry.resolve("system.talk.engine.nostream");
    const streamProvider = capabilityRegistry.resolve("system.talk.engine.stream");

    const noStreamResult = await (
      noStreamProvider as { generateReply: (input: { message: string }) => Promise<{ reply: string }> }
    ).generateReply({
      message: "hello",
    });
    expect(noStreamResult).toEqual({ reply: "fixture:hello" });

    const streamResult = await (
      streamProvider as {
        streamReply: (input: { message: string }) => Promise<EventEmitter & { abort?: () => void }>;
      }
    ).streamReply({
      message: "hello",
    });
    expect(typeof streamResult.on).toBe("function");
    expect(typeof streamResult.abort).toBe("function");
  });
});
