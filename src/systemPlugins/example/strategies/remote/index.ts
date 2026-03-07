import type {
  SendOptions,
  StateResult,
  StrategyOnlineOptions,
  StrategyRestartOptions,
} from "@core/plugin-sdk";
import { createKernelLogger } from "@core/logger";

let online = false;
const logger = createKernelLogger("plugin-example-system-remote", {
  plugin: "example",
  type: "system",
  strategy: "remote",
});

export = {
  method: "remote" as const,

  async online(options: StrategyOnlineOptions): Promise<void> {
    logger.info("system example plugin(remote) online with options", { options });
    online = true;
  },

  async offline(): Promise<void> {
    logger.info("system example plugin(remote) offline");
    online = false;
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    await this.offline();
    await this.online(options);
    logger.info("system example plugin(remote) restart with options", { options });
  },

  async state(): Promise<StateResult> {
    return { status: online ? 1 : 0 };
  },

  async send(options: SendOptions): Promise<unknown> {
    logger.info("system example plugin(remote) send with options", { options });
    const message = options.message;
    if (typeof message !== "string") {
      throw new Error("payload.message must be a string");
    }

    return {
      reply: message,
      method: "remote",
    };
  },
};
