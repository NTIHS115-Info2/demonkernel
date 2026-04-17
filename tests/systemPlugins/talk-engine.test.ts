/// <reference types="node" />

import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CAPABILITY_LLM_CHAT_STREAM = "system.llm.remote.chat.stream";
const CAPABILITY_DISCORD_STREAM = "system.discord.conversation.stream";
const CAPABILITY_DISCORD_SEND = "system.discord.message.send";
const CAPABILITY_DISCORD_TYPING_START = "system.discord.typing.start";
const CAPABILITY_DISCORD_TYPING_STOP = "system.discord.typing.stop";
const CAPABILITY_HISTORY_APPEND = "system.conversation.history.append";
const CAPABILITY_HISTORY_RECENT = "system.conversation.history.recent";
const CAPABILITY_HISTORY_CLEAR = "system.conversation.history.clear";

const registryMock = vi.hoisted(() => {
  const providers = new Map<string, Record<string, unknown>>();

  return {
    resolve: vi.fn((capabilityId: string) => {
      const provider = providers.get(capabilityId);
      if (!provider) {
        throw new Error(`capability provider not registered: ${capabilityId}`);
      }
      return provider;
    }),

    setProvider(capabilityId: string, provider: Record<string, unknown>): void {
      providers.set(capabilityId, provider);
    },

    getProviderMethodMock(capabilityId: string, methodName: string): ReturnType<typeof vi.fn> {
      const provider = providers.get(capabilityId);
      if (!provider) {
        throw new Error(`capability provider not registered: ${capabilityId}`);
      }

      const method = provider[methodName];
      if (!method || typeof method !== "function") {
        throw new Error(`provider method not found: ${capabilityId}.${methodName}`);
      }

      return method as ReturnType<typeof vi.fn>;
    },

    reset(): void {
      this.resolve.mockReset();
      providers.clear();
    },
  };
});

const loggerMock = vi.hoisted(() => {
  const instance = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
    isLevelEnabled: vi.fn(() => true),
  } as Record<string, ReturnType<typeof vi.fn>>;

  (instance.child as ReturnType<typeof vi.fn>).mockImplementation(() => instance);

  const createKernelLogger = vi.fn(() => instance);
  const reset = (): void => {
    createKernelLogger.mockClear();
    for (const key of Object.keys(instance)) {
      const value = instance[key];
      if (value && typeof (value as { mockClear?: () => void }).mockClear === "function") {
        (value as { mockClear: () => void }).mockClear();
      }
    }
    (instance.child as ReturnType<typeof vi.fn>).mockImplementation(() => instance);
    (instance.isLevelEnabled as ReturnType<typeof vi.fn>).mockImplementation(() => true);
  };

  return {
    instance,
    createKernelLogger,
    reset,
  };
});

vi.mock("../../src/core/registry", () => ({
  default: {
    resolve: registryMock.resolve,
  },
}));

vi.mock("../../src/core/logger", () => ({
  createKernelLogger: loggerMock.createKernelLogger,
}));

type PluginModule = {
  online(options: Record<string, unknown>): Promise<void>;
  offline(): Promise<void>;
  restart(options: Record<string, unknown>): Promise<void>;
  state(): Promise<{ status: number }>;
  generateReply(options: Record<string, unknown>): Promise<unknown>;
  send(options: Record<string, unknown>): Promise<unknown>;
};

let pluginModule: PluginModule | null = null;

async function loadPluginModule(): Promise<PluginModule> {
  vi.resetModules();
  const imported = await import("../../src/systemPlugins/talk-engine/index.js");
  pluginModule = (imported.default ?? imported) as unknown as PluginModule;
  return pluginModule;
}

