# SkillCard

[![CI](https://github.com/arnavsharmaa/SkillCard/actions/workflows/ci.yml/badge.svg)](https://github.com/arnavsharmaa/SkillCard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](.nvmrc)
[![Contributing](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Governed spending for autonomous machines.**

SkillCard is a spend-governance platform for autonomous machines and agents. When a robot
hits a task it can't complete, it can acquire the missing capability from a marketplace of
purchasable skills — but every purchase runs through a deterministic **policy engine** the
business controls: spending limits, approved vendors, permission scoping, certification
requirements, human-approval thresholds, and budget overrides. Every purchase produces an
auditable receipt tying the money spent to the outcome it bought.

**The robot proposes; policy disposes; the business keeps ownership and liability.** A
robot never owns the card or makes unrestricted decisions — it operates under delegated
purchasing authority within limits a human defines.

The autonomous-machine side is driven by a deterministic **simulation harness** (seeded
telemetry and outcomes), so the full loop can be exercised without physical hardware.
SkillCard itself is the financial-governance layer, not the robotics.

---

## Why

As machines and agents begin making operational decisions, they need the same financial
guardrails employees already have — cards with limits, approval workflows, receipts, and
an audit trail. SkillCard is that layer for autonomous work: it lets a machine resolve an
exception on its own **without** handing it unchecked spending power.

---

## How it works

Running a task streams eight stages to the UI over Server-Sent Events:

| # | Stage | What happens |
|---|-----------|--------------|
| 1 | ATTEMPT | Robot tries the task and fails deterministically. Telemetry (grasp force, depth confidence, retries, error code). |
| 2 | DIAGNOSE | **AI call** → plain-language explanation of *why* it failed. |
| 3 | SHOP | Filter the marketplace to skills that provide the missing capability. |
| 4 | REASON | **AI call** → picks the best skill on expected value, with a reason every alternative lost. |
| 5 | POLICY | **Deterministic engine.** Auto-approve, flag for human approval, hard-block, or require a budget override. On a block it falls back to the next-best candidate. |
| 6 | PURCHASE | Charge the robot's card, install the capability, record the transaction. |
| 7 | RETRY | Task succeeds (or escalates to a human operator). |
| 8 | RECEIPT | Emit an itemized, auditable receipt. |

The agent optimizes pure expected value (`success_rate × task_value − price`); the
deterministic policy engine is what actually authorizes or blocks the spend.

### Governance model

All governance is deterministic code, not the model:

- **Auto-approve ceiling** — purchases under the per-transaction limit clear automatically; over it, they're flagged for human approval.
- **Blocked categories** — e.g. a fully autonomous unit blocks human teleop.
- **Required certifications** — e.g. SOC2.
- **Vendor verification** — skills from unverified vendors are hard-blocked.
- **Permission scoping** — a skill demanding *unrestricted* camera/motion access is hard-blocked.
- **Hardware compatibility** — skills needing hardware the robot lacks are rejected.
- **Budget override** — when every viable skill exceeds a robot's remaining budget, the run pauses for an explicit human override (logged and flagged for finance).
- **Human-in-the-loop escalation** — if a purchased skill underperforms, the robot escalates to an approved, time-boxed human operator; the operator charge is attached to the same task record.

The marketplace shows a **compatible / needs-approval / blocked** badge on every candidate,
and every receipt that needs a human look (override, escalation, over-ceiling approval,
high cost-to-value) is automatically **flagged for review**.

---

## Features

- **Live Run** — the eight-stage loop with a streaming timeline and a running savings counter; the task queue marks which tasks are resolved and what each saved.
- **Marketplace** — every purchasable skill with price, success rate, vendor verification, and requested permissions; filter by capability or by **which robot can run it**; open any skill for a full spec sheet.
- **Receipts** — an auditable receipt per purchase; filter by robot, **export to CSV**, a spend-by-accounting-category breakdown, and **vendor payables with one-run batch settlement**. Receipts needing attention are flagged for review.
- **Review** — a finance inbox that queues every flagged purchase (override, escalation, over-ceiling approval, high cost-to-value) for a human to acknowledge, with a live pending count.
- **Fleet** — per-robot budgets, policies, and installed capabilities; a fleet-wide governance rollup, a cumulative-savings trend, and **cross-receipt spend-anomaly detection** (vendor concentration, redundant spend, repeated overrides).
- **Persistence** — fleet and receipt state lives in a local SQLite database and survives restarts.
- **Live model status** — a header pill and per-stage latency show whether reasoning ran on the live model or the deterministic fallback.
- **Keyboard shortcuts** — `Enter` runs, `R` resets, `1`–`5` switch views.

---

## Reasoning (AI)

Two calls (model name is a single constant, `MODEL` in [`server/openai.js`](server/openai.js)),
both using strict JSON output and each wrapped in `try/catch` with a deterministic,
realistic fallback so on-screen reasoning never fails visibly (fallbacks are logged
server-side only). The app runs the full loop with or without an API key.

- **DIAGNOSE** — input: task, the robot's installed capabilities, and the failure telemetry. Output: `{ diagnosis, missing_capability, confidence }`.
- **REASON** — input: the diagnosis, the candidate skills (price, success rate, hardware, certs, category), the task value, the human baseline, and the robot policy. The model articulates the highest-expected-value choice and why each alternative lost; it does **not** enforce policy. Output: `{ justification, rejected: [{ skill_id, reason }] }`.

The purchase *decision* is deterministic (highest expected value); the model's job is to
explain it. Set `OPENAI_API_KEY` in `.env` for live reasoning, or `RUN_STUBBED=1` to force
the deterministic path.

---

## Getting started

```bash
cp .env.example .env      # optional: paste an OPENAI_API_KEY (runs without one)
npm run install:all       # installs root + client deps
npm run dev               # API on :3001, client on :5173
```

Open **http://localhost:5173**. State persists to a local SQLite database (`server/skillcard.db`, gitignored) and
survives restarts; the in-app **Reset** reseeds it. No external services, no auth.

### Development

```bash
npm test            # end-to-end smoke suite — stubbed reasoning, no key needed, ~1s
npm run build       # production client build to client/dist
```

CI runs both on every push and pull request across Node 22 and 24. See
[CONTRIBUTING.md](CONTRIBUTING.md) for conventions and the PR checklist.

---

## Architecture

A deeper walkthrough with diagrams lives in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
server/
  index.js       Express + SSE run stream + decision/settlement endpoints
  seed.js        Robots, tasks, and the skill marketplace
  loop.js        The stage loop, deterministic policy engine, escalation & override
  openai.js      The two model calls (strict JSON, try/catch)
  fallbacks.js   Deterministic diagnosis / reasoning / telemetry
  store.js       SQLite persistence (better-sqlite3, WAL)
client/src/
  App.jsx           Shell: savings counter, model status, tabs, connection retry
  views/            LiveRun · Marketplace · Receipts · Review · Fleet
  components/        StageTimeline, ReceiptCard, RobotCard, RobotAvatar, SavingsCounter,
                     ModelStatus, OperatorConsole, ApprovalModal, OverrideModal,
                     Sparkline, ErrorBoundary
  api.js            SSE client, decision calls, spend-alert & anomaly helpers, formatters
```

### API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | model name, whether a key is set, and the last reasoning source |
| `GET /api/state` | robots, tasks, marketplace, receipts, total saved |
| `GET /api/run/:taskId?robotId=&fail=1` | the loop, streamed stage-by-stage over SSE |
| `POST /api/approve/:receiptId` | approve a flagged (over-ceiling) purchase |
| `POST /api/skill-choice/:receiptId` | buy a different skill for a flagged purchase |
| `POST /api/override/:receiptId` | authorize an over-budget purchase |
| `POST /api/operator/:escalationId` | finalize an escalated task after a human resolves it |
| `POST /api/receipts/:id/acknowledge` | clear a flagged receipt from the review queue |
| `POST /api/settle` | batch all unsettled charges into per-vendor payouts |
| `POST /api/reset` | reseed state |

### Tech stack

Vite + React + Tailwind (client) · Node + Express (server) · the official `openai`
package · `concurrently` for one-command dev · in-memory state.

---

## Roadmap

- **Real settlement rails** — actual card issuance and vendor payouts (settlement is currently modeled in-app, not connected to a payment processor).
- Real fleet/vendor **accounts** (state is currently a single local SQLite database).
- **Multi-tenant fleets and role-based access** for operators, approvers, and admins.

## Status

Working reference implementation: a deterministic robotics simulation in front of a real
spend-governance layer, with file-backed persistence. The governance engine, marketplace,
approval / override / escalation flows, receipts, review inbox, batch settlement, and
anomaly detection are the product; the robotics is simulated so the loop can be exercised
end-to-end without hardware.
