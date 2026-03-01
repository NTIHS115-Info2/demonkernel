import type {
  SendOptions,
  StateResult,
  StrategyOnlineOptions,
  StrategyRestartOptions,
} from "@core/plugin-sdk";

let online = false;

export = {
  method: "local" as const,

  async online(options: StrategyOnlineOptions): Promise<void> {
    console.log("example plugin(local) online with options:", options);
    online = true;
  },

  async offline(): Promise<void> {
    console.log("example plugin(local) offline");
    online = false;
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    await this.offline();
    await this.online(options);
    console.log("example plugin(local) restart with options:", options);
  },

  async state(): Promise<StateResult> {
    return { status: online ? 1 : 0 };
  },

  async send(options: SendOptions): Promise<unknown> {
    console.log("example plugin(local) send with options:", options);
    return undefined;
  },
};
