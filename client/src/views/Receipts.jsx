import React, { useState } from 'react';
import ReceiptCard from '../components/ReceiptCard.jsx';
import { money, runSettlement } from '../api.js';

const CATEGORY_LABEL = {
  perception: 'Software / Perception Licensing',
  manipulation: 'Software / Robotics Capability',
  teleop: 'Contract Labor / Teleoperation',
  navigation: 'Software / Autonomy Licensing',
};

// Build a spreadsheet-friendly CSV from receipts (for the expense report).
function receiptsToCsv(receipts) {
  const cols = [
    'receipt_id', 'date', 'robot', 'task', 'skill', 'vendor', 'cost',
    'task_value', 'human_baseline', 'net_saved', 'downtime_avoided',
    'accounting_category', 'outcome', 'approval',
  ];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = receipts.map((r) =>
    [
      r.id, r.ts, r.robot.name, r.task.description, r.skill.name, r.skill.vendor, r.cost,
      r.taskValue, r.humanBaseline, r.netSaved, r.downtimeAvoided ?? 0,
      CATEGORY_LABEL[r.category] || r.category, r.outcome, r.policyDecision || 'auto',
    ].map(esc).join(',')
  );
  return [cols.join(','), ...rows].join('\n');
}

function downloadCsv(receipts) {
  const blob = new Blob([receiptsToCsv(receipts)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `skillcard-receipts-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Receipts({ state, onComplete }) {
  const [robotFilter, setRobotFilter] = useState('all');
  const [settling, setSettling] = useState(false);

  const settle = async () => {
    setSettling(true);
    try {
      await runSettlement();
      await onComplete?.();
    } catch (_) {
      /* leave outstanding as-is */
    } finally {
      setSettling(false);
    }
  };

  if (state.receipts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-edge grid place-items-center text-center p-16">
        <div>
          <div className="text-4xl mb-3">🧾</div>
          <div className="text-lg font-semibold">No receipts yet</div>
          <p className="text-sm text-muted mt-1">Run a task in Live Run — each completed run files a receipt here.</p>
        </div>
      </div>
    );
  }

  const robots = [...new Map(state.receipts.map((r) => [r.robot.id, r.robot.name])).entries()];
  const receipts = robotFilter === 'all' ? state.receipts : state.receipts.filter((r) => r.robot.id === robotFilter);
  const totalSpent = receipts.reduce((a, r) => a + r.cost, 0);
  const totalSaved = receipts.reduce((a, r) => a + (r.netSaved || 0), 0);
  const byCategory = receipts.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + r.cost;
    return acc;
  }, {});
  const categoryRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  // Settlement: outstanding (unsettled) charges grouped by vendor.
  const outstanding = state.receipts.filter((r) => !r.settled);
  const payablesByVendor = outstanding.reduce((acc, r) => {
    const v = r.skill.vendor;
    acc[v] = (acc[v] || 0) + r.cost;
    return acc;
  }, {});
  const payables = Object.entries(payablesByVendor).sort((a, b) => b[1] - a[1]);
  const outstandingTotal = outstanding.reduce((a, r) => a + r.cost, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Kpi label="Receipts" v={receipts.length} />
        <Kpi label="Total spent" v={money(totalSpent)} />
        <Kpi label="Total saved" v={money(totalSaved)} accent />
        <button
          onClick={() => downloadCsv(receipts)}
          className="ml-auto rounded-lg border border-edge bg-panel2 px-4 py-2.5 text-sm font-medium hover:border-accent/50 transition-colors"
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* vendor payables + batch settlement */}
      <div className="rounded-2xl border border-edge bg-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Vendor payables</div>
          {payables.length > 0 ? (
            <button
              onClick={settle}
              disabled={settling}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-ink hover:brightness-110 transition disabled:opacity-60"
            >
              {settling ? 'Settling…' : `Run settlement · ${money(outstandingTotal)}`}
            </button>
          ) : (
            <span className="text-xs font-mono text-accent">✓ all charges settled</span>
          )}
        </div>
        {payables.length > 0 ? (
          <div className="space-y-1.5">
            {payables.map(([vendor, amount]) => (
              <div key={vendor} className="flex items-center justify-between text-sm">
                <span className="text-white/85 truncate">{vendor}</span>
                <span className="font-mono">{money(amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">Charges accrue per purchase and settle to vendors in one batch.</p>
        )}
      </div>

      {/* spend by accounting category (expense-report rollup) */}
      {categoryRows.length > 0 && (
        <div className="rounded-2xl border border-edge bg-panel p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Spend by accounting category</div>
          <div className="space-y-2">
            {categoryRows.map(([cat, amount]) => (
              <div key={cat} className="flex items-center gap-3">
                <div className="w-52 shrink-0 text-xs text-white/85 truncate">{CATEGORY_LABEL[cat] || cat}</div>
                <div className="flex-1 h-2 rounded-full bg-panel2 overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${Math.round((amount / totalSpent) * 100)}%` }} />
                </div>
                <div className="w-16 shrink-0 text-right font-mono text-sm">{money(amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* robot filter */}
      <div className="flex flex-wrap gap-2">
        <Chip active={robotFilter === 'all'} onClick={() => setRobotFilter('all')}>All robots</Chip>
        {robots.map(([id, name]) => (
          <Chip key={id} active={robotFilter === id} onClick={() => setRobotFilter(id)}>{name}</Chip>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {receipts.map((r) => (
          <ReceiptCard key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}

const Kpi = ({ label, v, accent }) => (
  <div className="rounded-xl border border-edge bg-panel px-5 py-3">
    <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    <div className={`font-mono text-xl font-bold ${accent ? 'text-accent' : 'text-white'}`}>{v}</div>
  </div>
);
const Chip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
      active ? 'border-accent bg-accent/10 text-accent' : 'border-edge bg-panel2 text-muted hover:text-white'
    }`}
  >
    {children}
  </button>
);