function createLlmEmitter(options: {
  chunks?: string[];
  rawChunks?: Array<[unknown, unknown?, unknown?]>;
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

    for (const rawChunk of options.rawChunks ?? []) {
      emitter.emit("data", ...rawChunk);
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

function registerHistoryProviders(options: {
  recentMessages?: Array<{ role: string; content: string; timestamp: number }>;
} = {}): void {
  const recentMessages = options.recentMessages ?? [];
  registryMock.setProvider(CAPABILITY_HISTORY_APPEND, {
    appendMessage: vi.fn(async () => undefined),
  });
  registryMock.setProvider(CAPABILITY_HISTORY_RECENT, {
    getRecentMessages: vi.fn(async () => recentMessages),
  });
  registryMock.setProvider(CAPABILITY_HISTORY_CLEAR, {
    clearConversation: vi.fn(async () => undefined),
  });
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
    loggerMock.reset();
    registerHistoryProviders();
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
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, {
      streamChat: vi.fn(async () => createLlmEmitter({
        chunks: ["hello", " world"],
      })),
    });

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

    const llmStreamChat = registryMock.getProviderMethodMock(CAPABILITY_LLM_CHAT_STREAM, "streamChat");
    const payload = llmStreamChat.mock.calls[0][0] as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      params: { temperature: number };
    };

    expect(payload.model).toBe("gpt-test");
    expect(payload.messages).toEqual([{
      role: "user",
      content: "<sender=tester>: hi there",
    }]);
    expect(payload.params).toEqual({ temperature: 0.1 });
    expect(payload).not.toHaveProperty("action");
  });

  it("injects recent history and persists user/assistant when scope is provided", async () => {
    registerHistoryProviders({
      recentMessages: [
        { role: "assistant", content: "previous answer", timestamp: Date.now() - 1000 },
      ],
    });
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, {
      streamChat: vi.fn(async () => createLlmEmitter({
        chunks: ["history-aware"],
      })),
    });

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", relayEnabled: false });

    const result = await plugin.generateReply({
      message: "new question",
      conversationId: "conv-1",
      userId: "user-1",
    }) as { reply: string };

    expect(result).toEqual({ reply: "history-aware" });

    const llmStreamChat = registryMock.getProviderMethodMock(CAPABILITY_LLM_CHAT_STREAM, "streamChat");
    const payload = llmStreamChat.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(payload.messages).toEqual([
      { role: "assistant", content: "previous answer" },
      { role: "user", content: "new question" },
    ]);

    const appendMethod = registryMock.getProviderMethodMock(CAPABILITY_HISTORY_APPEND, "appendMessage");
    expect(appendMethod).toHaveBeenCalledWith({
      conversationId: "conv-1",
      userId: "user-1",
      role: "user",
      content: "new question",
    });
    expect(appendMethod).toHaveBeenCalledWith({
      conversationId: "conv-1",
      userId: "user-1",
      role: "assistant",
      content: "history-aware",
    });
  });

  it("supports talk.stream and wraps llm emitter while persisting assistant on end", async () => {
    const llmEmitter = createLlmEmitter({ chunks: ["stream", "-reply"] });
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, {
      streamChat: vi.fn(async () => llmEmitter),
    });

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", relayEnabled: false });

    const stream = await plugin.send({
      action: "system.talk.engine.stream",
      message: "stream this",
      conversationId: "conv-stream",
      userId: "user-stream",
    }) as EventEmitter & { abort?: () => void };

    expect(stream).not.toBe(llmEmitter);
    expect(typeof stream.on).toBe("function");
    expect(typeof stream.abort).toBe("function");

    const receivedChunks: string[] = [];
    let ended = false;
    stream.on("data", (chunk: unknown) => {
      receivedChunks.push(String(chunk));
    });
    stream.on("end", () => {
      ended = true;
    });

    await waitFor(() => ended);
    expect(receivedChunks).toEqual(["stream", "-reply"]);

    const appendMethod = registryMock.getProviderMethodMock(CAPABILITY_HISTORY_APPEND, "appendMessage");
    expect(appendMethod).toHaveBeenCalledWith({
      conversationId: "conv-stream",
      userId: "user-stream",
      role: "user",
      content: "stream this",
    });
    expect(appendMethod).toHaveBeenCalledWith({
      conversationId: "conv-stream",
      userId: "user-stream",
      role: "assistant",
      content: "stream-reply",
    });
  });

  it("filters reasoning-only chunks in talk.stream and avoids empty assistant history", async () => {
    const llmEmitter = createLlmEmitter({
      rawChunks: [["", { choices: [{ delta: { reasoning_content: "thinking only" } }] }, "thinking only"]],
    });
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, {
      streamChat: vi.fn(async () => llmEmitter),
    });

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", relayEnabled: false });

    const stream = await plugin.send({
      action: "talk.stream",
      message: "stream but no visible answer",
      conversationId: "conv-stream-empty",
      userId: "user-stream-empty",
    }) as EventEmitter;

    const receivedChunks: string[] = [];
    let ended = false;
    stream.on("data", (chunk: unknown) => {
      receivedChunks.push(String(chunk));
    });
    stream.on("end", () => {
      ended = true;
    });

    await waitFor(() => ended);
    expect(receivedChunks).toEqual([]);

    const appendMethod = registryMock.getProviderMethodMock(CAPABILITY_HISTORY_APPEND, "appendMessage");
    const assistantCalls = appendMethod.mock.calls.filter((call) => {
      const payload = call[0] as { role?: string };
      return payload.role === "assistant";
    });
    expect(assistantCalls).toHaveLength(0);
  });

  it("runs relay flow: conversation -> typing.start -> llm -> message.send -> typing.stop", async () => {
    const callSequence: string[] = [];
    const conversationStream = new EventEmitter();

    registryMock.setProvider(CAPABILITY_DISCORD_STREAM, {
      openConversationStream: vi.fn(async () => conversationStream),
    });
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_START, {
      startTyping: vi.fn(async () => {
        callSequence.push("typing.start");
        return { ok: true };
      }),
    });
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_STOP, {
      stopTyping: vi.fn(async () => {
        callSequence.push("typing.stop");
        return { ok: true };
      }),
    });
    registryMock.setProvider(CAPABILITY_DISCORD_SEND, {
      sendMessage: vi.fn(async (payload: Record<string, unknown>) => {
        callSequence.push(`message.send:${String(payload.message)}`);
        return { ok: true, channelId: payload.channelId, messageId: "m1" };
      }),
    });
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, {
      streamChat: vi.fn(async (payload: Record<string, unknown>) => {
        callSequence.push("llm.send");
        const messages = payload.messages as Array<{ content?: string }>;
        const content = messages[0]?.content ?? "";
        return createLlmEmitter({
          chunks: [`reply:${content}`],
        });
      }),
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

    registryMock.setProvider(CAPABILITY_DISCORD_STREAM, {
      openConversationStream: vi.fn(async () => conversationStream),
    });
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_START, {
      startTyping: vi.fn(async () => ({ ok: true })),
    });
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_STOP, {
      stopTyping: vi.fn(async () => {
        stopCount += 1;
        return { ok: true };
      }),
    });
    registryMock.setProvider(CAPABILITY_DISCORD_SEND, {
      sendMessage: vi.fn(async (payload: Record<string, unknown>) => {
        sentMessages.push(String(payload.message));
        return { ok: true, channelId: payload.channelId, messageId: "m2" };
      }),
    });
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, {
      streamChat: vi.fn(async () => createLlmEmitter({
        error: new Error("llm failed"),
      })),
    });

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local" });

    conversationStream.emit("data", createDiscordConversationEvent("boom", "channel-b"));

    await waitFor(() => sentMessages.length === 1);
    expect(sentMessages[0]).toBe("目前無法回覆，請稍後再試。");
    expect(stopCount).toBe(1);
  });

  it("rejects no-stream reply when llm returns empty content", async () => {
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, {
      streamChat: vi.fn(async () => createLlmEmitter({
        rawChunks: [["", { choices: [{ delta: { reasoning_content: "think" } }] }, "think"]],
      })),
    });

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", relayEnabled: false });

    await expect(plugin.send({
      action: "talk.nostream",
      message: "hi there",
    })).rejects.toThrow("llm reply is empty");
  });

  it("uses fallback reply when relay llm output is empty", async () => {
    const conversationStream = new EventEmitter();
    const sentMessages: string[] = [];

    registryMock.setProvider(CAPABILITY_DISCORD_STREAM, {
      openConversationStream: vi.fn(async () => conversationStream),
    });
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_START, {
      startTyping: vi.fn(async () => ({ ok: true })),
    });
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_STOP, {
      stopTyping: vi.fn(async () => ({ ok: true })),
    });
    registryMock.setProvider(CAPABILITY_DISCORD_SEND, {
      sendMessage: vi.fn(async (payload: Record<string, unknown>) => {
        sentMessages.push(String(payload.message));
        return { ok: true, channelId: payload.channelId, messageId: "m-empty" };
      }),
    });
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, {
      streamChat: vi.fn(async () => createLlmEmitter({
        rawChunks: [["", { choices: [{ delta: { reasoning_content: "thinking only" } }] }, "thinking only"]],
      })),
    });

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local" });

    conversationStream.emit("data", createDiscordConversationEvent("empty please", "channel-empty"));

    await waitFor(() => sentMessages.length === 1);
    expect(sentMessages).toEqual(["目前無法回覆，請稍後再試。"]);

    const appendMethod = registryMock.getProviderMethodMock(CAPABILITY_HISTORY_APPEND, "appendMessage");
    const appendedContents = appendMethod.mock.calls
      .map((call) => call[0] as { content?: string })
      .map((payload) => payload.content);

    expect(appendedContents).not.toContain("");
    expect(appendedContents).toContain("目前無法回覆，請稍後再試。");
  });

  it("processes relay events in FIFO order", async () => {
    const conversationStream = new EventEmitter();
    const sentMessages: string[] = [];
    let sequence = 0;

    registryMock.setProvider(CAPABILITY_DISCORD_STREAM, {
      openConversationStream: vi.fn(async () => conversationStream),
    });
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_START, {
      startTyping: vi.fn(async () => ({ ok: true })),
    });
    registryMock.setProvider(CAPABILITY_DISCORD_TYPING_STOP, {
      stopTyping: vi.fn(async () => ({ ok: true })),
    });
    registryMock.setProvider(CAPABILITY_DISCORD_SEND, {
      sendMessage: vi.fn(async (payload: Record<string, unknown>) => {
        sentMessages.push(String(payload.message));
        return { ok: true, channelId: payload.channelId, messageId: "m3" };
      }),
    });
    registryMock.setProvider(CAPABILITY_LLM_CHAT_STREAM, {
      streamChat: vi.fn(async () => {
        sequence += 1;
        return createLlmEmitter({
          chunks: [`reply-${sequence}`],
          delayMs: sequence === 1 ? 40 : 0,
        });
      }),
    });

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local" });

    conversationStream.emit("data", createDiscordConversationEvent("first", "channel-c"));
    conversationStream.emit("data", createDiscordConversationEvent("second", "channel-c"));

    await waitFor(() => sentMessages.length === 2);
    expect(sentMessages).toEqual(["reply-1", "reply-2"]);
  });
});
