# SkillCard

**Spend infrastructure for autonomous machines.**

Every robot in a fleet gets a virtual card, a budget, and a spending policy. When a
robot fails a task because it lacks a capability, an autonomous agent diagnoses the
failure, shops a marketplace of purchasable skills, reasons about the economics,
clears the purchase against company policy, buys the approved option, retries the
task, and emits a receipt proving why the money was spent and what it saved.

There is no physical robot. Everything robotic is simulated with seeded, deterministic
outcomes. **The product is the financial reasoning layer, not the robotics.**

---

## Setup (three commands)

```bash
cp .env.example .env      # optional: paste an OPENAI_API_KEY (works without one)
npm run install:all       # installs root + client deps
npm run dev               # server on :3001, client on :5173
```

Then open **http://localhost:5173** and press **Run Task**.

> No key? No problem. The app ships with realistic canned reasoning and runs the full
> loop end-to-end offline. Add a key to `.env` to see live `gpt-4o` diagnosis and
> reasoning. Set `RUN_STUBBED=1` to force offline mode even with a key.

No database, no auth, no deploy. State lives in a plain JS object on the server and
resets on restart (or via the **Reset demo** button).

---

## The core loop

Pressing **Run Task** streams eight stages to the UI over Server-Sent Events:

| # | Stage | What happens |
|---|-----------|--------------|
| 1 | ATTEMPT | Robot tries the task and fails deterministically. Fake telemetry (grasp force, depth confidence, retries, error code). |
| 2 | DIAGNOSE | **OpenAI call** → plain-language explanation of *why* it failed. |
| 3 | SHOP | Filter the marketplace to skills that provide the missing capability. |
| 4 | REASON | **OpenAI call** → picks the best skill on expected value, with rejection reasons for every alternative. |
| 5 | POLICY | **Deterministic code.** Auto-approve, flag, or hard-block. If blocked, fall back to the next-best candidate (visible in the UI). |
| 6 | PURCHASE | Deduct from the robot's card, install the capability, record the transaction. |
| 7 | RETRY | Task succeeds. |
| 8 | RECEIPT | Emit an itemized, auditable receipt. |

**The model proposes, policy disposes.** The agent optimizes pure expected value; the
deterministic policy engine is what actually authorizes (or blocks) the spend.

---

## How the OpenAI API is used

Two calls, both `gpt-4o` (one constant, `MODEL` in [`server/openai.js`](server/openai.js)),
both with `response_format: { type: 'json_object' }` for strict JSON, both wrapped in
`try/catch` with a hardcoded realistic fallback so the demo can never break. Fallbacks
are logged to the server console only — never to the UI.

### Call 1 — DIAGNOSE (`diagnose()`)
- **Input:** the task description, the robot's installed capabilities, and the fake
  telemetry from the failed attempt.
- **System prompt:** acts as a robotics reliability engineer explaining a failure to a
  colleague in one or two plain sentences — not a template.
- **Output JSON:** `{ diagnosis, missing_capability, confidence }`.
- The UI renders `diagnosis` verbatim in the DIAGNOSE stage.

### Call 2 — REASON (`reason()`)
- **Input:** the diagnosis, the 3–4 candidate skills (price, pricing model, success
  rate, hardware, certs, category), the task value, the human baseline cost, and the
  robot's policy.
- **System prompt:** acts as a procurement agent optimizing **expected value**
  (`success_rate × task_value − price`). It is explicitly told *not* to enforce policy
  itself — a separate downstream engine does that — and to give a concrete reason every
  rejected option lost.
- **Output JSON:** `{ chosen_skill_id, justification, rejected: [{ skill_id, reason }] }`.
- The UI renders `justification` and the `rejected` list in the REASON stage.

If either call fails (no key, network error, malformed JSON, or a chosen id that isn't
in the candidate set), the code falls back to a deterministic canned response that still
references the real skills and prices, so the on-screen reasoning always stays coherent.

---

## Project structure

```
server/
  index.js       Express + in-memory state + SSE run stream
  seed.js        Robots, tasks, marketplace (all seeded in code)
  loop.js        The 8-stage loop + deterministic policy engine
  openai.js      The two gpt-4o calls (strict JSON, try/catch)
  fallbacks.js   Canned diagnosis + reasoning + telemetry
client/
  src/
    App.jsx           Shell: pinned savings counter + tabs
    views/            LiveRun, Receipts, Fleet
    components/       StageTimeline, ReceiptCard, RobotCard, SavingsCounter
    api.js            SSE client + money formatter
```

## Tech stack

Vite + React + Tailwind (client) · Node + Express (server) · `openai` npm package ·
`concurrently` for one-command dev · in-memory state, no DB, no auth.
