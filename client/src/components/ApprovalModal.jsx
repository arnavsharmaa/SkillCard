import React, { useState } from 'react';
import { approvePurchase, chooseSkill, money } from '../api.js';

// Shown when a purchase is flagged (over the auto-approve ceiling). The human
// either approves the agent's over-ceiling pick, or opens the marketplace and
// chooses a different skill. The model proposes; the human disposes.
export default function ApprovalModal({ approval, onResolved, onError }) {
  const [mode, setMode] = useState('decide'); // decide | shop
  const [busy, setBusy] = useState(false);
  const { chosen, ceiling, candidates, receiptId } = approval;

  const approve = async () => {
    setBusy(true);
    try {
      onResolved(await approvePurchase(receiptId), 'human');
    } catch (_) {
      onError?.();
    }
  };

  const pick = async (skillId) => {
    setBusy(true);
    try {
      onResolved(await chooseSkill(receiptId, skillId), 'operator');
    } catch (_) {
      onError?.();
    }
  };

  const others = candidates.filter((c) => c.id !== chosen.id);

  return (
    <div className="rounded-2xl border-2 border-warn/60 bg-warn/5 overflow-hidden rise-in">
      <div className="flex items-center justify-between border-b border-warn/40 bg-warn/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-warn text-lg">⚑</span>
          <div>
            <div className="text-sm font-semibold text-warn">Approval required</div>
            <div className="text-[10px] font-mono text-warn/70">purchase exceeds the auto-approve ceiling</div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        <p className="text-sm text-white/85">
          The agent's best pick is <span className="font-semibold">{chosen.name}</span> at{' '}
          <span className="font-mono">{money(chosen.price)}</span>, which is over {money(ceiling)} — so it needs a human
          sign-off.
        </p>

        {mode === 'decide' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={approve}
              disabled={busy}
              className="rounded-xl bg-accent py-3 font-bold text-ink hover:brightness-110 transition disabled:opacity-60"
            >
              ✓ Approve {money(chosen.price)}
            </button>
            <button
              onClick={() => setMode('shop')}
              disabled={busy}
              className="rounded-xl border border-edge bg-panel2 py-3 font-semibold text-white hover:border-accent/50 transition disabled:opacity-60"
            >
              🛒 Choose a different skill
            </button>
          </div>
        )}

        {mode === 'shop' && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted">Marketplace — pick a skill to buy instead</div>
            {others.map((c) => {
              const blocked = c.policyBadge === 'block';
              return (
                <button
                  key={c.id}
                  disabled={busy || blocked}
                  onClick={() => pick(c.id)}
                  className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                    blocked
                      ? 'border-danger/40 bg-danger/5 opacity-60 cursor-not-allowed'
                      : 'border-edge bg-panel2 hover:border-accent/50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{c.name}</div>
                    <div className="text-[11px] text-muted font-mono">
                      {c.vendor} · {Math.round(c.successRate * 100)}%
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="font-mono">{money(c.price)}</div>
                    <div className={`text-[10px] font-mono ${blocked ? 'text-danger' : c.policyBadge === 'flag' ? 'text-warn' : 'text-accent'}`}>
                      {blocked ? 'blocked' : c.policyBadge === 'flag' ? 'needs approval' : 'compatible'}
                    </div>
                  </div>
                </button>
              );
            })}
            <button onClick={() => setMode('decide')} disabled={busy} className="text-xs text-muted hover:text-white mt-1">
              ← back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
