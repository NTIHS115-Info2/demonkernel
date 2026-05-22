# Demonkernel

Current release: <!-- DEMONKERNEL_VERSION:start -->v0.18.2<!-- DEMONKERNEL_VERSION:end -->

語言：[English](README.md) | 繁體中文

Demonkernel 是一個 TypeScript runtime，用來建立 plugin-based AI conversation systems。它會啟動一組彼此協作的 system plugins，透過明確的 capabilities 把它們連接起來，並執行一個可以結合 Discord I/O、conversation history、file-backed system prompts，以及 OpenAI-compatible remote LLM endpoint 的 conversation loop。

當你需要的是可由 plugins 擴充的本機 Node.js kernel，而不是單一 hard-coded bot script，這個專案就有用。每個 plugin 都會宣告自己是什麼、如何啟動、依賴什麼，以及提供哪些 capabilities。Runtime 會驗證這些宣告、依 dependency-aware 順序將 plugins 帶上線，並提供 registry，讓系統其他部分可以找到能執行特定 named operation 的 provider。

## 執行內容

預設 startup path 會啟動一組 conversation stack：

1. `llm-remote-gateway` 連接 OpenAI-compatible remote LLM service。
2. `discord` 連接 Discord inbound messages、outbound replies 與 typing status。
3. `conversation-history` 儲存 scoped transcript history。
4. `system-prompt-manager` 從檔案載入 TalkEngine states 使用的 prompts。
5. `talk-engine` 組合 prompts、讀取 history、呼叫 LLM gateway、保存 replies，並可選擇透過 Discord relay responses。

同一個 runtime 也可以透過 CLI options 只將單一 plugin 帶上線，方便 focused development 與 testing。

## 運作方式

Plugins 由 `plugin.manifest.json` files 描述。Manifest 包含 metadata、startup method、runtime options、exact dependency versions、I/O examples，以及 capability declarations。System plugins 可以宣告 capabilities，例如 `system.discord.message.send`、`system.llm.remote.chat.stream` 或 `system.talk.engine.nostream`。

Startup 時，`src/core/pluginsManager` 會 discover plugins、validate manifests、check dependencies、start plugins，並 register capability providers。Capability provider 是實際替 capability id 執行 operation 的物件。Consumers 透過 `src/core/registry` lookup providers，而 schemas 與 capability definitions 位於 `src/core/capabilities`。

Runtime 使用 provider-first model。新的 system behavior 通常應透過 `getCapabilityBindings()` 暴露成 named provider methods，讓 callers 可以要求需要的 capability，而不必知道是哪個 plugin 實作它。

## 內建元件

- `talk-engine`：conversation orchestrator。它結合 system prompts、recent history、remote LLM calls、persistence，以及 optional Discord relay。
- `llm-remote-gateway`：remote-only gateway，用於 OpenAI-compatible `/v1/chat/completions`、`/v1/models` 與 health checks。
- `discord`：Discord input 與 output，包含 inbound conversation streams、message sending 與 typing control。
- `conversation-history`：依 conversation 與 user scope append、read、clear transcript history。
- `system-prompt-manager`：為 TalkEngine states 載入 file-backed system prompts。
- `example`：minimal system plugin fixture，用於 plugin patterns。

目前 skill plugin 區域包含 `src/skillPlugins/example`。

## 快速開始

安裝 dependencies：

```bash
yarn install
```

Build 專案：

```bash
yarn build
```

使用 OpenAI-compatible LLM endpoint 執行預設 conversation stack：

```bash
yarn start -- --llm-base-url http://localhost:8000 --llm-model local-model
```

本機開發時，不先 build 也可以執行：

```bash
yarn dev -- --llm-base-url http://localhost:8000 --llm-model local-model
```

只將單一 plugin 帶上線，而不是啟動完整 core stack：

```bash
yarn dev -- --plugin system:conversation-history --method local
```

執行 tests 與 linting：

```bash
yarn test
yarn lint
```

常用 focused test commands：

```bash
yarn test tests/secrets
yarn test tests/capabilities tests/registry
yarn test tests/pluginsManager
yarn test tests/systemPlugins
```

## 設定

Runtime configuration 可以來自 CLI flags 或 environment variables。最重要的設定包括：

- `--llm-base-url` 或 `LLM_REMOTE_BASE_URL`：預設 core startup path 必填。
- `--llm-model` 或 `LLM_REMOTE_MODEL`：傳給 remote LLM gateway 的 optional model name。
- `--talk-relay-enabled` 或 `TALK_RELAY_ENABLED`：控制 TalkEngine 是否透過 Discord relay responses。
- `--talk-relay-error-reply` 或 `TALK_RELAY_ERROR_REPLY`：relay processing failure 時的 optional fallback reply。

使用 `.env.example` 作為公開 configuration template。真實 secrets 放在 `.env`，不應提交。Plugin secret access 應透過 `src/core/secrets`。

## 專案結構

- `src/core`：runtime framework code。
- `src/core/pluginsManager`：plugin discovery、manifest validation、lifecycle orchestration、runtime status、startup reports 與 capability provider registration。
- `src/core/plugin-sdk`：manifest、lifecycle、options、capability 與 plugin implementation contracts。
- `src/core/capabilities`：capability definitions 與 schema validation。
- `src/core/registry`：runtime capability provider lookup。
- `src/core/secrets`：supported secret access boundary。
- `src/systemPlugins`：built-in system plugins。
- `src/skillPlugins`：skill plugin implementations 與 examples。
- `tests`：依 subsystem 組織的 Vitest tests。
- `docs`：正式文件與 reference material。
- `tools`：repository tooling，包含 UpdateLog 與 logger tools。
- `Updates`：release 與 change history。

Generated 或 local runtime outputs，例如 `dist`、`logs`、`history`、coverage output 與 `.env`，不應提交。

## 文件與 Releases

README files 是 human-facing project entrance。英文版與繁體中文版應描述相同的 project facts、commands 與 release version。

詳細 contributor 與 agent rules 請閱讀 `AGENTS.md`。多步驟 implementation plans 請閱讀 `.agent/PLANS.md` 與 `plans/active` 下的 active plans。Release history 請閱讀 `Updates/Main`，plugin-specific entries 則位於 `Updates/Plugins`。

當來源互相衝突時，優先相信 machine-readable root config，例如 `package.json`、`tsconfig.json`、`.editorconfig`、`.gitignore` 與 `eslint.config.js`；接著用正在修改 subsystem 的 source files 與 tests 驗證 behavior。
