import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanAndValidateMessages,
  validateChatPayload,
} from "../../src/systemPlugins/llm-remote-gateway/strategies/remote/messageValidator";
import { buildChatPayload } from "../../src/systemPlugins/llm-remote-gateway/strategies/remote/payload";
import type { ChatStreamEmitter } from "../../src/systemPlugins/llm-remote-gateway/strategies/remote/types";

const axiosMock = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: axiosMock,
}));

type PluginModule = {
  online(options: Record<string, unknown>): Promise<void>;
  offline(): Promise<void>;
  restart(options: Record<string, unknown>): Promise<void>;
  state(): Promise<{ status: number }>;
  send(options: unknown): Promise<unknown>;
};

async function loadPluginModule(): Promise<PluginModule> {
  vi.resetModules();
  const imported = await import("../../src/systemPlugins/llm-remote-gateway/index");
  return (imported.default ?? imported) as unknown as PluginModule;
}

function createChatSseStream(lines: string[]): PassThrough {
  const stream = new PassThrough();
  setTimeout(() => {
    lines.forEach((line) => {
      stream.write(`${line}\n`);
    });
    stream.end();
  }, 0);
  return stream;
}

describe("system plugin: llm-remote-gateway", () => {
  beforeEach(() => {
    axiosMock.mockReset();
  });

  afterEach(async () => {
    const plugin = await loadPluginModule();
    await plugin.offline();
  });

  it("supports online/offline/restart/state lifecycle", async () => {
    const plugin = await loadPluginModule();
    axiosMock.mockResolvedValue({
      status: 200,
      data: { data: [] },
    });

    await plugin.online({
      method: "remote",
      baseUrl: "http://localhost:8080/",
    });

    const onlineState = await plugin.state();
    expect(onlineState.status).toBe(1);

    await plugin.restart({
      method: "remote",
      baseUrl: "http://localhost:8080",
      model: "gpt-test",
    });

    const restartState = await plugin.state();
    expect(restartState.status).toBe(1);

    await plugin.offline();
    const offlineState = await plugin.state();
    expect(offlineState.status).toBe(0);
  });

  it("streams chat completions and forwards reasoning_content", async () => {
    const plugin = await loadPluginModule();
    await plugin.online({
      method: "remote",
      baseUrl: "http://localhost:8080",
    });

    axiosMock.mockResolvedValue({
      status: 200,
      data: createChatSseStream([
        "data: {\"choices\":[{\"delta\":{\"content\":\"hello\",\"reasoning_content\":\"think\"}}]}",
        "data: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}",
        "data: [DONE]",
      ]),
    });

    const emitter = await plugin.send({
      action: "chat.stream",
      messages: [{ role: "user", content: "hi" }],
    }) as ChatStreamEmitter;

    const chunks: string[] = [];
    const reasonings: string[] = [];

    await new Promise<void>((resolve, reject) => {
      emitter.on("data", (content: string, _raw: unknown, reasoning: string | null) => {
        chunks.push(content);
        if (reasoning) {
          reasonings.push(reasoning);
        }
      });
      emitter.on("error", reject);
      emitter.on("end", () => resolve());
    });

    expect(chunks.join("")).toBe("hello world");
    expect(reasonings).toEqual(["think"]);
  });

  it("supports abort() on chat stream emitter", async () => {
    const plugin = await loadPluginModule();
    await plugin.online({
      method: "remote",
      baseUrl: "http://localhost:8080",
    });

    const stream = new PassThrough();
    axiosMock.mockResolvedValue({
      status: 200,
      data: stream,
    });

    const emitter = await plugin.send({
      action: "chat.stream",
      messages: [{ role: "user", content: "hi" }],
    }) as ChatStreamEmitter;

    await new Promise<void>((resolve) => {
      emitter.on("abort", () => resolve());
      emitter.abort();
    });

    expect(stream.destroyed).toBe(true);
  });

  it("emits timeout error only once when initial stream data times out", async () => {
    const plugin = await loadPluginModule();
    await plugin.online({
      method: "remote",
      baseUrl: "http://localhost:8080",
    });

    const stream = new PassThrough();
    axiosMock.mockResolvedValue({
      status: 200,
      data: stream,
    });

    const emitter = await plugin.send({
      action: "chat.stream",
      messages: [{ role: "user", content: "hi" }],
      connectionTimeoutMs: 10,
    }) as ChatStreamEmitter;

    const errors: Array<{ type?: string }> = [];
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("did not receive timeout error"));
      }, 500);

      emitter.on("error", (streamError: { type?: string }) => {
        errors.push(streamError);
        setTimeout(() => {
          clearTimeout(timeout);
          resolve();
        }, 50);
      });
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("timeout");
    expect(stream.destroyed).toBe(true);
  });

  it("treats [DONE] as terminal even if upstream stream stays open", async () => {
    const plugin = await loadPluginModule();
    await plugin.online({
      method: "remote",
      baseUrl: "http://localhost:8080",
    });

    const stream = new PassThrough();
    axiosMock.mockResolvedValue({
      status: 200,
      data: stream,
    });

    const emitter = await plugin.send({
      action: "chat.stream",
      messages: [{ role: "user", content: "hi" }],
    }) as ChatStreamEmitter;

    const endPromise = new Promise<void>((resolve, reject) => {
      emitter.on("end", () => resolve());
      emitter.on("error", reject);
    });

    stream.write("data: [DONE]\n");

    await expect(endPromise).resolves.toBeUndefined();
    expect(stream.destroyed).toBe(true);
  });

  it("retries chat stream request and emits classified timeout error", async () => {
    const plugin = await loadPluginModule();
    await plugin.online({
      method: "remote",
      baseUrl: "http://localhost:8080",
    });

    axiosMock.mockRejectedValue({
      message: "timeout",
      code: "ECONNABORTED",
    });

    const emitter = await plugin.send({
      action: "chat.stream",
      messages: [{ role: "user", content: "hi" }],
      maxRetries: 2,
      retryDelayBaseMs: 1,
    }) as ChatStreamEmitter;

    const error = await new Promise<{ type?: string }>((resolve) => {
      emitter.on("error", (streamError: { type?: string }) => resolve(streamError));
    });

    expect(axiosMock).toHaveBeenCalledTimes(3);
    expect(error.type).toBe("timeout");
  });

  it("returns models.list and health.check json results", async () => {
    const plugin = await loadPluginModule();
    await plugin.online({
      method: "remote",
      baseUrl: "http://localhost:8080",
    });

    axiosMock
      .mockResolvedValueOnce({
        status: 200,
        data: { data: [{ id: "model-a" }] },
      })
      .mockResolvedValueOnce({
        status: 503,
        data: { error: "unavailable" },
      });

    const modelsResult = await plugin.send({
      action: "models.list",
    }) as {
      ok: boolean;
      status: number;
      models: unknown[];
    };
    expect(modelsResult.ok).toBe(true);
    expect(modelsResult.status).toBe(200);
    expect(modelsResult.models).toHaveLength(1);

    const healthResult = await plugin.send({
      action: "health.check",
    }) as {
      ok: boolean;
      status: number;
      errorType?: string;
    };
    expect(healthResult.ok).toBe(false);
    expect(healthResult.status).toBe(503);
    expect(healthResult.errorType).toBe("server_error");
  });

  it("supports legacy send signature with messages array or messages object", async () => {
    const plugin = await loadPluginModule();
    await plugin.online({
      method: "remote",
      baseUrl: "http://localhost:8080",
    });

    axiosMock
      .mockResolvedValueOnce({
        status: 200,
        data: createChatSseStream([
          "data: {\"choices\":[{\"delta\":{\"content\":\"A\"}}]}",
          "data: [DONE]",
        ]),
      })
      .mockResolvedValueOnce({
        status: 200,
        data: createChatSseStream([
          "data: {\"choices\":[{\"delta\":{\"content\":\"B\"}}]}",
          "data: [DONE]",
        ]),
      });

    const emitterA = await plugin.send([
      { role: "user", content: "hi A" },
    ]) as ChatStreamEmitter;
    const emitterB = await plugin.send({
      messages: [{ role: "user", content: "hi B" }],
    }) as ChatStreamEmitter;

    const collect = async (emitter: ChatStreamEmitter): Promise<string> => {
      const chunks: string[] = [];
      await new Promise<void>((resolve, reject) => {
        emitter.on("data", (content: string) => chunks.push(content));
        emitter.on("error", reject);
        emitter.on("end", () => resolve());
      });
      return chunks.join("");
    };

    await expect(collect(emitterA)).resolves.toBe("A");
    await expect(collect(emitterB)).resolves.toBe("B");
  });

  it("sanitizes and validates messages/payload from migrated validator", () => {
    const cleaned = cleanAndValidateMessages([
      {
        role: "assistant",
        content: null,
        reasoning_content: "remove-me",
        tool_calls: [
          {
            id: "tool-call-1",
            function: { name: "toolReference", arguments: "{}" },
          },
        ],
      },
      {
        role: "tool",
        name: "toolReference",
        tool_call_id: "tool-call-1",
        content: { ok: true },
      },
    ]);

    expect(cleaned).toHaveLength(2);
    expect(cleaned[0]).not.toHaveProperty("reasoning_content");
    expect(cleaned[1]).toMatchObject({
      role: "tool",
      name: "toolReference",
      tool_call_id: "tool-call-1",
    });

    const payloadValidation = validateChatPayload({
      messages: cleaned,
      stream: true,
      model: "gpt-test",
    });
    expect(payloadValidation.valid).toBe(true);
  });

  it("builds chat payload and auto-fills tool_choice", () => {
    const payload = buildChatPayload({
      messages: [{ role: "user", content: "hello" }],
      model: "gpt-test",
      stream: true,
      tools: [
        {
          type: "function",
          function: {
            name: "toolReference",
            description: "tool",
            parameters: { type: "object", properties: {}, required: [] },
          },
        },
      ],
      tool_choice: null,
      params: { temperature: 0.1 },
    });

    expect(payload.stream).toBe(true);
    expect(payload.tool_choice).toBe("auto");
    expect(payload.temperature).toBe(0.1);
  });
});
