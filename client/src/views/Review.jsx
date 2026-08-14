import React, { useState } from 'react';
import { money, reviewFlag, acknowledgeReceipt } from '../api.js';

// Finance review inbox: every purchase that tripped a spend alert, waiting for a
// human to acknowledge it. Acknowledging clears it from the queue.
export default function Review({ state, onComplete }) {
  const [busy, setBusy] = useState(null);

  const flagged = state.receipts
    .map((r) => ({ r, flag: reviewFlag(r) }))
    .filter((x) => x.flag);
  const pending = flagged.filter((x) => !x.r.acknowledged);
  const cleared = flagged.filter((x) => x.r.acknowledged);
  const pendingAmount = pending.reduce((a, x) => a + x.r.cost, 0);

  const ack = async (id) => {
    setBusy(id);
    try {
      await acknowledgeReceipt(id);
      await onComplete?.();
    } catch (_) {
      /* ignore — the row stays until it succeeds */
    } finally {
      setBusy(null);
    }
  };

  if (flagged.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-edge grid place-items-center text-center p-16">
        <div>
          <div className="text-4xl mb-3">✅</div>
          <div className="text-lg font-semibold">Nothing to review</div>
          <p className="text-sm text-muted mt-1">
            Overrides, escalations, over-ceiling approvals, and high-cost purchases show up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4">
        <Kpi label="Pending review" v={pending.length} tone={pending.length ? 'warn' : 'muted'} />
        <Kpi label="Amount pending" v={money(pendingAmount)} />
        <Kpi label="Cleared" v={cleared.length} tone="accent" />
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          {pending.map(({ r, flag }) => (
            <Row key={r.id} r={r} flag={flag}>
              <button
                onClick={() => ack(r.id)}
                disabled={busy === r.id}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-ink hover:brightness-110 transition disabled:opacity-60"
              >
                {busy === r.id ? 'Clearing…' : '✓ Acknowledge'}
              </button>
            </Row>
          ))}
        </div>
      )}

      {cleared.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Cleared</div>
          {cleared.map(({ r, flag }) => (
            <Row key={r.id} r={r} flag={flag} muted>
              <span className="shrink-0 text-xs font-mono text-accent">✓ reviewed</span>
            </Row>
          ))}
        </div>
      )}
    </div>
  );
}

const Row = ({ r, flag, muted, children }) => {
  const tone = flag.level === 'danger' ? 'text-danger' : 'text-warn';
  return (
    <div className={`flex items-center gap-4 rounded-xl border border-edge bg-panel p-4 ${muted ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium ${muted ? 'text-muted' : tone}`}>⚑ {flag.reason}</div>
        <div className="text-xs text-muted mt-0.5 truncate">
          {r.robot.name} · {r.task.description}
        </div>
        <div className="text-[11px] font-mono text-muted mt-1">
          {r.skill.name} · {money(r.cost)} · {r.id}
        </div>
      </div>
      {children}
    </div>
  );
};

const Kpi = ({ label, v, tone }) => {
  const c = tone === 'warn' ? 'text-warn' : tone === 'accent' ? 'text-accent' : 'text-white';
  return (
    <div className="rounded-xl border border-edge bg-panel px-5 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`font-mono text-xl font-bold ${c}`}>{v}</div>
    </div>
  );
};
