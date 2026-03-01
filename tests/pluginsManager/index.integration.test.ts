/* 註解：src/index 與 PluginsManager 啟動整合測試。 */
import { afterEach, describe, expect, it, vi } from "vitest";

import pluginsManager from "../../src/core/pluginsManager";
import { parseCliArgs, run } from "../../src/index";

describe("src/index integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
  });

  it("runs startup through pluginsManager.onlineAll by default", async () => {
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

    const onlineAllSpy = vi.spyOn(pluginsManager, "onlineAll").mockResolvedValue({
      requested: ["skill:example"],
      started: ["skill:example"],
      skipped: [],
      failed: [],
      blocked: [],
      cycles: [],
    });

    await run([]);
    expect(onlineAllSpy).toHaveBeenCalled();
  });

  it("runs startup through pluginsManager.online when plugin is specified", async () => {
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
      onlineOptions: { method: "local" },
    });
  });

  it("parses CLI options for manager startup", () => {
    const cli = parseCliArgs([
      "--plugin",
      "skill:demo",
      "--method",
      "remote",
      "--url",
      "https://example.com",
      "--token",
      "abc",
    ]);

    expect(cli.plugin).toBe("skill:demo");
    expect(cli.options).toEqual({
      method: "remote",
      url: "https://example.com",
      token: "abc",
    });
  });
});
