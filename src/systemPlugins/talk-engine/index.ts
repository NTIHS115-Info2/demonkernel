import type {
  CapabilityBinding,
  OnlineOptions,
  RestartOptions,
  SendOptions,
  StateResult,
} from "../../core/plugin-sdk";

import strategies from "./strategies";
import type {
  LlmStreamEmitter,
  TalkNoStreamResult,
} from "./strategies/local/types";

const METHOD_LOCAL = "local" as const;

function assertLocalMethod(method: unknown, operation: string): asserts method is "local" {
  if (method !== METHOD_LOCAL) {
    throw new Error(`${operation} requires method="local"`);
  }
}

type TalkProviderHost = {
  generateReply(input: SendOptions): Promise<TalkNoStreamResult>;
  streamReply(input: SendOptions): Promise<LlmStreamEmitter>;
};

function createCapabilityBindings(): CapabilityBinding[] {
  return [
    {
      capabilityId: "system.talk.engine.nostream",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as TalkProviderHost;
        return {
          generateReply: plugin.generateReply.bind(plugin),
        };
      },
    },
    {
      capabilityId: "system.talk.engine.stream",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as TalkProviderHost;
        return {
          streamReply: plugin.streamReply.bind(plugin),
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

  async generateReply(input: SendOptions): Promise<TalkNoStreamResult> {
    return strategies.local.generateReply(input);
  },

  async streamReply(input: SendOptions): Promise<LlmStreamEmitter> {
    return strategies.local.streamReply(input);
  },

  async send(options: SendOptions): Promise<unknown> {
    return strategies.local.send(options);
  },

  getCapabilityBindings(): CapabilityBinding[] {
    return createCapabilityBindings();
  },
};
