# Router release checks

Version 2.0.0, 2026-09-23.

## Release gate

1. Stage a complete copy; keep the installed version intact until checks pass.
2. Run `node --test scripts/route.test.mjs` and the skill validator.
3. Check the active dispatch tool model and effort catalog. Cache membership is
   advisory. Do not add unknown models to automatic policy without current docs.
4. Use a few inspected public synthetic summaries for bounded live TypeSafe
   checks; record actual model, usage, uncertainty and policy overrides.
5. Perform a bounded real worker dispatch for useful independent work, using the
   exact selected effort. Record unavailable provider attestation/usage as null.
6. Install by replacing the staged directory; preserve a rollback copy. Confirm
   the installed file hashes match the staged release and global routing points
   to it. Do not overwrite unrelated global instructions.

## Acceptance scope

This release establishes input/response validation, timeout and failure behavior,
model/effort compatibility, explicit overrides, local fallbacks and live service
compatibility. It does not establish calibrated semantic accuracy, total-token
savings, speed improvements or guaranteed task success. Maintain task-specific
acceptance checks after dispatch. Skill instructions are not a pre-inference hook
and cannot change the primary model or thinking effort mid-response.

## Rollback

Keep the previous directory in a user-chosen backup location outside the skill. To roll back,
copy it to a sibling staging directory under `~/.codex/skills`, move the installed
router aside, and rename the staged copy into `codex-task-router`. Check hashes
before removing any backup. No service, cron, MCP server, or background process
is installed by this router.

## Evaluate improvements

Use paired tasks with the same acceptance criteria and evidence, retaining failed
attempts. Measure correctness, source coverage, total coordinator/worker/router
usage, wall time, retries and review burden. Keep a held-out task set; threshold
changes and routing explanations alone are not measured improvement. Retain a
route across unchanged follow-ups and call Jev again only for a material change.
