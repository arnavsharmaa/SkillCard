# Architecture Decision Records

Short records of the decisions that shaped SkillCard, so future changes are argued
against the original reasoning rather than guesswork. Newest last.

---

## ADR-001 — The model proposes; deterministic policy disposes

**Status:** accepted

**Context.** The purchase loop uses an LLM to diagnose failures and articulate
trade-offs. LLM output is nondeterministic and prompt-injectable; money movement must be
neither.

**Decision.** No model output ever authorizes spend. The policy engine
(`applyPolicy` in `server/loop.js`) is plain code evaluating explicit rules — category
blocks, hardware, vendor verification, permission scoping, certifications, ceiling,
budget. The model's JSON is treated as untrusted narration: its chosen skill id is
overridden by the deterministic highest-expected-value pick, and everything it returns is
validated before display.

**Consequences.** Governance behavior is unit-testable (`test/policy.test.js`), auditable,
and identical with or without an API key. The model can be swapped or removed without
touching the rules that control money.

---

## ADR-002 — Deterministic skill choice; the model only explains it

**Status:** accepted

**Context.** Early versions let the model pick the skill. A capable model would
"helpfully" route around options it predicted policy would block, which made governance
paths untestable and runs non-reproducible.

**Decision.** The server computes the choice as pure expected value
(`success_rate × task_value − price`); the REASON call receives the already-made choice
and writes the justification and per-alternative rejections.

**Consequences.** Runs are reproducible; policy paths (blocks, flags, overrides) trigger
deterministically; the model's contribution is legible prose, not hidden control flow.

---

## ADR-003 — Every model call degrades to a deterministic fallback

**Status:** accepted

**Context.** The loop must never hang, crash, or surface a raw error — including with no
API key, no network, or a malformed model response.

**Decision.** Both calls use strict-JSON output, shape-validate the result, and fall back
to realistic canned reasoning (`server/fallbacks.js`) on any failure. Fallbacks are logged
server-side only; the UI shows which source produced each stage. `RUN_STUBBED=1` forces
the fallback path — CI and the test suite run entirely on it.

**Consequences.** The full loop is exercisable offline and in CI without secrets; a model
outage degrades the prose, never the product.

---

## ADR-004 — SSE for the run stream, not WebSockets

**Status:** accepted

**Context.** The run loop streams eight stages to the UI as they happen. Traffic is
strictly server→client; the client's only upstream messages are ordinary POSTs
(approve / override / operator).

**Decision.** Server-Sent Events via `EventSource`, one stream per run.

**Consequences.** No connection lifecycle to manage, automatic reconnection semantics,
plain HTTP that works through proxies. If bidirectional needs appear (e.g. live operator
control), revisit with WebSockets for that surface only.

---

## ADR-005 — SQLite via write-through, keeping in-memory state authoritative

**Status:** accepted

**Context.** State began as an in-memory object (hackathon heritage), then needed to
survive restarts. A full ORM/repository rewrite would have rewritten every handler.

**Decision.** The in-memory object remains the working set; every mutation calls
`persist()`, which writes the durable slice to SQLite (`better-sqlite3`, WAL) in one
transaction. Boot rehydrates from the database. Transient decision context
(`pendingApprovals`, `pendingEscalations`) is deliberately not persisted — a restart
should drop half-finished approvals rather than resume them ambiguously.

**Consequences.** Handlers stayed simple and synchronous; restart persistence is tested
end-to-end. The single-writer model is a known limit — multi-instance deployment would
move reads/writes fully into the database (see README roadmap).

---

## ADR-006 — Specs and docs are enforced, not aspirational

**Status:** accepted

**Context.** API docs and changelogs rot silently.

**Decision.** `docs/openapi.yaml` is guarded by a test that derives the implemented
routes from server source and fails on drift in either direction, and pins the spec
version to `package.json`. Releases are generated from the CHANGELOG section for the tag
(`scripts/release-notes.mjs`), so an empty changelog entry produces an empty release —
visibly wrong at publish time.

**Consequences.** Adding an endpoint without documenting it breaks CI; cutting a release
without changelog discipline is self-evident on the Releases page.
