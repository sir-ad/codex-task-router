# Router input and output

From the skill directory, run `node scripts/route.mjs` with a JSON object on stdin. Construct it from current task facts and the active collaboration tool's model list. Do not pass a key, endpoint, raw conversation, arbitrary code, or paths. Unknown fields are rejected.

```json
{
  "summary": "Implement an accessible settings form and review its validation behavior.",
  "sanitized": true,
  "privacy": "public",
  "size": "bounded",
  "complexity": "standard",
  "reasoningDemand": "standard",
  "risk": "low",
  "uncertain": true,
  "independentUnits": 1,
  "allowDelegation": true,
  "failedAttempts": 0,
  "availableModels": [
    {"id":"gpt-6-luna","efforts":["low","medium","high","xhigh","max"]},
    {"id":"gpt-6-sol","efforts":["low","medium","high","xhigh","max","ultra"]},
    {"id":"gpt-6-astra","efforts":["low","medium","high","xhigh","max","ultra"]}
  ],
  "currentModel": "gpt-6-sol",
  "skills": [
    {"id":"frontend-engineering","description":"Implement accessible React forms and frontend state.","selected":true},
    {"id":"spreadsheets","description":"Create and analyze spreadsheet workbooks."}
  ]
}
```

The example model list is illustrative: replace it with the **current active tool list**. Skill IDs must also match this session's actual catalog (including plugin prefixes when present). Mark user-named skills `required: true`; the helper retains all of them. `selected: true` records a locally justified selection, preserved even on model disagreement; disagreement adds it to local review. A maximum of eight shortlisted skills keeps the request bounded. Required skills skip redundant TypeSafe questions.

Fields:

- `summary`: at most 600 characters, generic and manually sanitized. Use empty for private/local routing. `privacy` defaults to private; `sanitized` defaults to false.
- `size`: tiny/bounded/large; `complexity`: routine/standard/hard/unknown; `risk`: low/elevated/critical. These come from the coordinator's local assessment. Hard complexity, exceptional reasoning demand, critical risk and two failures impose a frontier floor; elevated risk and one failure impose at least standard.
- `reasoningDemand`: light/standard/deep/exceptional/unknown (default unknown). The independent TypeSafe Choice assesses depth; local risk and difficulty impose minimums. Two failures imply exceptional reasoning. Mapping: Luna high for ordinary work; Sol low/medium/high for light/standard/deep; Astra low for light/standard and high for deep. Exceptional demand selects frontier xhigh. Automatic effort never exceeds xhigh.
- `uncertain`: false avoids TypeSafe for a clear decision. Tiny low-risk tasks also avoid the service and credential access.
- `independentUnits`: zero through three actual independent work units for which the coordinator can also make progress. `allowDelegation` must reflect both authorization and callable tools. Output caps concurrency at two; it does not authorize recursive delegation.
- The parallel Noul governs increasing concurrency from one worker to two. One worker requires a locally established independent unit and useful coordinator work. An uncertain model-tier decision always stays with the primary until locally resolved.
- `requestedModel` / `requestedEffort`: copy explicit user choices exactly. Unsupported values block dispatch and produce a reason; do not silently substitute. A user's pinned lower model or effort is preserved with `explicitModelBelowPolicy` / `explicitEffortBelowPolicy` and suitable verification. Effort is null if the exact requested combination is unsupported; no substitute is dispatched.
- `timeoutMs`: 100–8000, default 3500; one HTTP request, no retries or redirects. Keychain lookup has its own three-second timeout. No external call occurs for private or unsanitized input.

Output includes `recommendedModel`, `reasoningEffort`, `reasoningDecision` (demand, floor, source, uncertainty and override), `dispatch` (exact model, reasoning_effort and fork_turns, or null), skill IDs, ambiguous candidates to inspect locally, execution mode, concurrency, verification requirements, TypeSafe status/answers/model/latency/usage, and an empty execution receipt. There is no dispatch in this script. The coordinator executes a returned plan only after checking current task constraints and the available tool schema. A recommended model/effort may differ from the primary even when execution remains in the primary; report that accurately. `currentModelChanged` and `currentThinkingEffortChanged` are always false. Recheck dispatch arguments against the live tool catalog before use. Unknown models are not automatically assigned capability tiers; explicit exposed unknown models remain usable with a review flag.

Thresholds are conservative initial heuristics: Both tier and reasoning Choice confidence at least 0.65 and winning probability at least 0.75; optional skills at least 0.8; parallel usefulness at least 0.8. Noul has no separate confidence. Skills between 0.2 and 0.8 go to local review. These cutoffs need representative labeled tasks before being described as calibrated. All raw typed judgments are returned, so local policy can be inspected separately from model behavior.

The helper writes no cache or log. Retain a route in task context and record a compact receipt only when useful. Its JSON deliberately contains no summary, credential, or skill description. Latency and usage describe the router call alone. Total task metrics must include coordinator, workers, tool work, retries, verification, and TypeSafe.


## Failure and size limits

Node 22+; no npm dependencies. Standard input is streamed and rejected above
16,000 bytes before parsing. HTTPS redirects are rejected. HTTP response bodies
are streamed and rejected above 65,536 bytes before parsing. The deadline includes
fetch and body reads. A malformed answer invalidates the single result and returns
local fallback; no provider error body or raw input is reflected in output.
Credential lookup has a separate three-second bound. The helper does not expose
an OpenAI key and does not change Codex configuration or model defaults.

Version 2 replaces the TypeSafe `deep` Noul with a `reasoning` Choice. Consumers
must read the policy-composed `reasoningEffort` and `dispatch`, not infer effort
from individual provider answers. Existing v1 input remains accepted. Request/response
contracts are tested with the current `jev-latest` endpoint; future model/catalog
changes require revalidation.
