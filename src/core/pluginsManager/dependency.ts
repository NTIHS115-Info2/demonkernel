/* 註解：依賴展開、依賴狀態判定與循環依賴偵測。 */
import type { PluginType } from "@core/plugin-sdk";

import type {
  DependencyRef,
  DependencyStatus,
  PluginDescriptor,
  PluginKey,
  PluginRuntime,
} from "./types";

function depKey(type: PluginType, name: string): PluginKey {
  return `${type}:${name}`;
}

export function getDependencyRefs(descriptor: PluginDescriptor): DependencyRef[] {
  const refs: DependencyRef[] = [];

  for (const [name, version] of Object.entries(descriptor.dependencies.skill)) {
    refs.push({
      owner: descriptor.key,
      dependencyKey: depKey("skill", name),
      expectedVersion: version,
    });
  }

  for (const [name, version] of Object.entries(descriptor.dependencies.system)) {
    refs.push({
      owner: descriptor.key,
      dependencyKey: depKey("system", name),
      expectedVersion: version,
    });
  }

  return refs;
}

export function detectDependencyCycles(
  pendingKeys: Set<PluginKey>,
  registry: Map<PluginKey, PluginDescriptor>
): PluginKey[][] {
  const visited = new Set<PluginKey>();
  const inStack = new Set<PluginKey>();
  const path: PluginKey[] = [];
  const cycles: PluginKey[][] = [];
  const cycleSignatures = new Set<string>();

  const getPendingDeps = (key: PluginKey): PluginKey[] => {
    const descriptor = registry.get(key);
    if (!descriptor) {
      return [];
    }

    const deps = getDependencyRefs(descriptor)
      .map((ref) => ref.dependencyKey)
      .filter((depKeyValue) => pendingKeys.has(depKeyValue));

    return deps;
  };

  const dfs = (key: PluginKey): void => {
    visited.add(key);
    inStack.add(key);
    path.push(key);

    for (const dep of getPendingDeps(key)) {
      if (!visited.has(dep)) {
        dfs(dep);
        continue;
      }

      if (inStack.has(dep)) {
        const idx = path.indexOf(dep);
        if (idx >= 0) {
          const cycle = path.slice(idx);
          const signature = [...cycle].sort().join("|");
          if (!cycleSignatures.has(signature)) {
            cycleSignatures.add(signature);
            cycles.push(cycle);
          }
        }
      }
    }

    inStack.delete(key);
    path.pop();
  };

  for (const key of pendingKeys) {
    if (!visited.has(key)) {
      dfs(key);
    }
  }

  return cycles;
}

export function evaluateDependencyStatus(params: {
  descriptor: PluginDescriptor;
  registry: Map<PluginKey, PluginDescriptor>;
  runtime: Map<PluginKey, PluginRuntime>;
  requestedKeys: Set<PluginKey>;
  failedKeys: Set<PluginKey>;
}): DependencyStatus {
  const { descriptor, registry, runtime, requestedKeys, failedKeys } = params;

  for (const dep of getDependencyRefs(descriptor)) {
    const dependency = registry.get(dep.dependencyKey);

    if (!dependency) {
      return {
        kind: "failed",
        reason: `dependency not found: ${dep.dependencyKey}`,
      };
    }

    if (dependency.version !== dep.expectedVersion) {
      return {
        kind: "failed",
        reason: `dependency version mismatch for ${dep.dependencyKey}: expected ${dep.expectedVersion}, got ${dependency.version}`,
      };
    }

    const dependencyRuntime = runtime.get(dep.dependencyKey);
    if (dependencyRuntime?.state === "online") {
      continue;
    }

    if (failedKeys.has(dep.dependencyKey)) {
      return {
        kind: "failed",
        reason: `dependency failed: ${dep.dependencyKey}`,
      };
    }

    if (!requestedKeys.has(dep.dependencyKey)) {
      return {
        kind: "failed",
        reason: `dependency ${dep.dependencyKey} is offline and not in startup queue`,
      };
    }

    return {
      kind: "waiting",
      dependencyKey: dep.dependencyKey,
    };
  }

  return { kind: "satisfied" };
}
