import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

type PluginModule = {
  online(options: Record<string, unknown>): Promise<void>;
  offline(): Promise<void>;
  restart(options: Record<string, unknown>): Promise<void>;
  state(): Promise<{ status: number }>;
  appendMessage(input: Record<string, unknown>): Promise<void>;
  getRecentMessages(
    scope: Record<string, unknown>,
    limit?: number
  ): Promise<Array<{ role: string; content: string; timestamp: number }>>;
  clearConversation(scope: Record<string, unknown>): Promise<void>;
};

async function loadPluginModule(): Promise<PluginModule> {
  const imported = await import("../../src/systemPlugins/conversation-history/index");
  return (imported.default ?? imported) as PluginModule;
}

function findHistoryFile(historyDir: string): string | null {
  if (!fs.existsSync(historyDir)) {
    return null;
  }

  const files = fs.readdirSync(historyDir).filter((name) => name.endsWith(".json"));
  return files[0] ? path.join(historyDir, files[0]) : null;
}

describe("system plugin: conversation-history", () => {
  let plugin: PluginModule;
  let historyDir: string;

  beforeEach(async () => {
    historyDir = fs.mkdtempSync(path.join(os.tmpdir(), "conversation-history-test-"));
    plugin = await loadPluginModule();
  });

  afterEach(async () => {
    try {
      await plugin.offline();
    } catch {
      // ignore cleanup failure
    }
    fs.rmSync(historyDir, { recursive: true, force: true });
  });

  it("supports online/offline/restart/state lifecycle", async () => {
    await plugin.online({ method: "local", historyDir });
    expect((await plugin.state()).status).toBe(1);

    await plugin.restart({ method: "local", historyDir });
    expect((await plugin.state()).status).toBe(1);

    await plugin.offline();
    expect((await plugin.state()).status).toBe(0);
  });

  it("appends, reads recent messages, and applies maxMessages prune", async () => {
    await plugin.online({ method: "local", historyDir, maxMessages: 2, expireDays: 7 });

    await plugin.appendMessage({
      conversationId: "channel-1",
      role: "user",
      content: "first",
    });
    await plugin.appendMessage({
      conversationId: "channel-1",
      role: "assistant",
      content: "second",
    });
    await plugin.appendMessage({
      conversationId: "channel-1",
      role: "user",
      content: "third",
    });

    const messages = await plugin.getRecentMessages({ conversationId: "channel-1" });
    expect(messages.map((item) => item.content)).toEqual(["second", "third"]);

    const limited = await plugin.getRecentMessages({ conversationId: "channel-1" }, 1);
    expect(limited.map((item) => item.content)).toEqual(["third"]);
  });

  it("cleans expired messages while reading history", async () => {
    await plugin.online({ method: "local", historyDir, expireDays: 1, maxMessages: 50 });

    const filePath = path.join(historyDir, "conversation_channel-expire.json");
    fs.writeFileSync(
      filePath,
      JSON.stringify([
        {
          role: "user",
          content: "old",
          timestamp: Date.now() - (3 * 24 * 60 * 60 * 1000),
        },
        {
          role: "assistant",
          content: "new",
          timestamp: Date.now(),
        },
      ]),
      "utf-8"
    );

    const recent = await plugin.getRecentMessages({ conversationId: "channel-expire" });
    expect(recent.map((item) => item.content)).toEqual(["new"]);
  });

  it("rotates history file when size exceeds maxFileSize", async () => {
    await plugin.online({
      method: "local",
      historyDir,
      backupCount: 2,
      maxFileSize: 40,
      maxMessages: 100,
    });

    await plugin.appendMessage({
      conversationId: "channel-rotate",
      role: "user",
      content: "x".repeat(120),
    });
    await plugin.appendMessage({
      conversationId: "channel-rotate",
      role: "assistant",
      content: "rotate",
    });

    const mainFile = findHistoryFile(historyDir);
    expect(mainFile).toBeTruthy();
    expect(fs.existsSync(`${mainFile}.1`)).toBe(true);
  });

  it("returns empty history when JSON is malformed", async () => {
    await plugin.online({ method: "local", historyDir });

    const filePath = path.join(historyDir, "conversation_channel-broken.json");
    fs.writeFileSync(filePath, "{bad json", "utf-8");

    const recent = await plugin.getRecentMessages({ conversationId: "channel-broken" });
    expect(recent).toEqual([]);
  });

  it("preserves all messages under concurrent appends for same scope", async () => {
    await plugin.online({ method: "local", historyDir, maxMessages: 200, expireDays: 7 });

    const total = 24;
    await Promise.all(
      Array.from({ length: total }, (_, index) => plugin.appendMessage({
        conversationId: "channel-concurrent",
        role: "user",
        content: `msg-${index}`,
      }))
    );

    const recent = await plugin.getRecentMessages({ conversationId: "channel-concurrent" }, total);
    const contents = recent.map((item) => item.content);
    expect(contents).toHaveLength(total);
    expect(new Set(contents).size).toBe(total);
  });

  it("clears rotated backup files together with main history file", async () => {
    await plugin.online({ method: "local", historyDir });

    const baseFilePath = path.join(historyDir, "conversation_channel-clear-rotate.json");
    fs.writeFileSync(baseFilePath, "[]", "utf-8");
    fs.writeFileSync(`${baseFilePath}.1`, "[]", "utf-8");
    fs.writeFileSync(`${baseFilePath}.2`, "[]", "utf-8");

    await plugin.clearConversation({ conversationId: "channel-clear-rotate" });

    expect(fs.existsSync(baseFilePath)).toBe(false);
    expect(fs.existsSync(`${baseFilePath}.1`)).toBe(false);
    expect(fs.existsSync(`${baseFilePath}.2`)).toBe(false);
  });

  it("clears history file and cache for specific scope", async () => {
    await plugin.online({ method: "local", historyDir });

    await plugin.appendMessage({
      userId: "user-42",
      role: "user",
      content: "hello",
    });

    const before = await plugin.getRecentMessages({ userId: "user-42" });
    expect(before).toHaveLength(1);

    await plugin.clearConversation({ userId: "user-42" });
    const after = await plugin.getRecentMessages({ userId: "user-42" });
    expect(after).toEqual([]);
  });
});
