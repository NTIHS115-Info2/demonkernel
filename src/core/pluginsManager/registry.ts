/* 註解：插件掃描、manifest 驗證與 registry 建立流程。 */
import fs from "node:fs";
import path from "node:path";

import type { PluginManifest, PluginType } from "../plugin-sdk";
import { validateManifest } from "../plugin-sdk";

import { PluginsManagerError } from "./errors";
import type {
  InvalidPluginRecord,
  NormalizedDependencies,
  PluginDescriptor,
  PluginKey,
  ScanSummary,
  ScanSummaryByType,
} from "./types";

export function normalizePluginName(name: string): string {
  return name.trim().toLowerCase();
}

export function createPluginKey(type: PluginType, name: string): PluginKey {
  return `${type}:${normalizePluginName(name)}`;
}

export function normalizeDependencies(manifest: PluginManifest): NormalizedDependencies {
  const normalized: NormalizedDependencies = {
    skill: {},
    system: {},
  };

  const dependencyTypes: PluginType[] = ["skill", "system"];

  for (const depType of dependencyTypes) {
    const source = manifest.dependencies?.[depType] ?? {};

    for (const [name, version] of Object.entries(source)) {
      if (typeof version !== "string" || version.trim().length === 0) {
        throw new PluginsManagerError(
          "MANIFEST_INVALID",
          `manifest.dependencies.${depType}.${name} must be a non-empty string`
        );
      }

      normalized[depType][normalizePluginName(name)] = version;
    }
  }

  return normalized;
}

function emptyTypeSummary(): ScanSummaryByType {
  return {
    total: 0,
    registered: 0,
    invalid: 0,
  };
}

function toInvalidRecord(
  type: PluginType,
  directory: string,
  manifestPath: string,
  reason: string
): InvalidPluginRecord {
  return {
    type,
    directory,
    manifestPath,
    reason,
    recordedAt: new Date().toISOString(),
  };
}

export function discoverPluginsInDirectory(
  type: PluginType,
  basePath: string,
  registry: Map<PluginKey, PluginDescriptor>,
  invalidRegistry: Map<string, InvalidPluginRecord>
): ScanSummaryByType {
  const summary = emptyTypeSummary();

  if (!fs.existsSync(basePath)) {
    return summary;
  }

  const entries = fs.readdirSync(basePath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    summary.total += 1;

    const directoryPath = path.join(basePath, entry.name);
    const manifestPath = path.join(directoryPath, "plugin.manifest.json");
    const invalidKey = `${type}:${normalizePluginName(entry.name)}`;

    try {
      if (!fs.existsSync(manifestPath)) {
        throw new PluginsManagerError(
          "MANIFEST_INVALID",
          `plugin ${entry.name} is missing plugin.manifest.json`
        );
      }

      const raw = fs.readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(raw) as PluginManifest;

      validateManifest(manifest);

      if (manifest.meta.type !== type) {
        throw new PluginsManagerError(
          "MANIFEST_INVALID",
          `manifest.meta.type is ${manifest.meta.type}, expected ${type}`
        );
      }

      const entryPath = path.join(directoryPath, manifest.meta.entry);
      if (!fs.existsSync(entryPath)) {
        throw new PluginsManagerError(
          "ENTRY_NOT_FOUND",
          `entry file not found: ${entryPath}`
        );
      }

      const normalizedName = normalizePluginName(manifest.meta.name);
      const key = createPluginKey(type, manifest.meta.name);

      if (registry.has(key)) {
        throw new PluginsManagerError(
          "MANIFEST_INVALID",
          `duplicate plugin key detected: ${key}`
        );
      }

      const descriptor: PluginDescriptor = {
        key,
        type,
        name: manifest.meta.name,
        normalizedName,
        version: manifest.meta.version,
        startupWeight: manifest.runtime.startupWeight,
        directoryPath,
        manifestPath,
        entryPath,
        manifest,
        dependencies: normalizeDependencies(manifest),
      };

      registry.set(key, descriptor);
      invalidRegistry.delete(invalidKey);
      summary.registered += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      invalidRegistry.set(invalidKey, toInvalidRecord(type, entry.name, manifestPath, reason));
      summary.invalid += 1;
    }
  }

  return summary;
}

export function buildScanSummary(
  skillSummary: ScanSummaryByType,
  systemSummary: ScanSummaryByType
): ScanSummary {
  return {
    total: skillSummary.total + systemSummary.total,
    registered: skillSummary.registered + systemSummary.registered,
    invalid: skillSummary.invalid + systemSummary.invalid,
    byType: {
      skill: skillSummary,
      system: systemSummary,
    },
  };
}

export function createDefaultPluginPaths(currentDir: string): {
  skillPluginsPath: string;
  systemPluginsPath: string;
} {
  return {
    skillPluginsPath: path.resolve(currentDir, "..", "..", "skillPlugins"),
    systemPluginsPath: path.resolve(currentDir, "..", "..", "systemPlugins"),
  };
}

