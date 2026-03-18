import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import secretsManager, { SECRET_KEYS } from "../../src/core/secrets";
import plugin from "../../src/systemPlugins/discord/index";
import type { DiscordConversationStream } from "../../src/systemPlugins/discord/strategies/local/types";

const discordMock = vi.hoisted(() => {
  const { EventEmitter } = require("node:events") as typeof import("node:events");

  class MockClient extends EventEmitter {
    public readonly channels: { fetch: ReturnType<typeof vi.fn> };
    public readonly login: ReturnType<typeof vi.fn>;
    public readonly destroy: ReturnType<typeof vi.fn>;
    public readonly isReady: ReturnType<typeof vi.fn>;
    public readonly user: { id: string };
    private ready = false;

    constructor() {
      super();
      this.user = { id: "bot-user-id" };
      this.channels = {
        fetch: vi.fn(),
      };
      this.login = vi.fn(async () => {
        this.ready = true;
      });
      this.destroy = vi.fn(async () => {
        this.ready = false;
      });
      this.isReady = vi.fn(() => this.ready);
    }
  }

  const clients: MockClient[] = [];
  class Client extends MockClient {
    constructor() {
      super();
      clients.push(this);
    }
  }

  return {
    Client,
    clients,
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      DirectMessages: 4,
      MessageContent: 8,
    },
    Partials: {
      Channel: "Channel",
    },
    reset(): void {
      clients.length = 0;
    },
  };
});

vi.mock("discord.js", () => ({
  Client: discordMock.Client,
  GatewayIntentBits: discordMock.GatewayIntentBits,
  Partials: discordMock.Partials,
}));

type PluginModule = {
  online(options: Record<string, unknown>): Promise<void>;
  offline(): Promise<void>;
  restart(options: Record<string, unknown>): Promise<void>;
  state(): Promise<{ status: number }>;
  send(options: Record<string, unknown>): Promise<unknown>;
};

type FakeMessageOptions = {
  content: string;
  authorId: string;
  channelId: string;
  guildId: string | null;
  mentionBot?: boolean;
  replyToBot?: boolean;
};

let messageCounter = 0;

function getPlugin(): PluginModule {
  return plugin as unknown as PluginModule;
}

function getLatestClient() {
  const client = discordMock.clients[discordMock.clients.length - 1];
  if (!client) {
    throw new Error("mock discord client has not been created");
  }

  return client;
}

function buildSecretTable(overrides: Record<string, string | null> = {}): Record<string, string | null> {
  return {
    [SECRET_KEYS.DISCORD_TOKEN]: "test-discord-token",
    DISCORD_TOKEN: "test-discord-token",
    [SECRET_KEYS.DISCORD_USER_ID]: "owner-1",
    DISCORD_USER_ID: "owner-1",
    [SECRET_KEYS.DISCORD_CHANNEL_ID]: "global",
    DISCORD_CHANNEL_ID: "global",
    ...overrides,
  };
}

function mockSecrets(overrides: Record<string, string | null> = {}): void {
  const table = buildSecretTable(overrides);

  vi.spyOn(secretsManager, "get").mockImplementation((key: string) => {
    const value = table[key];
    if (value === undefined || value === null || value.trim().length === 0) {
      throw new Error(`secret not found: ${key}`);
    }
    return value;
  });

  vi.spyOn(secretsManager, "tryGet").mockImplementation((key: string) => {
    const value = table[key];
    if (value === undefined || value === null || value.trim().length === 0) {
      return null;
    }
    return value;
  });
}

function createFakeMessage(options: FakeMessageOptions) {
  messageCounter += 1;

  const reply = vi.fn(async () => undefined);
  const mentionBot = options.mentionBot ?? false;
  const replyToBot = options.replyToBot ?? false;

  return {
    id: `msg-${messageCounter}`,
    content: options.content,
    guildId: options.guildId,
    channel: { id: options.channelId },
    author: {
      id: options.authorId,
      bot: false,
      username: `user-${options.authorId}`,
      displayName: `display-${options.authorId}`,
    },
    member: options.guildId ? { displayName: `member-${options.authorId}` } : null,
    mentions: {
      has: vi.fn((userId: unknown) => mentionBot && userId === "bot-user-id"),
      repliedUser: replyToBot ? { id: "bot-user-id" } : null,
    },
    reference: replyToBot ? { messageId: "ref-message-1" } : null,
    createdTimestamp: Date.now(),
    reply,
  };
}

