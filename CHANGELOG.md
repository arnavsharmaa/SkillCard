# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- End-to-end smoke test suite (`npm test`) covering the loop, policy blocks, approvals,
  budget override, operator escalation, settlement, and reset.
- GitHub Actions CI: lint + build + test matrix on Node 22 / 24.
- Contributor docs: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue and PR
  templates, Dependabot.

### Changed
- Node >=22.13 is now required (Node 18 and 20 are end-of-life; current tooling and better-sqlite3 need 22+).

### Fixed
- `GET /api/run` now honors an explicit `delay=0`; it was previously treated as unset and
  defaulted to 900 ms.

## [0.3.0] — 2026-08-15

### Added
- **Persistence** — fleet and receipt state is written to disk and survives restarts.
- **Batch settlement** — charges accrue per purchase and settle to vendors in one run
  (`POST /api/settle`); vendor-payables panel on Receipts.
- **Spend anomaly detection** — vendor concentration, redundant purchases, and repeated
  overrides surfaced on the Fleet view.
- **Review inbox** — a finance queue of every flagged purchase with an acknowledge action
  (`POST /api/receipts/:id/acknowledge`).
- **Spend alerts** — receipts that need a human look are flagged automatically.
- Graceful server-unreachable state with auto-retry; React error boundary.

### Changed
- README rewritten as a product document (overview, architecture, API, roadmap).
- Demo-specific wording removed from the UI.

## [0.2.0] — 2026-07-31

### Added
- **Budget override** flow when every viable skill exceeds a robot's remaining budget.
- **Human approval** flow for purchases over the auto-approve ceiling, with an inline
  marketplace picker to choose a different skill.
- **Marketplace** view with per-robot compatibility filtering and full skill spec sheets.
- Security policy rules: unverified-vendor and unrestricted-permission hard blocks.
- Receipts: filter by robot, CSV export, spend-by-category breakdown.
- Fleet: governance rollup and cumulative-savings trend.
- Live model status pill and per-stage reasoning latency.
- Keyboard shortcuts for run / reset / view switching.

### Fixed
- Reset during an in-flight run no longer re-applies that run's spend (generation guard).
- Savings counter no longer freezes mid-tick or leaves a stale delta chip on reset.

## [0.1.0] — 2026-07-18

### Added
- Initial release: the eight-stage loop (attempt → diagnose → shop → reason → policy →
  purchase → retry → receipt) streamed over SSE, with a deterministic policy engine,
  two strict-JSON model calls with deterministic fallbacks, human-operator escalation,
  and the Live Run / Receipts / Fleet views.

[Unreleased]: https://github.com/arnavsharmaa/SkillCard/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/arnavsharmaa/SkillCard/releases/tag/v0.3.0
[0.2.0]: https://github.com/arnavsharmaa/SkillCard/releases/tag/v0.2.0
[0.1.0]: https://github.com/arnavsharmaa/SkillCard/releases/tag/v0.1.0
