---
name: codex-task-router
description: Route substantial Codex work to available GPT models and the smallest relevant skill set, using TypeSafe for ambiguous choices. Apply at the start of a new task or material scope change. Simple requests use a local fast path. Selects thinking effort independently, coordinates bounded subagents, and verifies their results.
---

# Codex task router

Optimize completed, verified work per unit of time and model usage. A route is a decision; only an actual tool invocation and checked result establish execution. Preserve the user's explicit model, skills, scope, and permissions.

## Triage before spending

At the first prompt and after a material scope change, identify the deliverable, uncertainty, consequence of error, and acceptance check. Keep this brief and internal unless a routing decision matters to the user.

- Answer tiny, clear requests directly. No router command, TypeSafe call, or subagent is needed for a rewrite, fact already in context, one obvious edit, or a status update.
- Continue the existing route on follow-ups. Reconsider after new requirements, new evidence, or a failed verification; avoid repeated classification of the same task.
- Read explicitly named skills. Otherwise shortlist by the actual deliverable using the skill metadata already in the session. Prefer a specific capability over a broad umbrella. Start with one primary skill and at most two supporting skills; this is a target, not a cap on explicit user requests or genuinely distinct deliverables. If no skill fits, use ordinary judgment.
- Verify candidates against the available skill catalog. Read selected SKILL.md files before work; do not preload their references. Review any plausible omitted candidate locally: TypeSafe cannot choose an omitted skill.

## Choose a route

Use the model list and supported efforts exposed by the **active dispatch tool**. `scripts/catalog.mjs` can inspect the local Codex model cache without exposing identity data, but a cache entry does not establish that a tool can call the model. Never silently substitute for an explicit unavailable model.

| Work | Starting worker model | Starting effort |
| --- | --- | --- |
| Focused extraction, repeatable collection, narrow edits with clear checks | GPT-6 Luna | high |
| Implementation, debugging, research synthesis, polished deliverables | GPT-6 Sol | medium |
| Hard architecture, unresolved diagnosis, interacting constraints, consequential judgment | GPT-6 Astra | low; high when deeper analysis is needed |

These are initial policies based on official guidance, not benchmark guarantees. Raise effort or capability because of task difficulty or failed verification, not length alone. Max/Ultra are exceptional choices. See [model evidence](references/model-evidence.md) when changing the policy or resolving availability. Check live docs before choosing a newly introduced model; keep unavailable names out of dispatches.

For a clear route, apply this table locally. When model fit, skills, or useful decomposition remain ambiguous, use **one** TypeSafe call through `scripts/route.mjs` (Node 22+). The contract and a complete example are in [routing contract](references/routing-contract.md). Use standard input from this skill directory, never a raw prompt argument.

Create a short generic task summary locally. Remove personal names, employer/customer identifiers, paths, source code, account data, private document details, URLs, credentials, and transcript content. Only describe the operation and constraints. Similarly abstract candidate descriptions. Set `privacy: public` and `sanitized: true` only after inspecting this exact outbound content. For a task that cannot be usefully abstracted, use local routing with an empty summary and `privacy: private`. A regex is not proof of sanitization.

## Decide thinking effort

Choose model capability and reasoning depth separately. Assess `reasoningDemand`
as `light`, `standard`, `deep`, `exceptional`, or `unknown`. Use dependency depth,
uncertainty, interacting constraints and required verification; output length alone
is not evidence of reasoning difficulty. For an ambiguous task, Jev judges tier,
reasoning demand, skill relevance and useful parallelism together in one request.
Code maps the demand to the chosen model:

| Assessed demand | Luna | Sol | Astra |
| --- | --- | --- | --- |
| Light, direct checks | high | low | low |
| Standard, several known steps | high | medium | low |
| Deep, subtle dependencies or consequential checks | high | high | high |
| Exceptional, many coupled unresolved constraints | Prefer Astra | Prefer Astra | xhigh |

Hard work and critical risk impose a frontier capability floor. Elevated risk or
one failed attempt imposes at least standard capability and deep reasoning. Two
failed attempts impose frontier plus exceptional reasoning; diagnose the failure
before a single bounded escalation, rather than repeating the same call.

Explicit model/effort choices take precedence. Preserve a lower explicit effort
and expose `explicitEffortBelowPolicy` with review requirements. Unsupported exact
choices block worker dispatch. Automatic effort selection chooses the least
supported level meeting the policy, capped at `xhigh`; Max and Ultra require an
explicit user choice. Ultra can invoke additional runtime parallelism, so it is
not an automatic substitute for a larger thinking budget.

These are conservative starting rules, not calibrated task-success guarantees.
Unknown model IDs are used only when explicitly selected and exposed by the tool,
with capability uncertainty recorded. Review official docs before adding a new
model to automatic routing. `requestedEffort` uses API/tool values: Light is `low`
and Extra High is `xhigh`.

