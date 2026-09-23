# Codex Task Router

[![CI](https://github.com/sir-ad/codex-task-router/actions/workflows/ci.yml/badge.svg)](https://github.com/sir-ad/codex-task-router/actions/workflows/ci.yml)

A Codex skill and dependency-free Node.js helper for planning the model, thinking effort, skills, and bounded worker use for a task. Clear tasks route locally. Ambiguous tasks can ask [TypeSafe Jev](https://docs.typesafe.ai/api) for typed judgments, then apply explicit policy checks in code.

The helper returns a **plan**. The agent checks the active tool catalog, dispatches any worker, and verifies the task result. Running the helper does not change the model of the current conversation.

## Install globally

Requires Git and Node.js 22 or newer. A supported [Node.js LTS release](https://nodejs.org/en/about/previous-releases) is recommended for production.

```sh
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
git clone --branch v2.0.0 --depth 1 \
  https://github.com/sir-ad/codex-task-router.git \
  "${CODEX_HOME:-$HOME/.codex}/skills/codex-task-router"
```

The destination must not already exist. Back up an older installation before replacing it, then restart Codex so it discovers the skill. Invoke `$codex-task-router` for a task or let Codex select it when relevant. This package does not require another custom skill. Optional browser skills can be selected only when installed and appropriate.

## Try it

From the repository or installed skill directory:

```sh
node scripts/route.mjs --help
node scripts/route.mjs < examples/local-route.json
node scripts/route.mjs < examples/private-route.json
node scripts/catalog.mjs
```

The examples use no TypeSafe key and make no network call. `catalog.mjs` reads an optional local Codex cache. Its entries are advisory; supply `availableModels` and supported efforts from the **active dispatch tool** before any real worker selection.

For a genuinely ambiguous public task, set `uncertain: true`, `privacy: "public"`, and `sanitized: true` only after reviewing the entire outbound summary and skill descriptions. Supply `TYPESAFE_API_KEY` at runtime. On macOS, the helper can use an existing generic Keychain password with account `typesafe-ai` and service `typesafe_api_key`. TypeSafe is optional: no key is needed for clear, tiny, private, or unsanitized routes. Provider API use may incur charges.

The input and output fields are documented in [the routing contract](references/routing-contract.md). A JavaScript caller can import `route` from `scripts/route.mjs`. `status: planned` still means no worker has run; inspect `dispatch`, recheck tool support, then record and verify actual execution.

## Routing policy

| Task shape | Starting worker model | Starting effort |
| --- | --- | --- |
| Clear, repeatable work | GPT-6 Luna | High |
| Implementation and synthesis | GPT-6 Sol | Medium |
| Hard, coupled work | GPT-6 Astra | Light, increased when needed |

These defaults follow current [OpenAI model guidance](https://learn.chatgpt.com/docs/models); actual availability depends on the account and tool. The router keeps model capability and reasoning demand separate. It preserves explicit user choices, blocks an unsupported exact model or effort, and makes review requirements visible when an explicit choice is below its policy floor. Max and Ultra require an explicit request.

Jev receives one set of Choice and Noul questions to assess tier, reasoning demand, optional skill relevance, and useful parallelism. The caller supplies a shortlist; an omitted skill cannot be chosen. If Jev is unavailable or uncertain, policy falls back to local judgment. Numeric thresholds are provisional and need evaluation on representative tasks.

## Data and execution boundaries

When used, TypeSafe receives the manually sanitized task summary, public skill names/descriptions, and abstract task attributes. It does not receive the entire conversation, private code, account data, or credentials. A regex is only a secondary check: the caller must inspect outbound text. The fixed TypeSafe endpoint is `https://api.typesafe.ai/v1/systemone`; the provider reports the serving model and token usage.

The helper makes at most one provider request per invocation with no retries. Input is capped at 16 KB, response at 64 KB, and the HTTP deadline includes body reads. macOS Keychain lookup is separately bounded to three seconds. It stores no cache or log. Aggregate spending, concurrency, worker tokens, and task verification remain the agent's responsibility. See [SECURITY.md](SECURITY.md).

The helper does not prove task quality, token savings, or faster completion. Compare accepted outcomes and total coordinator, worker, provider, and verification usage on matched tasks before changing policy. See [model and source evidence](references/model-evidence.md).

## Development

```sh
npm test
npm run check
npm pack --dry-run
```

CI runs offline on Node.js 22 and 24 across Linux, macOS, and Windows. See [CONTRIBUTING.md](CONTRIBUTING.md). Released under [MIT](LICENSE). Independent community project; not affiliated with or endorsed by TypeSafe or OpenAI.
