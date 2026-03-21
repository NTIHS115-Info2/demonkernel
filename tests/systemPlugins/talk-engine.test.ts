import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CAPABILITY_LLM_CHAT_STREAM = "system.llm.remote.chat.stream";
const CAPABILITY_DISCORD_STREAM = "system.discord.conversation.stream";
const CAPABILITY_DISCORD_SEND = "system.discord.message.send";
const CAPABILITY_DISCORD_TYPING_START = "system.discord.typing.start";
const CAPABILITY_DISCORD_TYPING_STOP = "system.discord.typing.stop";

const registryMock = vi.hoisted(() => {
  const providers = new Map<string, { send: ReturnType<typeof vi.fn> }>();

  return {
    resolve: vi.fn((capabilityId: string) => {
      const provider = providers.get(capabilityId);
      if (!provider) {
        throw new Error(`capability provider not registered: ${capabilityId}`);
      }

      return {
        send: provider.send,
      };
    }),

    setProvider(capabilityId: string, implementation: (payload: Record<string, unknown>) => Promise<unknown>): void {
      providers.set(capabilityId, {
        send: vi.fn(implementation),
      });
    },

    getSendMock(capabilityId: string): ReturnType<typeof vi.fn> {
      const provider = providers.get(capabilityId);
      if (!provider) {
        throw new Error(`capability provider not registered: ${capabilityId}`);
      }
      return provider.send;
    },

    reset(): void {
      this.resolve.mockReset();
      providers.clear();
    },
  };
});

vi.mock("../../src/core/registry", () => ({
  default: {
    resolve: registryMock.resolve,
  },
}));

type PluginModule = {
  online(options: Record<string, unknown>): Promise<void>;
  offline(): Promise<void>;
  restart(options: Record<string, unknown>): Promise<void>;
  state(): Promise<{ status: number }>;
  send(options: Record<string, unknown>): Promise<unknown>;
};

let pluginModule: PluginModule | null = null;

async function loadPluginModule(): Promise<PluginModule> {
  vi.resetModules();
  const imported = await import("../../src/systemPlugins/talk-engine/index");
  pluginModule = (imported.default ?? imported) as PluginModule;
  return pluginModule;
}

function createLlmEmitter(options: {
  chunks?: string[];
  error?: unknown;
  delayMs?: number;
} = {}): EventEmitter & { abort: ReturnType<typeof vi.fn> } {
  const emitter = new EventEmitter() as EventEmitter & { abort: ReturnType<typeof vi.fn> };
  emitter.abort = vi.fn(() => {
    emitter.emit("abort");
  });

  setTimeout(() => {
    if (options.error) {
      emitter.emit("error", options.error);
      return;
    }

    for (const chunk of options.chunks ?? []) {
      emitter.emit("data", chunk, { choices: [{ delta: { content: chunk } }] }, null);
    }
    emitter.emit("end");
  }, options.delayMs ?? 0);

  return emitter;
}

