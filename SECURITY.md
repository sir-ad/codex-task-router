# Security

The router sends data to TypeSafe only for ambiguous routes explicitly marked public and sanitized. The outbound request contains the task summary, abstract task attributes, and shortlisted skill names/descriptions. These flags are caller assertions, not data loss prevention. Inspect all fields before allowing a network call. Provider handling is governed by your TypeSafe agreement.

The key is read at runtime from `TYPESAFE_API_KEY` or a narrowly named macOS Keychain item. Never commit keys, private prompts, raw receipts, or credential-bearing logs. CI uses synthetic fixtures without secrets. JavaScript dependency injection is for trusted callers and tests.

Treat provider judgments and any returned model identifier as untrusted claims. The local policy validates available models and efforts and applies floors, but a route is a plan, not authorization or proof of execution. An agent must check the active dispatch tool immediately before spawning a worker and verify the completed task. A custom transport that ignores abort may continue its own work after the router returns.

Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/sir-ad/codex-task-router/security/advisories/new) with a minimal synthetic reproduction. Do not submit credentials or private task data. Use issues for ordinary non-sensitive defects.