async function flushAsyncTasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("system plugin: discord", () => {
  beforeEach(() => {
    discordMock.reset();
    messageCounter = 0;
  });

  afterEach(async () => {
    try {
      await getPlugin().offline();
    } catch {
      // ignore cleanup failure
    }
    vi.restoreAllMocks();
  });

  it("supports online/offline/restart/state lifecycle", async () => {
    mockSecrets();
    const pluginModule = getPlugin();

    await pluginModule.online({ method: "local" });
    expect((await pluginModule.state()).status).toBe(1);

    const firstClient = getLatestClient();
    expect(firstClient.login).toHaveBeenCalledWith("test-discord-token");

    await pluginModule.restart({
      method: "local",
      channelId: "channel-restart",
    });
    expect((await pluginModule.state()).status).toBe(1);
    expect(firstClient.destroy).toHaveBeenCalledTimes(1);

    await pluginModule.offline();
    expect((await pluginModule.state()).status).toBe(0);
  });

  it("fails online when DISCORD_TOKEN is missing", async () => {
    mockSecrets({
      [SECRET_KEYS.DISCORD_TOKEN]: null,
      DISCORD_TOKEN: null,
    });
    const pluginModule = getPlugin();

    await expect(pluginModule.online({ method: "local" })).rejects.toThrow("secret not found");
  });

  it("streams mention/reply/owner_dm messages", async () => {
    mockSecrets();
    const pluginModule = getPlugin();
    await pluginModule.online({ method: "local", ownerUserId: "owner-1" });

    const stream = await pluginModule.send({
      action: "conversation.stream",
    }) as DiscordConversationStream;
    const events: Array<{ source: string; content: string; author: { isOwner: boolean } }> = [];
    stream.on("data", (payload) => events.push(payload));

    const client = getLatestClient();
    client.emit("messageCreate", createFakeMessage({
      content: "<@bot-user-id> hello world",
      authorId: "member-1",
      channelId: "guild-channel-1",
      guildId: "guild-1",
      mentionBot: true,
    }));
    client.emit("messageCreate", createFakeMessage({
      content: "reply body",
      authorId: "member-2",
      channelId: "guild-channel-1",
      guildId: "guild-1",
      replyToBot: true,
    }));
    client.emit("messageCreate", createFakeMessage({
      content: "owner dm content",
      authorId: "owner-1",
      channelId: "dm-1",
      guildId: null,
    }));

    await flushAsyncTasks();

    expect(events.map((item) => item.source)).toEqual(["mention", "reply", "owner_dm"]);
    expect(events[0].content).toBe("hello world");
    expect(events[2].author.isOwner).toBe(true);
  });

  it("replies fixed text for non-owner DM and does not push to stream", async () => {
    mockSecrets();
    const pluginModule = getPlugin();
    await pluginModule.online({ method: "local", ownerUserId: "owner-1" });

    const stream = await pluginModule.send({
      action: "conversation.stream",
    }) as DiscordConversationStream;
    const events: unknown[] = [];
    stream.on("data", (payload) => events.push(payload));

    const dmMessage = createFakeMessage({
      content: "hello bot",
      authorId: "not-owner",
      channelId: "dm-2",
      guildId: null,
    });

    const client = getLatestClient();
    client.emit("messageCreate", dmMessage);
    await flushAsyncTasks();

    expect(dmMessage.reply).toHaveBeenCalledWith("我還學不會跟別人說話");
    expect(events).toHaveLength(0);
  });

  it("filters guild messages by configured channelId", async () => {
    mockSecrets();
    const pluginModule = getPlugin();
    await pluginModule.online({
      method: "local",
      channelId: "allow-channel",
      ownerUserId: "owner-1",
    });

    const stream = await pluginModule.send({
      action: "conversation.stream",
    }) as DiscordConversationStream;
    const events: Array<{ source: string; channelId: string }> = [];
    stream.on("data", (payload) => events.push(payload));

    const client = getLatestClient();
    client.emit("messageCreate", createFakeMessage({
      content: "<@bot-user-id> should be ignored",
      authorId: "member-1",
      channelId: "ignore-channel",
      guildId: "guild-1",
      mentionBot: true,
    }));
    client.emit("messageCreate", createFakeMessage({
      content: "reply in allowed channel",
      authorId: "member-2",
      channelId: "allow-channel",
      guildId: "guild-1",
      replyToBot: true,
    }));
    client.emit("messageCreate", createFakeMessage({
      content: "owner dm still allowed",
      authorId: "owner-1",
      channelId: "dm-5",
      guildId: null,
    }));

    await flushAsyncTasks();

    expect(events.map((item) => item.source)).toEqual(["reply", "owner_dm"]);
    expect(events[0].channelId).toBe("allow-channel");
  });

  it("supports message.send success and error paths", async () => {
    mockSecrets();
    const pluginModule = getPlugin();
    await pluginModule.online({ method: "local", channelId: "fallback-channel" });

    const sendMock = vi.fn(async () => ({ id: "sent-1" }));
    const client = getLatestClient();
    client.channels.fetch.mockResolvedValue({
      send: sendMock,
    });

    const success = await pluginModule.send({
      action: "message.send",
      channelId: "target-channel",
      message: "hello",
    }) as { ok: boolean; channelId: string; messageId: string | null };
    expect(success).toEqual({
      ok: true,
      channelId: "target-channel",
      messageId: "sent-1",
    });
    expect(sendMock).toHaveBeenCalledWith("hello");

    const capabilityAliasResult = await pluginModule.send({
      action: "system.discord.message.send",
      message: "fallback route",
    }) as { channelId: string };
    expect(capabilityAliasResult.channelId).toBe("fallback-channel");

    await expect(pluginModule.send({
      action: "message.send",
      channelId: "target-channel",
    } as Record<string, unknown>)).rejects.toThrow("message.send requires non-empty string");

    client.channels.fetch.mockResolvedValueOnce(null);
    await expect(pluginModule.send({
      action: "message.send",
      channelId: "missing-channel",
      message: "hello",
    })).rejects.toThrow("discord channel not found");

    await pluginModule.offline();
    await expect(pluginModule.send({
      action: "message.send",
      channelId: "target-channel",
      message: "hello",
    })).rejects.toThrow("not online");
  });

  it("supports capability action aliases and rejects unknown action", async () => {
    mockSecrets();
    const pluginModule = getPlugin();
    await pluginModule.online({ method: "local" });

    const stream = await pluginModule.send({
      action: "system.discord.conversation.stream",
    }) as DiscordConversationStream;
    expect(typeof stream.on).toBe("function");

    await expect(pluginModule.send({
      action: "unknown.action",
    })).rejects.toThrow("unsupported action");
  });
});