The helper reads `TYPESAFE_API_KEY` or the existing macOS Keychain item (account `typesafe-ai`, service `typesafe_api_key`) in memory. For uncertain public tasks it can send independent Choices for capability tier, reasoning demand, and an available browser workflow, plus Noul judgments for proposed work units, useful parallelism, and optional skills. Work-unit IDs and dependency edges are proposed by the coordinator; Jev may recommend inclusion but cannot invent missing tasks. Required units and their dependency closure always remain. No candidate means local routing. It makes no browser actions or model dispatches. No credential belongs in files, stdout, prompts, arguments, or receipts.

Respect local policy floors and explicit choices. An uncertain, invalid, missing-key, or timed-out answer falls back to coordinator judgment; continue the task. The probability thresholds are provisional abstention rules, not calibrated success probabilities. Resolve `skillCandidatesForLocalReview` locally. No retry loop, and no external call merely to reconfirm a clear choice.

## Execute the route

This skill explicitly requests **bounded subagent delegation when independent work and useful coordinator work can proceed together**. Use a maximum of two concurrent workers, with one heavy local build/browser/install at a time. Do not delegate tiny work, duplicate the coordinator's work, or invent a parallel split for sequential dependencies.

For useful delegated work, call the available collaboration tool with the selected supported `model` and `reasoning_effort`. Copy the verified `dispatch.model` and `dispatch.reasoning_effort` into the actual tool call. Recheck both against that tool immediately before dispatch. With `collaboration.spawn_agent`, use `fork_turns: none` and supply a compact packet. A full-history fork inherits the parent configuration and adds unnecessary context. Other tool schemas may differ; inspect their actual parameters. Workers must execute their packet and must not recursively invoke this router or spawn more workers.

The packet contains the concrete goal, authorized files/resources, selected skill paths, minimum evidence, constraints, acceptance check, and a short result target (about 700 tokens plus file links). Give workers separate file ownership or keep them read-only. The primary keeps requirements, consequential choices, integration, and final communication.

If model-selectable collaboration is unavailable, continue in the primary and state the limitation when material. Do not create sidebar tasks without a user request. Do not quietly launch a CLI worker or alter global model settings to simulate a successful dispatch. A skill cannot change the model already generating the current reply; the composer controls that model. Worker recommendations and current-task model changes are different operations. This skill cannot silently change the current primary model or its thinking effort; expose any such recommendation accurately. An emitted dispatch object is still an unexecuted plan.

## Verify and learn from evidence

Check the returned artifact or source and run the task's meaningful acceptance checks. A worker saying “done” is not a check. Use independent review for critical correctness risks; it may be a separate bounded pass after implementation. Ordinary low-impact edits need a direct inspection, not an automatic test suite or review swarm.

On a failed check, diagnose the cause and make one focused correction or capability escalation. Stop repeated attempts without new evidence; preserve progress and explain a real blocker. A worker failure is not permission to change the user's explicit model choice.

For delegated or TypeSafe-routed substantial work, keep a small receipt in the task's `work/router/` directory: route source, requested model/effort, actual tool and agent ID, returned provider/model evidence if available, selected/read skills, result paths, verification, latency, and observed usage. Leave unavailable metrics null. Record TypeSafe usage separately from worker usage. Do not save raw prompts, private summaries, secrets, or full histories.

The helper's `executionReceipt` begins unexecuted. Fill it from observed tool results; never relabel it as successful because a plan exists. Retain the route in task context rather than paying for another classification. Use repeated matched task outcomes to change routing policy; never claim token savings, greater accuracy, or continuous improvement from a routing score alone. Task receipts do not authorize global memory updates.

## Maintain and verify

Policy version 2.1.0 adds bounded work-unit selection and optional selection among
caller-listed browser capabilities. Jev cannot create a capability, use a browser,
authorize an action, remove required work, or control the active parent model.
Private, unsanitized, clear, and tiny tasks stay local. Browser candidate descriptions
must be generic and must not expose page text, URL, profile, account state, or project
details. A private browser task bypasses Jev; the coordinator uses available native
tools based on local policy. A browser recommendation is provisional and checked
against actual available tools before use.

Policy version 2.0.0 added independent reasoning-demand selection and exact dispatch
arguments. Clear/tiny/private tasks can route without service or credential access.
Use the documented stdin schema; never pass a raw prompt or secret as an argument.
Provider responses are streamed with a 64 KB cap, stdin with a 16 KB cap, and a
single deadline covers response-body reads. API/credential failure falls back to
the primary without a retry loop. Locally selected skills survive model disagreement
and are listed for review; explicit required skills always remain selected.

Run `node scripts/route.test.mjs` after changes. Read
[release checks](references/release-checks.md) for the release procedure, rollback,
and measured limits. Read [routing contract](references/routing-contract.md) for
exact inputs/outputs. When an appropriate public browser skill is installed, consider it for public scanning.
For private or interactive browser tasks, use the host's native browser tools.