function createDiscordConversationEvent(content: string, channelId = "channel-1") {
  return {
    source: "mention" as const,
    content,
    rawContent: content,
    channelId,
    guildId: "guild-1",
    messageId: `message-${Math.random()}`,
    replyToMessageId: null,
    author: {
      id: "user-1",
      name: "owner",
      isOwner: true,
    },
    receivedAt: new Date().toISOString(),
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 1200): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("system plugin: talk-engine", () => {
  beforeEach(() => {
    registryMock.reset();
  });

  afterEach(async () => {
    if (pluginModule) {
      try {
        await pluginModule.offline();
      } catch {
        // ignore cleanup failure
      }
      pluginModule = null;
    }

    vi.restoreAllMocks();
  });

  it("supports online/offline/restart/state lifecycle", async () => {
    const plugin = await loadPluginModule();

    await plugin.online({ method: "local", relayEnabled: false });
    expect((await plugin.state()).status).toBe(1);

    await plugin.restart({ method: "local", relayEnabled: false });
    expect((await plugin.state()).status).toBe(1);

    await plugin.offline();
    expect((await plugin.state()).status).toBe(0);
  });

  it("supports talk.nostream and converts payload into llm gateway format", async () => {
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, async () => createLlmEmitter({
      chunks: ["hello", " world"],
    }));

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", relayEnabled: false });

    const result = await plugin.send({
      action: "talk.nostream",
      message: "hi there",
      talker: "tester",
      model: "gpt-test",
      params: { temperature: 0.1 },
    }) as { reply: string };

    expect(result).toEqual({ reply: "hello world" });

    const llmSend = registryMock.getSendMock(CAPABILITY_LLM_CHAT_STREAM);
    const payload = llmSend.mock.calls[0][0] as {
      action: string;
      model: string;
      messages: Array<{ role: string; content: string }>;
      params: { temperature: number };
    };

    expect(payload.action).toBe("system.llm.remote.chat.stream");
    expect(payload.model).toBe("gpt-test");
    expect(payload.messages[0]).toEqual({
      role: "user",
      content: "<sender=tester>: hi there",
    });
    expect(payload.params).toEqual({ temperature: 0.1 });
  });

  it("supports talk.stream and returns llm stream emitter as-is", async () => {
    const llmEmitter = createLlmEmitter({ chunks: ["streaming"] });
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, async () => llmEmitter);

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", relayEnabled: false });

    const stream = await plugin.send({
      action: "system.talk.engine.stream",
      message: "stream this",
    }) as EventEmitter;

    expect(stream).toBe(llmEmitter);
  });

  it("runs relay flow: conversation -> typing.start -> llm -> message.send -> typing.stop", async () => {
    const callSequence: string[] = [];
    const conversationStream = new EventEmitter();

    registryMock.setProvider(CAPABILITY_DISCORD_STREAM, async () => conversationStream);
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_START, async () => {
      callSequence.push("typing.start");
      return { ok: true };
    });
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_STOP, async () => {
      callSequence.push("typing.stop");
      return { ok: true };
    });
    registryMock.setProvider(CAPABILITY_DISCORD_SEND, async (payload) => {
      callSequence.push(`message.send:${String(payload.message)}`);
      return { ok: true, channelId: payload.channelId, messageId: "m1" };
    });
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, async (payload) => {
      callSequence.push("llm.send");
      const messages = payload.messages as Array<{ content?: string }>;
      const content = messages[0]?.content ?? "";
      return createLlmEmitter({
        chunks: [`reply:${content}`],
      });
    });

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local" });

    conversationStream.emit("data", createDiscordConversationEvent("hello relay", "channel-a"));

    await waitFor(() => callSequence.some((item) => item.startsWith("message.send:")));
    expect(callSequence).toEqual([
      "typing.start",
      "llm.send",
      "message.send:reply:<sender=owner>: hello relay",
      "typing.stop",
    ]);
  });

  it("uses fallback error reply on relay failure and still stops typing", async () => {
    const conversationStream = new EventEmitter();
    const sentMessages: string[] = [];
    let stopCount = 0;

    registryMock.setProvider(CAPABILITY_DISCORD_STREAM, async () => conversationStream);
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_START, async () => ({ ok: true }));
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_STOP, async () => {
      stopCount += 1;
      return { ok: true };
    });
    registryMock.setProvider(CAPABILITY_DISCORD_SEND, async (payload) => {
      sentMessages.push(String(payload.message));
      return { ok: true, channelId: payload.channelId, messageId: "m2" };
    });
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, async () => createLlmEmitter({
      error: new Error("llm failed"),
    }));

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local" });

    conversationStream.emit("data", createDiscordConversationEvent("boom", "channel-b"));

    await waitFor(() => sentMessages.length === 1);
    expect(sentMessages[0]).toBe("目前無法回覆，請稍後再試。");
    expect(stopCount).toBe(1);
  });

  it("processes relay events in FIFO order", async () => {
    const conversationStream = new EventEmitter();
    const sentMessages: string[] = [];
    let sequence = 0;

    registryMock.setProvider(CAPABILITY_DISCORD_STREAM, async () => conversationStream);
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_START, async () => ({ ok: true }));
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_STOP, async () => ({ ok: true }));
    registryMock.setProvider(CAPABILITY_DISCORD_SEND, async (payload) => {
      sentMessages.push(String(payload.message));
      return { ok: true, channelId: payload.channelId, messageId: "m3" };
    });
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, async () => {
      sequence += 1;
      return createLlmEmitter({
        chunks: [`reply-${sequence}`],
        delayMs: sequence === 1 ? 40 : 0,
      });
    });

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local" });

    conversationStream.emit("data", createDiscordConversationEvent("first", "channel-c"));
    conversationStream.emit("data", createDiscordConversationEvent("second", "channel-c"));

    await waitFor(() => sentMessages.length === 2);
    expect(sentMessages).toEqual(["reply-1", "reply-2"]);
  });
});

