# SkillCard — 60-second demo script

A stranger walks up to the table. You have their attention for 60 seconds. Here's the run.

## Before they arrive (do this once)
1. `npm run dev` is running. Browser open at **http://localhost:5173**.
2. Click **↺ Reset demo** so the big counter reads **$0**.
3. Leave it on the **Live Run** tab with **task-01** ("Pick a transparent glass beaker…")
   and robot **Atlas-7** selected. Both are the defaults — don't touch anything else.

> The demo is deterministic. task-01 on Atlas-7 **always** triggers the policy block and
> fallback. That is the moment you're selling. It works with or without an API key.

## The 20-second run — press ONE button

**Say:** *"This is a fleet of autonomous robots. Each one has a virtual card and a
spending policy. This robot just failed a task. Watch what its agent does about it —
I press one button."*

**Press ▶ Run Task.** Then narrate the stages as they appear:

| Stage | Point at… | Say |
|-------|-----------|-----|
| **ATTEMPT** | the red telemetry | *"It tried to grab a glass beaker and failed — the depth camera can't see transparent objects."* |
| **DIAGNOSE** | the plain-English text | *"The agent explains the failure in plain language — a sensing gap, not a motion problem. That's a live model call."* |
| **SHOP → REASON** | the rejection list | *"It shops a marketplace of buyable skills and reasons about the economics — expected value against the $480 the task is worth. Look, it justifies rejecting every alternative."* |
| **POLICY (red block)** | the loud red BLOCKED card | ⭐ *"Its best pick was a human teleoperator — but company policy blocks human teleop for autonomous units. The model proposes, policy disposes. Watch it fall back."* |
| **PURCHASE → RETRY** | the green success | *"It buys the compliant option for $42, installs the capability, retries — and succeeds."* |
| **RECEIPT** | the receipt card | *"And it emits a receipt you could staple to an expense report: what broke, what it bought, what it rejected and why, and what it saved."* |

## The number to point at

**Point at the giant green number pinned at the top.** It ticks from **$0 → $178**.

**Say:** *"That's the whole pitch. A human doing this task costs $220. The robot spent
$42 and did it itself. **$178 saved on one task** — and every dollar is auditable. This
is spend infrastructure for machines that can act on their own."*

## If they want more (the extra 20 seconds)
- **Receipts tab:** *"Every run files a receipt like this — diagnosis, alternatives
  considered, net saved, accounting category. Finance can audit an autonomous agent."*
- **Fleet tab:** *"Three robots, three budgets, three policies. Notice Atlas-7 now has
  the transparent-object-grasp capability it just bought, and its card is down $42."*

## Recovery (it won't happen, but)
- Nothing renders? Press **↺ Reset demo**, then **▶ Run Task** again.
- Want a different story? Run **task-04** (recycling sort) for a clean auto-approve, or
  **task-03** (weld inspection, $900 value) to show the *yellow "flagged for approval"*
  state — a bigger saved number, no red block, still completes.
