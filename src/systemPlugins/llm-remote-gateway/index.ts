import type {
  OnlineOptions,
  RestartOptions,
  SendOptions,
  StateResult,
} from "../../core/plugin-sdk";

import strategies from "./strategies";

const METHOD_REMOTE = "remote" as const;

function assertRemoteMethod(method: unknown, operation: string): asserts method is "remote" {
  if (method !== METHOD_REMOTE) {
    throw new Error(`${operation} requires method="remote"`);
  }
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

  async send(options: SendOptions): Promise<unknown> {
    return strategies.remote.send(options);
  },
};
