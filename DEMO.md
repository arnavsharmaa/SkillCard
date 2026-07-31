# SkillCard — 60-second demo script

A stranger walks up to the table. You have their attention for 60 seconds. Here's the run.

## Before they arrive (do this once)
1. `npm run dev` is running. Browser open at **http://localhost:5173**.
2. Click **↺ Reset demo** so the big counter reads **$0**.
3. Leave it on the **Live Run** tab with **task-01** ("A clear plastic water bottle is blocking the robot's path…")
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
| **ATTEMPT** | the red telemetry | *"A clear water bottle is blocking its path — but the depth camera reads transparent plastic as empty floor, so it stalls."* |
| **DIAGNOSE** | the plain-English text | *"The agent explains the failure in plain language — a sensing gap, not a motion problem. That's a live model call."* |
| **SHOP** | the red **BLOCKED** badges | *"It shops a marketplace — and every option gets a policy badge. See the $8 skill from an unverified vendor demanding unrestricted camera and motion access? Hard-blocked on security. That's the malicious-skill defense."* |
| **REASON** | the rejection list | *"It reasons on the economics — expected value against the $480 the task is worth — and justifies rejecting every alternative."* |
| **POLICY (red block)** | the loud red BLOCKED card | ⭐ *"Its best economic pick was a human teleoperator — but policy blocks human teleop for autonomous units. The model proposes, policy disposes. Watch it fall back."* |
| **PURCHASE → RETRY** | the green success | *"It buys the compliant option for $42 under delegated authority, installs the capability, retries — and succeeds."* |
| **RECEIPT** | the receipt card | *"And it emits a receipt you could staple to an expense report: what broke, what it bought, what it rejected and why, what it saved, and the downtime it avoided."* |

## The number to point at

**Point at the giant green number pinned at the top.** It ticks from **$0 → $178**.

**Say:** *"That's the whole pitch. A human doing this task costs $220. The robot spent
$42 and did it itself. **$178 saved on one task** — and every dollar is auditable. This
is spend infrastructure for machines that can act on their own."*

## The second act — human escalation (optional, ~20 seconds)

If they lean in, show what happens when the bought skill *doesn't* work:

1. Press **↺ Reset demo**, tick **Simulate skill failure**, keep task-01 / Atlas-7, press **▶ Run Task**.
2. Same loop — but at **RETRY** the skill fails (red ✕) and the robot **escalates to an approved human operator**.
3. An **Operator Console** appears. **Say:** *"When autonomy isn't enough, it escalates — to an approved operator vendor, not an anonymous gig worker. Time-boxed, every action recorded."*
4. Click **Take control & resolve**. **Say:** *"The operator resolves it, and access is revoked the moment the task ends."*
5. **Point at the receipt:** *"Look — it shows the full trail: the $42 skill that failed, the $55 operator that fixed it, and it's STILL $123 cheaper than a human doing it from scratch. It doesn't hide the failure — it accounts for it."*

> This is single-laptop by design — no second device to fail at the table.

## Extra governance beats (pick based on the judge)

- **Human approval (over-ceiling):** run the **weld task** on **Spot-Delta** → the pick
  ($210) exceeds the auto-approve ceiling, so it **pauses for a human**. *Approve*, or
  *choose a different skill* from the inline marketplace. *"The model proposes, the human
  disposes — and either way it's logged."*
- **Budget override:** run the **weld task** on **Arm-Nova** (near-exhausted budget) →
  **no skill fits the budget**, so it demands a **budget override**. *"The robot can't just
  overspend — a human authorizes it, and it's flagged for finance review."*
- **Security block:** on any run, point at the **red BLOCKED badge** in SHOP — the $8
  unverified-vendor skill demanding unrestricted camera/motion access. *"That's the
  malicious-skill defense."*

## If they want more
- **Model pill (top-left):** *"‘gpt-4o · live’ — that's a real model call. If the API ever
  drops, it flips to ‘offline reasoning’ and the demo keeps running on cached logic."*
- **Marketplace tab:** *"Every buyable skill, with price, success rate, vendor
  verification, and permissions — click one for the full spec sheet."*
- **Receipts tab:** *"Every run files a receipt — filter by robot and **Export CSV** for
  the expense report. Finance can audit an autonomous agent."*
- **Fleet tab:** *"Three robots, three budgets, three policies, plus a fleet-wide
  governance rollup — approvals, overrides, escalations at a glance."*

## Presenter shortcuts
`Enter` runs · `R` resets · `1`–`4` switch tabs — so you can drive it hands-free.

## Recovery (it won't happen, but)
- Nothing renders? Press **↺ Reset demo**, then **▶ Run Task** again.
- Want a different story? Run **task-04** (recycling sort) for a clean auto-approve, or
  **task-03** (weld inspection, $900 value) to show the *yellow "flagged for approval"*
  state — a bigger saved number, no red block, still completes.
