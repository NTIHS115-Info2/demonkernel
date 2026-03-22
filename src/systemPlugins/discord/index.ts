import type {
  CapabilityBinding,
  OnlineOptions,
  RestartOptions,
  SendOptions,
  StateResult,
} from "../../core/plugin-sdk";
import type {
  DiscordConversationStream,
  DiscordMessageSendResult,
  DiscordTypingControlResult,
} from "./strategies/local/types";

import strategies from "./strategies";

const METHOD_LOCAL = "local" as const;

function assertLocalMethod(method: unknown, operation: string): asserts method is "local" {
  if (method !== METHOD_LOCAL) {
    throw new Error(`${operation} requires method="local"`);
  }
}

type DiscordProviderHost = {
  openConversationStream(): Promise<DiscordConversationStream>;
  sendMessage(input: SendOptions): Promise<DiscordMessageSendResult>;
  startTyping(input: SendOptions): Promise<DiscordTypingControlResult>;
  stopTyping(input: SendOptions): Promise<DiscordTypingControlResult>;
};

function createCapabilityBindings(): CapabilityBinding[] {
  return [
    {
      capabilityId: "system.discord.conversation.stream",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as DiscordProviderHost;
        return {
          openConversationStream: plugin.openConversationStream.bind(plugin),
        };
      },
    },
    {
      capabilityId: "system.discord.message.send",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as DiscordProviderHost;
        return {
          sendMessage: plugin.sendMessage.bind(plugin),
        };
      },
    },
    {
      capabilityId: "system.discord.typing.start",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as DiscordProviderHost;
        return {
          startTyping: plugin.startTyping.bind(plugin),
        };
      },
    },
    {
      capabilityId: "system.discord.typing.stop",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as DiscordProviderHost;
        return {
          stopTyping: plugin.stopTyping.bind(plugin),
        };
      },
    },
  ];
}

export default {
  async online(options: OnlineOptions): Promise<void> {
    assertLocalMethod(options.method, "online");
    await strategies.local.online(options);
  },

  async offline(): Promise<void> {
    await strategies.local.offline();
  },

  async restart(options: RestartOptions): Promise<void> {
    assertLocalMethod(options.method, "restart");
    await strategies.local.restart(options);
  },

  async state(): Promise<StateResult> {
    return strategies.local.state();
  },

  async openConversationStream(): Promise<DiscordConversationStream> {
    return strategies.local.openConversationStream();
  },

  async sendMessage(input: SendOptions): Promise<DiscordMessageSendResult> {
    return strategies.local.sendMessage(input);
  },

  async startTyping(input: SendOptions): Promise<DiscordTypingControlResult> {
    return strategies.local.startTyping(input);
  },

  async stopTyping(input: SendOptions): Promise<DiscordTypingControlResult> {
    return strategies.local.stopTyping(input);
  },

  async send(options: SendOptions): Promise<unknown> {
    return strategies.local.send(options);
  },

  getCapabilityBindings(): CapabilityBinding[] {
    return createCapabilityBindings();
  },
};
