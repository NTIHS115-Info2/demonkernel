import type {
  CapabilityBinding,
  OnlineOptions,
  RestartOptions,
  SendOptions,
  StateResult,
} from "../../core/plugin-sdk";

import strategies from "./strategies";
import type { SystemPromptGetInput } from "./strategies/local/types";

const METHOD_LOCAL = "local" as const;

function assertLocalMethod(method: unknown, operation: string): asserts method is "local" {
  if (method !== METHOD_LOCAL) {
    throw new Error(`${operation} requires method="local"`);
  }
}

type SystemPromptProviderHost = {
  getSystemPrompt(input: SystemPromptGetInput): Promise<string>;
};

function createCapabilityBindings(): CapabilityBinding[] {
  return [
    {
      capabilityId: "system.prompt.manager.get",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as SystemPromptProviderHost;
        return {
          getSystemPrompt: plugin.getSystemPrompt.bind(plugin),
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

  async getSystemPrompt(input: SystemPromptGetInput): Promise<string> {
    return strategies.local.getSystemPrompt(input);
  },

  async send(options: SendOptions): Promise<unknown> {
    return strategies.local.send(options);
  },

  getCapabilityBindings(): CapabilityBinding[] {
    return createCapabilityBindings();
  },
};
