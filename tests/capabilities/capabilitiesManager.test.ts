import { describe, expect, it } from "vitest";

import { CapabilitiesManager } from "../../src/core/capabilities";

const customCapability = {
  id: "system.custom.ping",
  displayName: "Custom Ping",
  description: "Returns pong for ping payload.",
  version: "1.0.0",
  input: {
    type: "object" as const,
    properties: {
      action: {
        type: "string" as const,
        enum: ["ping"],
      },
    },
    required: ["action"],
    additionalProperties: false,
  },
  output: {
    type: "object" as const,
    properties: {
      action: {
        type: "string" as const,
      },
      result: {
        type: "string" as const,
        enum: ["pong"],
      },
    },
    required: ["action", "result"],
    additionalProperties: false,
  },
};

describe("capabilities manager", () => {
  it("loads default capabilities and returns immutable snapshots", () => {
    const manager = new CapabilitiesManager();

    const capability = manager.getCapabilityById("system.echo.message");
    expect(capability).toBeTruthy();
    expect(capability?.id).toBe("system.echo.message");

    const listed = manager.listCapabilities();
    expect(listed.some((item) => item.id === "system.echo.message")).toBe(true);

    const capabilityFromGetter = manager.getCapabilityById("system.echo.message");
    if (capabilityFromGetter) {
      capabilityFromGetter.displayName = "mutated";
    }

    const unchanged = manager.getCapabilityById("system.echo.message");
    expect(unchanged?.displayName).not.toBe("mutated");
  });

  it("registers capability by default id for system plugin", () => {
    const manager = new CapabilitiesManager();

    manager.registerFromManifest({
      pluginKey: "system:example",
      pluginType: "system",
      provides: ["system.echo.message"],
    });

    expect(manager.listProviders("system.echo.message")).toEqual(["system:example"]);
    expect(manager.listCapabilitiesByPlugin("system:example").map((item) => item.id)).toEqual([
      "system.echo.message",
    ]);
  });

  it("fails when system plugin references unknown default id", () => {
    const manager = new CapabilitiesManager();

    expect(() =>
      manager.registerFromManifest({
        pluginKey: "system:example",
        pluginType: "system",
        provides: ["system.missing.capability"],
      })
    ).toThrowError(/unknown default capability id/);
  });

  it("does not keep partial registration when one declaration is invalid", () => {
    const manager = new CapabilitiesManager();

    expect(() =>
      manager.registerFromManifest({
        pluginKey: "system:partial",
        pluginType: "system",
        provides: ["system.echo.message", "system.missing.capability"],
      })
    ).toThrowError(/unknown default capability id/);

    expect(manager.listProviders("system.echo.message")).toEqual([]);
    expect(manager.listCapabilitiesByPlugin("system:partial")).toEqual([]);
  });

  it("fails when non-system plugin tries to register capabilities", () => {
    const manager = new CapabilitiesManager();

    expect(() =>
      manager.registerFromManifest({
        pluginKey: "skill:example",
        pluginType: "skill",
        provides: [customCapability],
      })
    ).toThrowError(/only be registered by system plugin/);
  });

  it("fails when same capability id has conflicting definitions", () => {
    const manager = new CapabilitiesManager();

    manager.registerFromManifest({
      pluginKey: "system:first",
      pluginType: "system",
      provides: [customCapability],
    });

    expect(() =>
      manager.registerFromManifest({
        pluginKey: "system:second",
        pluginType: "system",
        provides: [
          {
            ...customCapability,
            output: {
              ...customCapability.output,
              required: ["action"],
            },
          },
        ],
      })
    ).toThrowError(/conflicts with existing definition/);
  });
});
