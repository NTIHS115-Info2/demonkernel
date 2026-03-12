# Capability Registry

`src/core/registry` 提供 capability provider 的統一查詢入口。

## 目的

Registry 只管理「capability -> provider instance」映射，讓其他 plugin 以 capability id 取得可呼叫的 provider。

## 與 CapabilitiesManager 的分工

- `CapabilitiesManager`：管理能力表、能力描述與能力合法性。
- `CapabilityRegistry`：管理能力提供者註冊與查詢。

Registry 註冊前會先檢查 capability id 是否存在於 `CapabilitiesManager`。

## 註冊流程

1. `pluginsManager` 掃描 manifest，先由 `CapabilitiesManager` 記錄 capability 描述。
2. plugin 成功 `online` 後，`pluginsManager` 將 plugin module（provider instance）註冊到 registry。
3. plugin `offline` 或 `discover` 重掃描時，`pluginsManager` 清除對應映射。

## 查詢流程

高階 plugin 透過 capability id 取回 provider 後，自行決定是否呼叫：

```ts
const llm = registry.resolve("llm");
const result = await llm.send(payload);
```

Registry 不做：

- 業務流程編排
- 自動呼叫 `send()`
- retry / fallback / routing
- tool decision
- chat orchestration

## Public API

- `register(capabilityId, provider, metadata)`
- `resolve(capabilityId)`
- `tryResolve(capabilityId)`
- `has(capabilityId)`
- `list()`

`provider` 必須符合統一入口：`send(input) -> output`。
