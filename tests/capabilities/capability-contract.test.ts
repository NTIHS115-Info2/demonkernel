import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CapabilitiesManager,
  stableStringify,
  validateValueWithSchema,
} from "../../src/core/capabilities";
import { PluginsManager } from "../../src/core/pluginsManager";

type TempPluginRoot = {
  root: string;
  skillPath: string;
  systemPath: string;
};

function createTempPluginRoot(): TempPluginRoot {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "capability-contract-test-"));
  const skillPath = path.join(root, "skillPlugins");
  const systemPath = path.join(root, "systemPlugins");

  fs.mkdirSync(skillPath, { recursive: true });
  fs.mkdirSync(systemPath, { recursive: true });

  return { root, skillPath, systemPath };
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function writeEchoSystemPlugin(basePath: string, pluginName: string, invalidOutput = false): void {
  const pluginDir = path.join(basePath, pluginName);
  fs.mkdirSync(pluginDir, { recursive: true });

  writeJson(path.join(pluginDir, "plugin.manifest.json"), {
    meta: {
      name: pluginName,
      version: "1.0.0",
      type: "system",
      entry: "index.js",
    },
    runtime: {
      startupWeight: 0,
      method: ["local"],
      onlineOptions: {
        oneOf: [
          {
            when: { method: "local" },
            schema: {
              method: { type: "string", enum: ["local"] },
            },
          },
        ],
      },
    },
    dependencies: {
      skill: {},
      system: {},
    },
    capabilities: {
      provides: ["system.echo.message"],
    },
  });

  const moduleCode = `
let mode = "local";

module.exports = {
  async online(options) {
    mode = options.method || "local";
  },

  async offline() {},

  async restart(options) {
    mode = options.method || mode;
  },

  async state() {
    return { status: 1 };
  },

  async echoMessage(payload) {
    if (typeof payload.message !== "string") {
      throw new Error("payload.message must be a string");
    }

    if (${invalidOutput ? "true" : "false"}) {
      return {
        reply: payload.message
      };
    }

    return {
      reply: payload.message,
      method: mode,
    };
  },

  getCapabilityBindings() {
    return [
      {
        capabilityId: "system.echo.message",
        createProvider(pluginInstance) {
          return {
            echoMessage: pluginInstance.echoMessage.bind(pluginInstance),
          };
        },
      },
    ];
  },

  async send(payload) {
    return this.echoMessage(payload);
  },
};
`;

  fs.writeFileSync(path.join(pluginDir, "index.js"), moduleCode.trimStart(), "utf-8");
}

async function runCapabilityContractValidation(params: {
  manager: PluginsManager;
  capabilitiesManager: CapabilitiesManager;
  pluginKey: string;
}): Promise<string[]> {
  const failures: string[] = [];

  for (const capability of params.capabilitiesManager.listCapabilitiesByPlugin(params.pluginKey)) {
    for (const testCase of capability.testCases ?? []) {
      const inputValidation = validateValueWithSchema(
        capability.input,
        testCase.input,
        `${capability.id}:${testCase.id}:input`
      );

      const sendResult = await params.manager.send(
        params.pluginKey,
        (testCase.input ?? {}) as Record<string, unknown>
      );

      if (testCase.expectError) {
        if (sendResult.ok) {
          failures.push(`${capability.id}:${testCase.id} expected send error but got success`);
        }
        continue;
      }

      if (!inputValidation.ok) {
        failures.push(
          `${capability.id}:${testCase.id} input schema mismatch: ${inputValidation.errors.join(", ")}`
        );
        continue;
      }

      if (!sendResult.ok) {
        failures.push(`${capability.id}:${testCase.id} send failed: ${sendResult.error ?? "unknown"}`);
        continue;
      }

      const outputValidation = validateValueWithSchema(
        capability.output,
        sendResult.value,
        `${capability.id}:${testCase.id}:output`
      );
      if (!outputValidation.ok) {
        failures.push(
          `${capability.id}:${testCase.id} output schema mismatch: ${outputValidation.errors.join(", ")}`
        );
        continue;
      }

      if (testCase.expectedOutput !== undefined) {
        const expected = stableStringify(testCase.expectedOutput);
        const actual = stableStringify(sendResult.value);
        if (expected !== actual) {
          failures.push(`${capability.id}:${testCase.id} output value mismatch`);
        }
      }
    }
  }

  return failures;
}

describe("capability contract validation", () => {
  let tempRoot: TempPluginRoot;

  beforeEach(() => {
    tempRoot = createTempPluginRoot();
  });

  afterEach(() => {
    fs.rmSync(tempRoot.root, { recursive: true, force: true });
  });

  it("passes when plugin behavior follows declared capability", async () => {
    writeEchoSystemPlugin(tempRoot.systemPath, "contract-ok", false);

    const capabilitiesManager = new CapabilitiesManager();
    const manager = new PluginsManager({
      skillPluginsPath: tempRoot.skillPath,
      systemPluginsPath: tempRoot.systemPath,
      capabilitiesManager,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    });

    const summary = manager.discoverPlugins();
    expect(summary.invalid).toBe(0);

    const startup = await manager.onlineAll({
      defaultOnlineOptions: { method: "local" },
    });
    expect(startup.failed).toHaveLength(0);

    const failures = await runCapabilityContractValidation({
      manager,
      capabilitiesManager,
      pluginKey: "system:contract-ok",
    });

    expect(failures).toEqual([]);
  });

  it("detects output schema mismatch from plugin send()", async () => {
    writeEchoSystemPlugin(tempRoot.systemPath, "contract-bad-output", true);

    const capabilitiesManager = new CapabilitiesManager();
    const manager = new PluginsManager({
      skillPluginsPath: tempRoot.skillPath,
      systemPluginsPath: tempRoot.systemPath,
      capabilitiesManager,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    });

    const summary = manager.discoverPlugins();
    expect(summary.invalid).toBe(0);

    const startup = await manager.onlineAll({
      defaultOnlineOptions: { method: "local" },
    });
    expect(startup.failed).toHaveLength(0);

    const failures = await runCapabilityContractValidation({
      manager,
      capabilitiesManager,
      pluginKey: "system:contract-bad-output",
    });

    expect(failures.some((item) => item.includes("output schema mismatch"))).toBe(true);
  });
});
