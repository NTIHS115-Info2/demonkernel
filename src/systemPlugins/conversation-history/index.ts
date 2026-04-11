import type {
  CapabilityBinding,
  OnlineOptions,
  RestartOptions,
  SendOptions,
  StateResult,
} from "../../core/plugin-sdk";

import strategies from "./strategies";
import type {
  ConversationHistoryMessage,
  ConversationScopeInput,
} from "./strategies/local/types";

const METHOD_LOCAL = "local" as const;

function assertLocalMethod(method: unknown, operation: string): asserts method is "local" {
  if (method !== METHOD_LOCAL) {
    throw new Error(`${operation} requires method="local"`);
  }
}

type ConversationHistoryProviderHost = {
  appendMessage(input: SendOptions): Promise<void>;
  getRecentMessages(scope: ConversationScopeInput, limit?: number): Promise<ConversationHistoryMessage[]>;
  clearConversation(scope: ConversationScopeInput): Promise<void>;
};

function createCapabilityBindings(): CapabilityBinding[] {
  return [
    {
      capabilityId: "system.conversation.history.append",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as ConversationHistoryProviderHost;
        return {
          appendMessage: plugin.appendMessage.bind(plugin),
        };
      },
    },
    {
      capabilityId: "system.conversation.history.recent",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as ConversationHistoryProviderHost;
        return {
          getRecentMessages: plugin.getRecentMessages.bind(plugin),
        };
      },
    },
    {
      capabilityId: "system.conversation.history.clear",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as ConversationHistoryProviderHost;
        return {
          clearConversation: plugin.clearConversation.bind(plugin),
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

  async appendMessage(input: SendOptions): Promise<void> {
    await strategies.local.appendMessage(input);
  },

  async getRecentMessages(scope: ConversationScopeInput, limit?: number): Promise<ConversationHistoryMessage[]> {
    return strategies.local.getRecentMessages(scope, limit);
  },

  async clearConversation(scope: ConversationScopeInput): Promise<void> {
    await strategies.local.clearConversation(scope);
  },

  async send(options: SendOptions): Promise<unknown> {
    return strategies.local.send(options);
  },

  getCapabilityBindings(): CapabilityBinding[] {
    return createCapabilityBindings();
  },
};
