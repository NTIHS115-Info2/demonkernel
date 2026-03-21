import { createKernelLogger } from "../../../../core/logger";

import type { DiscordTypingControlResult } from "./types";

type TypingSession = {
  refCount: number;
  timer: NodeJS.Timeout;
};

type TypingSessionManagerOptions = {
  intervalMs: number;
  fetchChannel: (channelId: string) => Promise<unknown>;
};

const logger = createKernelLogger("plugin-discord-typing-session", {
  plugin: "discord",
  type: "system",
  strategy: "local",
  module: "typing",
});

function supportsSendTyping(channel: unknown): channel is { sendTyping: () => Promise<unknown> } {
  return typeof (channel as { sendTyping?: unknown })?.sendTyping === "function";
}

async function sendTypingOnce(
  channelId: string,
  fetchChannel: (channelId: string) => Promise<unknown>
): Promise<void> {
  const channel = await fetchChannel(channelId);
  if (!channel) {
    throw new Error(`discord channel not found: ${channelId}`);
  }

  if (!supportsSendTyping(channel)) {
    throw new Error(`discord channel does not support sendTyping(): ${channelId}`);
  }

  await channel.sendTyping();
}

export class TypingSessionManager {
  private readonly intervalMs: number;
  private readonly fetchChannel: (channelId: string) => Promise<unknown>;
  private readonly sessions = new Map<string, TypingSession>();

  constructor(options: TypingSessionManagerOptions) {
    this.intervalMs = options.intervalMs;
    this.fetchChannel = options.fetchChannel;
  }

  // 中英註解：採 reference count，避免多流程共用同 channel 時互相關閉 typing。
  // EN: Use reference counting so concurrent flows on one channel do not stop each other.
  async start(channelId: string): Promise<DiscordTypingControlResult> {
    const existing = this.sessions.get(channelId);
    if (existing) {
      existing.refCount += 1;
      return {
        ok: true,
        channelId,
        active: true,
        refCount: existing.refCount,
      };
    }

    await sendTypingOnce(channelId, this.fetchChannel);

    const timer = setInterval(() => {
      void sendTypingOnce(channelId, this.fetchChannel).catch((error) => {
        logger.warn("typing heartbeat failed", {
          channelId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.intervalMs);

    this.sessions.set(channelId, {
      refCount: 1,
      timer,
    });

    return {
      ok: true,
      channelId,
      active: true,
      refCount: 1,
    };
  }

  async stop(channelId: string): Promise<DiscordTypingControlResult> {
    const existing = this.sessions.get(channelId);
    if (!existing) {
      return {
        ok: true,
        channelId,
        active: false,
        refCount: 0,
      };
    }

    existing.refCount -= 1;
    if (existing.refCount > 0) {
      return {
        ok: true,
        channelId,
        active: true,
        refCount: existing.refCount,
      };
    }

    clearInterval(existing.timer);
    this.sessions.delete(channelId);

    return {
      ok: true,
      channelId,
      active: false,
      refCount: 0,
    };
  }

  async clear(): Promise<void> {
    for (const session of this.sessions.values()) {
      clearInterval(session.timer);
    }
    this.sessions.clear();
  }
}

