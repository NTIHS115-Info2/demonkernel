import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CAPABILITY_SYSTEM_PROMPT_GET = "system.prompt.manager.get";
const DEFAULT_PROMPT = "Default prompt from file.";
const EMERGENCY_SYSTEM_PROMPT = "Respond to the user request.";
const PROMPT_FILE_SUFFIX = ".system.prompt.md";

const loggerMock = vi.hoisted(() => {
  const instance = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
    isLevelEnabled: vi.fn(() => true),
  } as Record<string, ReturnType<typeof vi.fn>>;

  (instance.child as ReturnType<typeof vi.fn>).mockImplementation(() => instance);

  const createKernelLogger = vi.fn(() => instance);
  const reset = (): void => {
    createKernelLogger.mockClear();
    for (const key of Object.keys(instance)) {
      const value = instance[key];
      if (value && typeof (value as { mockClear?: () => void }).mockClear === "function") {
        (value as { mockClear: () => void }).mockClear();
      }
    }
    (instance.child as ReturnType<typeof vi.fn>).mockImplementation(() => instance);
    (instance.isLevelEnabled as ReturnType<typeof vi.fn>).mockImplementation(() => true);
  };

  return {
    instance,
    createKernelLogger,
    reset,
  };
});

vi.mock("../../src/core/logger", () => ({
  createKernelLogger: loggerMock.createKernelLogger,
}));

type PromptManagerPlugin = {
  online(options: Record<string, unknown>): Promise<void>;
  offline(): Promise<void>;
  send(options: Record<string, unknown>): Promise<unknown>;
  getSystemPrompt(options: { state: string }): Promise<string>;
  getCapabilityBindings(): Array<{
    capabilityId: string;
    createProvider(pluginInstance: unknown): Record<string, unknown>;
  }>;
};

let pluginModule: PromptManagerPlugin | null = null;
let tempDir: string;

async function loadPluginModule(): Promise<PromptManagerPlugin> {
  vi.resetModules();
  const imported = await import("../../src/systemPlugins/system-prompt-manager/index.js");
  pluginModule = (imported.default ?? imported) as unknown as PromptManagerPlugin;
  return pluginModule;
}

function promptFileForState(state: string): string {
  return path.join(tempDir, `${state}${PROMPT_FILE_SUFFIX}`);
}

function writePrompt(state: string, content: string): void {
  fs.writeFileSync(promptFileForState(state), content, "utf-8");
}

describe("system plugin: system-prompt-manager", () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "system-prompt-manager-"));
    loggerMock.reset();
  });

  afterEach(async () => {
    if (pluginModule) {
      try {
        await pluginModule.offline();
      } catch {
        // ignore cleanup failure
      }
      pluginModule = null;
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("reads the common system prompt from the configured prompt directory", async () => {
    writePrompt("common", "Common prompt from fixture.");

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", promptDir: tempDir });

    await expect(plugin.getSystemPrompt({ state: "common" })).resolves.toBe("Common prompt from fixture.");
    expect(loggerMock.instance.warn).not.toHaveBeenCalled();
  });

  it("uses the current custom file content on each common prompt read", async () => {
    writePrompt("common", "First custom prompt.");

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", promptDir: tempDir });

    await expect(plugin.getSystemPrompt({ state: "common" })).resolves.toBe("First custom prompt.");
    writePrompt("common", "Second custom prompt.");
    await expect(plugin.getSystemPrompt({ state: "common" })).resolves.toBe("Second custom prompt.");
  });

  it("resolves arbitrary upstream states without a predefined state list", async () => {
    writePrompt("support", "Support prompt from fixture.");

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", promptDir: tempDir });

    await expect(plugin.getSystemPrompt({ state: "support" })).resolves.toBe("Support prompt from fixture.");
    expect(loggerMock.instance.warn).not.toHaveBeenCalled();
  });

  it("falls back to the minimal default prompt and warns when the requested state file is missing", async () => {
    writePrompt("default", DEFAULT_PROMPT);

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", promptDir: tempDir });

    await expect(plugin.getSystemPrompt({ state: "missing-state" })).resolves.toBe(DEFAULT_PROMPT);
    expect(loggerMock.instance.warn).toHaveBeenCalledWith(
      "system prompt file read failed",
      expect.objectContaining({
        state: "missing-state",
        filePath: promptFileForState("missing-state"),
        promptKind: "requested",
      })
    );
  });

  it("falls back to the minimal default prompt and warns when state is missing", async () => {
    writePrompt("default", DEFAULT_PROMPT);

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", promptDir: tempDir });

    await expect(plugin.getSystemPrompt({ state: "" })).resolves.toBe(DEFAULT_PROMPT);
    expect(loggerMock.instance.warn).toHaveBeenCalledWith(
      "system prompt state is missing, using default prompt",
      expect.objectContaining({
        state: "",
      })
    );
  });

  it("uses the current default prompt file content on fallback reads", async () => {
    writePrompt("default", "First default prompt.");

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", promptDir: tempDir });

    await expect(plugin.getSystemPrompt({ state: "missing-state" })).resolves.toBe("First default prompt.");
    writePrompt("default", "Second default prompt.");
    await expect(plugin.getSystemPrompt({ state: "missing-state" })).resolves.toBe("Second default prompt.");
  });

  it("uses the emergency prompt only when the default prompt file is also unavailable", async () => {
    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", promptDir: tempDir });

    await expect(plugin.getSystemPrompt({ state: "missing-state" })).resolves.toBe(EMERGENCY_SYSTEM_PROMPT);
    expect(loggerMock.instance.warn).toHaveBeenCalledWith(
      "default system prompt file unavailable, using emergency prompt",
      expect.objectContaining({
        reason: "requested-prompt-unavailable",
        requestedState: "missing-state",
        state: "default",
        filePath: promptFileForState("default"),
      })
    );
  });

  it("exposes system.prompt.manager.get as a capability provider and send compatibility action", async () => {
    writePrompt("custom", "Capability prompt.");

    const plugin = await loadPluginModule();
    await plugin.online({ method: "local", promptDir: tempDir });

    const bindings = plugin.getCapabilityBindings();
    expect(bindings.map((binding) => binding.capabilityId)).toEqual([CAPABILITY_SYSTEM_PROMPT_GET]);

    const provider = bindings[0]?.createProvider(plugin) as {
      getSystemPrompt(input: { state: string }): Promise<string>;
    };
    await expect(provider.getSystemPrompt({ state: "custom" })).resolves.toBe("Capability prompt.");
    await expect(plugin.send({ action: CAPABILITY_SYSTEM_PROMPT_GET, state: "custom" })).resolves.toBe("Capability prompt.");
  });
});
