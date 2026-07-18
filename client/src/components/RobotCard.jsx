import React from 'react';
import { money } from '../api.js';
import RobotAvatar from './RobotAvatar.jsx';

export default function RobotCard({ robot }) {
  const remaining = robot.monthlyBudget - robot.spent;
  const pct = Math.min(100, Math.round((robot.spent / robot.monthlyBudget) * 100));
  const costPerTask = robot.tasksCompleted ? robot.spent / robot.tasksCompleted : 0;

  return (
    <div className="rounded-2xl border border-edge bg-panel p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
          <RobotAvatar type={robot.type} size={34} />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold truncate">{robot.name}</div>
          <div className="text-xs text-muted truncate">{robot.model}</div>
        </div>
      </div>

      {/* budget bar */}
      <div>
        <div className="flex justify-between text-xs font-mono mb-1">
          <span className="text-muted">spent {money(robot.spent)}</span>
          <span className="text-accent">{money(remaining)} left</span>
        </div>
        <div className="h-2.5 rounded-full bg-panel2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warn' : 'bg-accent'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted mt-1 font-mono">
          <span>budget {money(robot.monthlyBudget)} / mo</span>
          <span>{pct}% used</span>
        </div>
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
        <div className="flex items-end gap-1.5 h-14 border-b border-edge">
          {robot.history.map((h, i) => {
            const max = Math.max(...robot.history.map((x) => x.amount), 1);
            const isLast = i === robot.history.length - 1;
            return (
              <div key={i} className="flex-1 max-w-12 group relative flex items-end h-full">
                <div
                  className={`grow-up w-full rounded-t transition-colors ${
                    isLast ? 'bg-accent spark-glow' : 'bg-accentDim/70 group-hover:bg-accent'
                  }`}
                  style={{ height: `${Math.max(8, (h.amount / max) * 100)}%`, animationDelay: `${i * 50}ms` }}
                  title={`${h.label}: ${money(h.amount)}${h.approvedBy ? ` (${h.approvedBy}-approved)` : ''}`}
                />
              </div>
            );
          })}
        </div>
        <div className="text-[10px] font-mono text-muted mt-1.5 truncate flex items-center gap-1.5">
          <span className="truncate">latest: <span className="text-accent">{robot.history[robot.history.length - 1]?.label}</span></span>
          {robot.history[robot.history.length - 1]?.approvedBy === 'human' && (
            <span className="shrink-0 rounded border border-warn/40 bg-warn/10 px-1 text-warn">⚑ approved</span>
          )}
          {robot.history[robot.history.length - 1]?.approvedBy === 'operator' && (
            <span className="shrink-0 rounded border border-edge bg-panel2 px-1 text-muted">operator pick</span>
          )}
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
