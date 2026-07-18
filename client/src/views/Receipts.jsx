import React from 'react';
import ReceiptCard from '../components/ReceiptCard.jsx';
import { money } from '../api.js';

export default function Receipts({ state }) {
  const receipts = state.receipts;
  const totalSpent = receipts.reduce((a, r) => a + r.cost, 0);

  if (receipts.length === 0) {
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4">
        <Kpi label="Receipts" v={receipts.length} />
        <Kpi label="Total spent" v={money(totalSpent)} />
        <Kpi label="Total saved" v={money(state.totalSaved)} accent />
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
