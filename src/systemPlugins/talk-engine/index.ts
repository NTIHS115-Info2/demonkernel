import type {
  OnlineOptions,
  RestartOptions,
  SendOptions,
  StateResult,
} from "../../core/plugin-sdk";

import strategies from "./strategies";

const METHOD_LOCAL = "local" as const;

function assertLocalMethod(method: unknown, operation: string): asserts method is "local" {
  if (method !== METHOD_LOCAL) {
    throw new Error(`${operation} requires method="local"`);
  }
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

  async send(options: SendOptions): Promise<unknown> {
    return strategies.local.send(options);
  },
};

