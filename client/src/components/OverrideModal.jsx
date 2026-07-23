import React, { useState } from 'react';
import { authorizeOverride, money } from '../api.js';

// Shown when EVERY viable skill for a task costs more than the robot's remaining
// budget. A human either authorizes a one-time budget override, or cancels and
// leaves the task unresolved.
export default function OverrideModal({ override, onResolved, onError, onCancel }) {
  const [busy, setBusy] = useState(false);
  const { chosen, remaining, budget, spent, receiptId } = override;
  const over = spent + chosen.price - budget;

  const authorize = async () => {
    setBusy(true);
    try {
      onResolved(await authorizeOverride(receiptId));
    } catch (_) {
      onError?.();
    }
  };

  return (
    <div className="rounded-2xl border-2 border-danger/60 bg-danger/5 overflow-hidden rise-in">
      <div className="flex items-center justify-between border-b border-danger/40 bg-danger/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-danger text-lg">⛔</span>
          <div>
            <div className="text-sm font-semibold text-danger">Budget override required</div>
            <div className="text-[10px] font-mono text-danger/70">no skill fits the remaining budget</div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        <p className="text-sm text-white/85">
          The cheapest viable skill is <span className="font-semibold">{chosen.name}</span> at{' '}
          <span className="font-mono">{money(chosen.price)}</span>, but only{' '}
          <span className="font-mono text-danger">{money(remaining)}</span> of budget remains. Buying it would put the
          card <span className="font-mono text-danger">{money(over)}</span> over its {money(budget)} budget.
        </p>

        <div className="grid grid-cols-3 gap-2 font-mono text-sm">
          <Stat label="Budget" v={money(budget)} />
          <Stat label="Remaining" v={money(remaining)} tone="danger" />
          <Stat label="This purchase" v={money(chosen.price)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={authorize}
            disabled={busy}
            className="rounded-xl bg-danger py-3 font-bold text-ink hover:brightness-110 transition disabled:opacity-60"
          >
            ⚑ Authorize override
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-edge bg-panel2 py-3 font-semibold text-white hover:border-danger/50 transition disabled:opacity-60"
          >
            Cancel — leave unresolved
          </button>
        </div>
        <p className="text-[11px] text-muted">
          Overrides are logged against the fleet and flagged for finance review — the business stays in control of the
          spend, not the robot.
        </p>
      </div>
    </div>
  );
}

const Stat = ({ label, v, tone }) => (
  <div className="rounded-lg border border-edge bg-panel2 px-3 py-2">
    <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    <div className={tone === 'danger' ? 'text-danger' : 'text-white'}>{v}</div>
  </div>
);
