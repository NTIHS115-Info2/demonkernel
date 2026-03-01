import type {
  SendOptions,
  StateResult,
  StrategyOnlineOptions,
  StrategyRestartOptions,
} from "@core/plugin-sdk";
import { createKernelLogger } from "@core/logger";

let online = false;
const logger = createKernelLogger("plugin-example-system-local", {
  plugin: "example",
  type: "system",
  strategy: "local",
});

export = {
  method: "local" as const,

  async online(options: StrategyOnlineOptions): Promise<void> {
    logger.info("system example plugin(local) online with options", { options });
    online = true;
  },

  async offline(): Promise<void> {
    logger.info("system example plugin(local) offline");
    online = false;
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    await this.offline();
    await this.online(options);
    logger.info("system example plugin(local) restart with options", { options });
  },

  async state(): Promise<StateResult> {
    return { status: online ? 1 : 0 };
  },

  async send(options: SendOptions): Promise<unknown> {
    logger.info("system example plugin(local) send with options", { options });
    return undefined;
  },
};
