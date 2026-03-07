/* 註解：依賴展開、依賴狀態判定與循環依賴偵測。 */
import type { PluginType } from "@core/plugin-sdk";

import type {
  DependencyComponentMap,
  DependencyGraphAnalysis,
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
  return analyzeDependencyGraph(pendingKeys, registry).cycles;
}

function buildPendingAdjacency(params: {
  pendingKeys: Set<PluginKey>;
  registry: Map<PluginKey, PluginDescriptor>;
}): Map<PluginKey, PluginKey[]> {
  const { pendingKeys, registry } = params;
  const adjacency = new Map<PluginKey, PluginKey[]>();

  for (const key of pendingKeys) {
    const descriptor = registry.get(key);
    if (!descriptor) {
      adjacency.set(key, []);
      continue;
    }

    const deps = getDependencyRefs(descriptor)
      .map((ref) => ref.dependencyKey)
      .filter((depKeyValue) => pendingKeys.has(depKeyValue));

    adjacency.set(key, deps);
  }

  return adjacency;
}

function getCyclesFromComponents(params: {
  components: PluginKey[][];
  adjacency: Map<PluginKey, PluginKey[]>;
}): PluginKey[][] {
  const { components, adjacency } = params;
  const cycles: PluginKey[][] = [];

  for (const component of components) {
    if (component.length > 1) {
      cycles.push(component);
      continue;
    }

    const key = component[0];
    const deps = adjacency.get(key) ?? [];
    if (deps.includes(key)) {
      cycles.push(component);
    }
  }

  return cycles;
}

export function analyzeDependencyGraph(
  pendingKeys: Set<PluginKey>,
  registry: Map<PluginKey, PluginDescriptor>
): DependencyGraphAnalysis {
  const adjacency = buildPendingAdjacency({ pendingKeys, registry });
  const visited = new Set<PluginKey>();
  const order: PluginKey[] = [];

  const dfsOrder = (key: PluginKey): void => {
    visited.add(key);
    const deps = adjacency.get(key) ?? [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        dfsOrder(dep);
      }
    }
    order.push(key);
  };

  for (const key of pendingKeys) {
    if (!visited.has(key)) {
      dfsOrder(key);
    }
  }

  const reverseAdjacency = new Map<PluginKey, PluginKey[]>();
  for (const key of pendingKeys) {
    reverseAdjacency.set(key, []);
  }

  for (const [from, deps] of adjacency.entries()) {
    for (const to of deps) {
      const existing = reverseAdjacency.get(to);
      if (existing) {
        existing.push(from);
      } else {
        reverseAdjacency.set(to, [from]);
      }
    }
  }

  const assigned = new Set<PluginKey>();
  const components: PluginKey[][] = [];

  const collectComponent = (root: PluginKey): PluginKey[] => {
    const stack: PluginKey[] = [root];
    const component: PluginKey[] = [];
    assigned.add(root);

    while (stack.length > 0) {
      const key = stack.pop() as PluginKey;
      component.push(key);

      const reverseDeps = reverseAdjacency.get(key) ?? [];
      for (const dep of reverseDeps) {
        if (assigned.has(dep)) {
          continue;
        }
        assigned.add(dep);
        stack.push(dep);
      }
    }

    component.sort((a, b) => a.localeCompare(b));
    return component;
  };

  for (let index = order.length - 1; index >= 0; index -= 1) {
    const key = order[index] as PluginKey;
    if (assigned.has(key)) {
      continue;
    }
    components.push(collectComponent(key));
  }

  const componentByKey: DependencyComponentMap = new Map();
  for (const component of components) {
    const sortedByWeight = [...component].sort((a, b) => {
      const weightA = registry.get(a)?.startupWeight ?? 0;
      const weightB = registry.get(b)?.startupWeight ?? 0;
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return a.localeCompare(b);
    });

    for (const key of sortedByWeight) {
      componentByKey.set(key, sortedByWeight);
    }
  }

  const cycles = getCyclesFromComponents({ components, adjacency });

  return {
    cycles,
    componentByKey,
  };
}

export function evaluateDependencyStatus(params: {
  descriptor: PluginDescriptor;
  registry: Map<PluginKey, PluginDescriptor>;
  runtime: Map<PluginKey, PluginRuntime>;
  requestedKeys: Set<PluginKey>;
  failedKeys: Set<PluginKey>;
  componentByKey: DependencyComponentMap;
}): DependencyStatus {
  const { descriptor, registry, runtime, requestedKeys, failedKeys, componentByKey } = params;

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

    const ownerComponent = componentByKey.get(descriptor.key);
    const dependencyComponent = componentByKey.get(dep.dependencyKey);
    const inSameComponent = ownerComponent && dependencyComponent && ownerComponent === dependencyComponent;

    if (inSameComponent) {
      if (dependency.startupWeight > descriptor.startupWeight) {
        return {
          kind: "waiting",
          dependencyKey: dep.dependencyKey,
        };
      }
      continue;
    }

    return {
      kind: "waiting",
      dependencyKey: dep.dependencyKey,
    };
  }

  return { kind: "satisfied" };
}
