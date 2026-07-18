import React from 'react';
import { money } from '../api.js';

export default function RobotCard({ robot }) {
  const remaining = robot.monthlyBudget - robot.spent;
  const pct = Math.min(100, Math.round((robot.spent / robot.monthlyBudget) * 100));
  const costPerTask = robot.tasksCompleted ? robot.spent / robot.tasksCompleted : 0;

  return (
    <div className="rounded-2xl border border-edge bg-panel p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold">{robot.name}</div>
          <div className="text-xs text-muted">{robot.model}</div>
        </div>
        <div className="h-9 w-9 rounded-lg bg-accent/15 text-accent grid place-items-center font-mono text-xs">
          {robot.id.slice(-2)}
        </div>
      </div>

      {/* budget bar */}
      <div>
        <div className="flex justify-between text-xs font-mono mb-1">
          <span className="text-muted">spent {money(robot.spent)}</span>
          <span className="text-accent">{money(remaining)} left</span>
        </div>
        <div className="h-2 rounded-full bg-panel2 overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[10px] text-muted mt-1 font-mono">budget {money(robot.monthlyBudget)} / mo</div>
      </div>

      {/* capabilities */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Installed capabilities</div>
        <div className="flex flex-wrap gap-1.5">
          {robot.capabilities.map((c) => (
            <span key={c} className="rounded border border-edge bg-panel2 px-2 py-0.5 text-[11px] font-mono text-white/80">
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* policy */}
      <div className="rounded-lg border border-edge bg-panel2 p-3 text-xs space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted mb-1">Spend policy</div>
        <Row k="Auto-approve ≤" v={money(robot.policy.autoApproveCeiling)} />
        <Row k="Blocked" v={robot.policy.blockedCategories.length ? robot.policy.blockedCategories.join(', ') : 'none'} />
        <Row k="Requires cert" v={robot.policy.requiredCertifications.length ? robot.policy.requiredCertifications.join(', ') : 'none'} />
      </div>

      {/* spend history sparkbars */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted">Spend history</div>
          <div className="text-[10px] font-mono text-muted">
            {robot.tasksCompleted} tasks · {money(costPerTask)}/task
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-12">
          {robot.history.map((h, i) => {
            const max = Math.max(...robot.history.map((x) => x.amount), 1);
            return (
              <div key={i} className="flex-1 group relative">
                <div
                  className="w-full rounded-t bg-accentDim group-hover:bg-accent transition-colors"
                  style={{ height: `${Math.max(8, (h.amount / max) * 100)}%` }}
                  title={`${h.label}: ${money(h.amount)}`}
                />
              </div>
            );
          })}
        </div>
        <div className="text-[10px] font-mono text-muted mt-1 truncate">
          latest: {robot.history[robot.history.length - 1]?.label}
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="flex justify-between">
    <span className="text-muted">{k}</span>
    <span className="font-mono text-white/80">{v}</span>
  </div>
);
