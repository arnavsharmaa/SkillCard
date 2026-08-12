import React from 'react';
import RobotCard from '../components/RobotCard.jsx';
import Sparkline from '../components/Sparkline.jsx';
import { money, reviewFlag } from '../api.js';

export default function Fleet({ state }) {
  const robots = state.robots;
  const receipts = state.receipts;
  const totalBudget = robots.reduce((a, r) => a + r.monthlyBudget, 0);
  const totalSpent = robots.reduce((a, r) => a + r.spent, 0);
  const totalTasks = robots.reduce((a, r) => a + r.tasksCompleted, 0);

  // Governance rollup across every filed receipt.
  const byDecision = (d) => receipts.filter((r) => (r.policyDecision || 'approve') === d).length;
  const autoApproved = receipts.filter((r) => (r.policyDecision || 'approve') === 'approve').length;
  const humanApproved = byDecision('human-approved');
  const operatorChosen = byDecision('operator-chosen');
  const overrides = byDecision('budget-override');
  const escalations = receipts.filter((r) => r.operator).length;
  const flaggedForReview = receipts.filter((r) => reviewFlag(r)).length;
  const overBudgetBots = robots.filter((r) => r.spent > r.monthlyBudget).length;

  // Cumulative savings across receipts, oldest → newest.
  let cum = 0;
  const savingsTrend = [...receipts].reverse().map((r) => (cum += r.netSaved || 0));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4">
        <Kpi label="Fleet budget" v={money(totalBudget)} />
        <Kpi label="Spent" v={money(totalSpent)} />
        <Kpi label="Remaining" v={money(totalBudget - totalSpent)} accent />
        <Kpi label="Total saved" v={money(state.totalSaved)} accent />
        <Kpi label="Tasks completed" v={totalTasks} />
      </div>

      {/* governance rollup */}
      <div className="rounded-2xl border border-edge bg-panel p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Spend governance</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Metric label="Purchases" v={receipts.length} />
          <Metric label="Auto-approved" v={autoApproved} tone="accent" />
          <Metric label="Human-approved" v={humanApproved} tone={humanApproved ? 'warn' : 'muted'} />
          <Metric label="Operator picks" v={operatorChosen} tone={operatorChosen ? 'warn' : 'muted'} />
          <Metric label="Budget overrides" v={overrides} tone={overrides ? 'danger' : 'muted'} />
          <Metric label="Flagged for review" v={flaggedForReview} tone={flaggedForReview ? 'warn' : 'muted'} />
        </div>
        {overBudgetBots > 0 && (
          <div className="mt-3 text-xs text-danger">
            ⛔ {overBudgetBots} robot{overBudgetBots > 1 ? 's' : ''} currently over budget — flagged for finance review.
          </div>
        )}

        {/* cumulative savings trend */}
        <div className="mt-4 border-t border-edge pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider text-muted">Cumulative savings</div>
            <div className="font-mono text-sm text-accent font-bold">{money(state.totalSaved)}</div>
          </div>
          <div className="text-accent">
            <Sparkline points={savingsTrend} width={640} height={48} className="w-full" />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {robots.map((r) => (
          <RobotCard key={r.id} robot={r} />
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
const Metric = ({ label, v, tone }) => {
  const c = tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : tone === 'accent' ? 'text-accent' : 'text-white';
  return (
    <div className="rounded-lg border border-edge bg-panel2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`font-mono text-lg font-bold ${c}`}>{v}</div>
    </div>
  );
};
