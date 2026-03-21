/* 註解：src/index 與 PluginsManager 啟動整合測試。 */
import { afterEach, describe, expect, it, vi } from "vitest";

import pluginsManager from "../../src/core/pluginsManager";
import capabilityRegistry from "../../src/core/registry";
import { parseCliArgs, run } from "../../src/index";

const originalEnv = { ...process.env };

describe("src/index integration", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
  });

  it("runs startup through core flow online sequence by default", async () => {
    process.env.LLM_REMOTE_BASE_URL = "https://llm.example";
    process.env.LLM_REMOTE_MODEL = "gpt-test";
    process.env.TALK_RELAY_ENABLED = "false";
    process.env.TALK_RELAY_ERROR_REPLY = "請稍後再試";

    vi.spyOn(pluginsManager, "discoverPlugins").mockReturnValue({
      total: 3,
      registered: 3,
      invalid: 0,
      byType: {
        skill: { total: 0, registered: 0, invalid: 0 },
        system: { total: 3, registered: 3, invalid: 0 },
      },
    });

    vi.spyOn(pluginsManager, "validateDependencies").mockReturnValue({
      ok: true,
      errors: [],
    });

    const onlineSpy = vi.spyOn(pluginsManager, "online").mockImplementation(async (ref) => ({
      key: typeof ref === "string" ? ref : "unknown",
      ok: true,
      state: "online",
    }));

    await run([]);

    expect(onlineSpy).toHaveBeenCalledTimes(3);
    expect(onlineSpy).toHaveBeenNthCalledWith(1, "system:llm-remote-gateway", {
      onlineOptions: {
        method: "remote",
        baseUrl: "https://llm.example",
        model: "gpt-test",
      },
    });
    expect(onlineSpy).toHaveBeenNthCalledWith(2, "system:discord", {
      onlineOptions: {
        method: "local",
      },
    });
    expect(onlineSpy).toHaveBeenNthCalledWith(3, "system:talk-engine", {
      onlineOptions: {
        method: "local",
        relayEnabled: false,
        relayErrorReply: "請稍後再試",
      },
    });
  });

  it("fails fast when LLM_REMOTE_BASE_URL is missing in default startup", async () => {
    delete process.env.LLM_REMOTE_BASE_URL;
    delete process.env.LLM_REMOTE_MODEL;

    vi.spyOn(pluginsManager, "discoverPlugins").mockReturnValue({
      total: 3,
      registered: 3,
      invalid: 0,
      byType: {
        skill: { total: 0, registered: 0, invalid: 0 },
        system: { total: 3, registered: 3, invalid: 0 },
      },
    });

    vi.spyOn(pluginsManager, "validateDependencies").mockReturnValue({
      ok: true,
      errors: [],
    });

    const onlineSpy = vi.spyOn(pluginsManager, "online").mockResolvedValue({
      key: "system:llm-remote-gateway",
      ok: true,
      state: "online",
    });

    await expect(run([])).rejects.toThrow("LLM remote baseUrl is required");
    expect(onlineSpy).not.toHaveBeenCalled();
  });

  it("runs startup through pluginsManager.online when plugin is specified", async () => {
    delete process.env.LLM_REMOTE_BASE_URL;

    vi.spyOn(pluginsManager, "discoverPlugins").mockReturnValue({
      total: 1,
      registered: 1,
      invalid: 0,
      byType: {
        skill: { total: 1, registered: 1, invalid: 0 },
        system: { total: 0, registered: 0, invalid: 0 },
      },
    });

    vi.spyOn(pluginsManager, "validateDependencies").mockReturnValue({
      ok: true,
      errors: [],
    });

    const onlineSpy = vi.spyOn(pluginsManager, "online").mockResolvedValue({
      key: "skill:example",
      ok: true,
      state: "online",
    });

    await run(["--plugin", "skill:example", "--method", "local"]);
    expect(onlineSpy).toHaveBeenCalledWith("skill:example", {
      onlineOptions: {
        method: "local",
        relayEnabled: true,
      },
    });
  });

  it("parses CLI options and env fallback for startup", () => {
    process.env.LLM_REMOTE_BASE_URL = "https://env-llm.example";
    process.env.LLM_REMOTE_MODEL = "env-model";
    process.env.TALK_RELAY_ENABLED = "false";
    process.env.TALK_RELAY_ERROR_REPLY = "env reply";

    const envCli = parseCliArgs([]);
    expect(envCli.llmBaseUrl).toBe("https://env-llm.example");
    expect(envCli.llmModel).toBe("env-model");
    expect(envCli.talkRelayEnabled).toBe(false);
    expect(envCli.talkRelayErrorReply).toBe("env reply");

    const cli = parseCliArgs([
      "--plugin",
      "skill:demo",
      "--method",
      "remote",
      "--url",
      "https://alias.example",
      "--llm-model",
      "cli-model",
      "--talk-relay-enabled",
      "false",
      "--talk-relay-error-reply",
      "busy",
    ]);

    expect(cli.plugin).toBe("skill:demo");
    expect(cli.llmBaseUrl).toBe("https://alias.example");
    expect(cli.llmModel).toBe("cli-model");
    expect(cli.talkRelayEnabled).toBe(false);
    expect(cli.talkRelayErrorReply).toBe("busy");
    expect(cli.options).toEqual({
      method: "remote",
      url: "https://alias.example",
      baseUrl: "https://alias.example",
      model: "cli-model",
      relayEnabled: false,
      relayErrorReply: "busy",
    });
  });

  it("binds default pluginsManager to the default capability registry", () => {
    const internal = pluginsManager as unknown as {
      capabilityRegistry?: unknown;
    };

    expect(internal.capabilityRegistry).toBe(capabilityRegistry);
  });
});
