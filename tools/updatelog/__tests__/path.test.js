"use strict";

const {
  buildMainUpdatePath,
  buildPluginUpdatePath,
  parseUpdatePath,
  slugifyPluginName,
} = require("../lib/path");

describe("path", () => {
  it("builds main path", () => {
    const result = buildMainUpdatePath("1.0.1");
    expect(result.ok).toBe(true);
    expect(result.value.replace(/\\/g, "/")).toBe(
      "Updates/Main/v1/v1.0/v1.0.1.md"
    );
  });

  it("builds plugin path with slug", () => {
    const result = buildPluginUpdatePath("skill", "Example Plugin", "2.3.4");
    expect(result.ok).toBe(true);
    expect(result.value.replace(/\\/g, "/")).toBe(
      "Updates/Plugins/skill/example-plugin/v2/v2.3/v2.3.4.md"
    );
  });

  it("parses valid paths", () => {
    const main = parseUpdatePath("Updates/Main/v1/v1.2/v1.2.3.md");
    expect(main.ok).toBe(true);
    expect(main.value.scope).toBe("Main");

    const plugin = parseUpdatePath(
      "Updates/Plugins/system/demo-plugin/v3/v3.4/v3.4.5.md"
    );
    expect(plugin.ok).toBe(true);
    expect(plugin.value.scope).toBe("system/demo-plugin");
  });

  it("slugifies plugin names", () => {
    expect(slugifyPluginName("  My_Plugin Name!! ")).toBe("my-plugin-name");
  });
});
