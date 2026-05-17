import type {
  CapabilityBinding,
  OnlineOptions,
  RestartOptions,
  SendOptions,
  StateResult,
} from "../../core/plugin-sdk";

import strategies from "./strategies";
import type {
  ChatStreamEmitter,
  HealthCheckResult,
  ModelsListResult,
  RemoteSendOptions,
} from "./strategies/remote/types";

const METHOD_REMOTE = "remote" as const;

function assertRemoteMethod(method: unknown, operation: string): asserts method is "remote" {
  if (method !== METHOD_REMOTE) {
    throw new Error(`${operation} requires method="remote"`);
  }
}

type GatewayProviderHost = {
  streamChat(input: RemoteSendOptions): Promise<ChatStreamEmitter>;
  listModels(input?: Record<string, unknown>): Promise<ModelsListResult>;
  checkHealth(input?: Record<string, unknown>): Promise<HealthCheckResult>;
};

function createCapabilityBindings(): CapabilityBinding[] {
  return [
    {
      capabilityId: "system.llm.remote.chat.stream",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as GatewayProviderHost;
        return {
          streamChat: plugin.streamChat.bind(plugin),
        };
      },
    },
    {
      capabilityId: "system.llm.remote.models.list",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as GatewayProviderHost;
        return {
          listModels: plugin.listModels.bind(plugin),
        };
      },
    },
    {
      capabilityId: "system.llm.remote.health.check",
      createProvider(pluginInstance: unknown) {
        const plugin = pluginInstance as GatewayProviderHost;
        return {
          checkHealth: plugin.checkHealth.bind(plugin),
        };
      },
    },
  ];
}

export default {
  async online(options: OnlineOptions): Promise<void> {
    assertRemoteMethod(options.method, "online");
    await strategies.remote.online(options);
  },

  async offline(): Promise<void> {
    await strategies.remote.offline();
  },

  async restart(options: RestartOptions): Promise<void> {
    assertRemoteMethod(options.method, "restart");
    await strategies.remote.restart(options);
  },

  async state(): Promise<StateResult> {
    return strategies.remote.state();
  },

  async streamChat(input: RemoteSendOptions): Promise<ChatStreamEmitter> {
    return strategies.remote.streamChat(input);
  },

  async listModels(input?: Record<string, unknown>): Promise<ModelsListResult> {
    return strategies.remote.listModels(input);
  },

  async checkHealth(input?: Record<string, unknown>): Promise<HealthCheckResult> {
    return strategies.remote.checkHealth(input);
  },

  async send(options: SendOptions): Promise<unknown> {
    return strategies.remote.send(options);
  },

  getCapabilityBindings(): CapabilityBinding[] {
    return createCapabilityBindings();
  },
};
