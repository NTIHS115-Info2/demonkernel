import type {
  OnlineOptions,
  RestartOptions,
  SendOptions,
  StateResult,
} from "@core/plugin-sdk";

import strategies from "./strategies";

let mode: "local" | "remote" = "local";

export = {
  async online(options: OnlineOptions): Promise<void> {
    if (!options.method) {
      throw new Error("online options missing method");
    }

    await strategies[options.method].online(options);
    mode = options.method;
  },

  async offline(): Promise<void> {
    await strategies[mode].offline();
  },

  async restart(options: RestartOptions): Promise<void> {
    if (!options.method) {
      throw new Error("restart options missing method");
    }

    await strategies[options.method].restart(options);
    mode = options.method;
  },

  async state(): Promise<StateResult> {
    return strategies[mode].state();
  },

  async send(options: SendOptions): Promise<unknown> {
    return strategies[mode].send(options);
  },
};
