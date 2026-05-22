# Demonkernel

Current release: <!-- DEMONKERNEL_VERSION:start -->v0.18.2<!-- DEMONKERNEL_VERSION:end -->

Language: English | [繁體中文](README.zh-TW.md)

Demonkernel is a TypeScript runtime for building plugin-based AI conversation systems. It is designed to start a small set of cooperating system plugins, connect them through explicit capabilities, and run a conversation loop that can combine Discord I/O, conversation history, file-backed system prompts, and an OpenAI-compatible remote LLM endpoint.

The project is useful when you want a local Node.js kernel that can be extended by plugins instead of a single hard-coded bot script. Each plugin declares what it is, how it starts, what it depends on, and which capabilities it provides. The runtime validates those declarations, brings plugins online in dependency-aware order, and gives other parts of the system a registry for finding the provider that can perform a named operation.

## What It Runs

The default startup path launches a conversation stack:

1. `llm-remote-gateway` connects to an OpenAI-compatible remote LLM service.
2. `discord` connects Discord inbound messages, outbound replies, and typing status.
3. `conversation-history` stores scoped transcript history.
4. `system-prompt-manager` loads prompts from files for TalkEngine states.
5. `talk-engine` composes prompts, reads history, calls the LLM gateway, persists replies, and can relay responses back through Discord.

The same runtime can also bring a single plugin online through CLI options, which is useful for focused development and testing.

## How It Works

Plugins are described by `plugin.manifest.json` files. A manifest includes metadata, startup method, runtime options, exact dependency versions, I/O examples, and capability declarations. System plugins can declare capabilities such as `system.discord.message.send`, `system.llm.remote.chat.stream`, or `system.talk.engine.nostream`.

At startup, `src/core/pluginsManager` discovers plugins, validates manifests, checks dependencies, starts plugins, and registers capability providers. A capability provider is the concrete object that performs an operation for a capability id. Consumers look providers up through `src/core/registry`, while schemas and capability definitions live under `src/core/capabilities`.

The runtime uses a provider-first model. New system behavior should normally be exposed as named provider methods through `getCapabilityBindings()`, so callers can request the capability they need without knowing which plugin implements it.

## Built-In Components

- `talk-engine`: the conversation orchestrator. It combines system prompts, recent history, remote LLM calls, persistence, and optional Discord relay.
- `llm-remote-gateway`: a remote-only gateway for OpenAI-compatible `/v1/chat/completions`, `/v1/models`, and health checks.
- `discord`: Discord input and output, including inbound conversation streams, message sending, and typing control.
- `conversation-history`: append, read, and clear transcript history scoped by conversation and user.
- `system-prompt-manager`: loads file-backed system prompts for TalkEngine states.
- `example`: a minimal system plugin fixture for plugin patterns.

The current skill plugin area contains `src/skillPlugins/example`.

## Quick Start

Install dependencies:

```bash
yarn install
```

Build the project:

```bash
yarn build
```

Run the default conversation stack with an OpenAI-compatible LLM endpoint:

```bash
yarn start -- --llm-base-url http://localhost:8000 --llm-model local-model
```

For local development without building first:

```bash
yarn dev -- --llm-base-url http://localhost:8000 --llm-model local-model
```

Bring a single plugin online instead of the full core stack:

```bash
yarn dev -- --plugin system:conversation-history --method local
```

Run tests and linting:

```bash
yarn test
yarn lint
```

Useful focused test commands:

```bash
yarn test tests/secrets
yarn test tests/capabilities tests/registry
yarn test tests/pluginsManager
yarn test tests/systemPlugins
```

## Configuration

Runtime configuration can come from CLI flags or environment variables. The most important settings are:

- `--llm-base-url` or `LLM_REMOTE_BASE_URL`: required for the default core startup path.
- `--llm-model` or `LLM_REMOTE_MODEL`: optional model name passed to the remote LLM gateway.
- `--talk-relay-enabled` or `TALK_RELAY_ENABLED`: controls whether TalkEngine relays responses through Discord.
- `--talk-relay-error-reply` or `TALK_RELAY_ERROR_REPLY`: optional fallback reply when relay processing fails.

Use `.env.example` as the public configuration template. Real secrets belong in `.env`, which should not be committed. Plugin secret access should go through `src/core/secrets`.

## Project Structure

- `src/core`: runtime framework code.
- `src/core/pluginsManager`: plugin discovery, manifest validation, lifecycle orchestration, runtime status, startup reports, and capability provider registration.
- `src/core/plugin-sdk`: manifest, lifecycle, options, capability, and plugin implementation contracts.
- `src/core/capabilities`: capability definitions and schema validation.
- `src/core/registry`: runtime capability provider lookup.
- `src/core/secrets`: supported secret access boundary.
- `src/systemPlugins`: built-in system plugins.
- `src/skillPlugins`: skill plugin implementations and examples.
- `tests`: Vitest tests organized by subsystem.
- `docs`: formal documentation and reference material.
- `tools`: repository tooling, including UpdateLog and logger tools.
- `Updates`: release and change history.

Generated or local runtime outputs such as `dist`, `logs`, `history`, coverage output, and `.env` should stay out of commits.

## Documentation And Releases

The README files are the human-facing project entrance. The English and Traditional Chinese versions should describe the same project facts, commands, and release version.

For detailed contributor and agent rules, read `AGENTS.md`. For multi-step implementation plans, read `.agent/PLANS.md` and active plans under `plans/active`. For release history, read `Updates/Main` and plugin-specific entries under `Updates/Plugins`.

When sources disagree, prefer machine-readable root config such as `package.json`, `tsconfig.json`, `.editorconfig`, `.gitignore`, and `eslint.config.js`; then verify behavior against the source files and tests for the subsystem being changed.
