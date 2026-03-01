import type {
  SendOptions,
  StateResult,
  StrategyOnlineOptions,
  StrategyRestartOptions,
} from "@core/plugin-sdk";
import { createKernelLogger } from "@core/logger";

let online = false;
const logger = createKernelLogger("plugin-example-skill-remote", {
  plugin: "example",
  type: "skill",
  strategy: "remote",
});

export = {
  method: "remote" as const,

  async online(options: StrategyOnlineOptions): Promise<void> {
    logger.info("example plugin(remote) online with options", { options });
    online = true;
  },

  async offline(): Promise<void> {
    logger.info("example plugin(remote) offline");
    online = false;
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    await this.offline();
    await this.online(options);
    logger.info("example plugin(remote) restart with options", { options });
  },

  async state(): Promise<StateResult> {
    return { status: online ? 1 : 0 };
  },

  async send(options: SendOptions): Promise<unknown> {
    logger.info("example plugin(remote) send with options", { options });
    return undefined;
  },
};
