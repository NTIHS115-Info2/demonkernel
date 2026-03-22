import { describe, expect, it } from "vitest";

import { CapabilitiesManager } from "../../src/core/capabilities";
import {
  CapabilityAlreadyRegisteredError,
  CapabilityNotFoundError,
  CapabilityRegistry,
  InvalidCapabilityProviderError,
} from "../../src/core/registry";

describe("capability registry", () => {
  function createRegistry(): CapabilityRegistry {
    return new CapabilityRegistry({
      capabilitiesManager: new CapabilitiesManager(),
    });
  }

  function createProvider() {
    return {
      echoMessage: async (input: Record<string, unknown>) => input,
    };
  }

  it("registers provider and resolves it by capability id", () => {
    const registry = createRegistry();
    const provider = createProvider();

    registry.register("system.echo.message", provider, {
      pluginKey: "system:provider",
      registeredAt: "2026-03-10T10:00:00.000Z",
    });

    expect(registry.resolve("system.echo.message")).toBe(provider);
  });

  it("returns null for tryResolve when capability is not registered", () => {
    const registry = createRegistry();

    expect(registry.tryResolve("system.echo.message")).toBeNull();
    expect(registry.tryResolve("system.missing.capability")).toBeNull();
  });

  it("throws when registering unknown capability id", () => {
    const registry = createRegistry();

    expect(() =>
      registry.register("system.missing.capability", createProvider(), {
        pluginKey: "system:provider",
        registeredAt: "2026-03-10T10:00:00.000Z",
      })
    ).toThrowError(CapabilityNotFoundError);
  });

  it("throws when registering duplicated capability id", () => {
    const registry = createRegistry();

    registry.register("system.echo.message", createProvider(), {
      pluginKey: "system:first",
      registeredAt: "2026-03-10T10:00:00.000Z",
    });

    expect(() =>
      registry.register("system.echo.message", createProvider(), {
        pluginKey: "system:second",
        registeredAt: "2026-03-10T11:00:00.000Z",
      })
    ).toThrowError(CapabilityAlreadyRegisteredError);
  });

  it("throws when provider is empty or missing callable methods", () => {
    const registry = createRegistry();

    expect(() =>
      registry.register("system.echo.message", null as unknown as { echoMessage: () => Promise<unknown> }, {
        pluginKey: "system:bad-provider",
        registeredAt: "2026-03-10T10:00:00.000Z",
      })
    ).toThrowError(InvalidCapabilityProviderError);

    expect(() =>
      registry.register("system.echo.message", {} as unknown as { echoMessage: () => Promise<unknown> }, {
        pluginKey: "system:bad-provider",
        registeredAt: "2026-03-10T10:00:00.000Z",
      })
    ).toThrowError(InvalidCapabilityProviderError);
  });

  it("has() and list() return expected values with metadata", () => {
    const registry = createRegistry();
    const provider = createProvider();

    registry.register("system.echo.message", provider, {
      pluginKey: "system:provider",
      registeredAt: "2026-03-10T10:00:00.000Z",
    });

    expect(registry.has("system.echo.message")).toBe(true);
    expect(registry.has("system.custom.answer")).toBe(false);

    expect(registry.list()).toEqual([
      {
        capabilityId: "system.echo.message",
        metadata: {
          pluginKey: "system:provider",
          registeredAt: "2026-03-10T10:00:00.000Z",
        },
      },
    ]);
  });

  it("resolve throws when capability provider is not registered", () => {
    const registry = createRegistry();

    expect(() => registry.resolve("system.echo.message")).toThrowError(CapabilityNotFoundError);
  });
});
