import type {
  SendOptions,
  StateResult,
  StrategyOnlineOptions,
  StrategyRestartOptions,
} from "@core/plugin-sdk";

let online = false;

export = {
  method: "remote" as const,

  async online(options: StrategyOnlineOptions): Promise<void> {
    console.log("example plugin(remote) online with options:", options);
    online = true;
  },

  async offline(): Promise<void> {
    console.log("example plugin(remote) offline");
    online = false;
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    await this.offline();
    await this.online(options);
    console.log("example plugin(remote) restart with options:", options);
  },

  async state(): Promise<StateResult> {
    return { status: online ? 1 : 0 };
  },

  async send(options: SendOptions): Promise<unknown> {
    console.log("example plugin(remote) send with options:", options);
    return undefined;
  },
};
