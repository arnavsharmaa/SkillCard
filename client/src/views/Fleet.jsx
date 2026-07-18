import React from 'react';
import RobotCard from '../components/RobotCard.jsx';
import { money } from '../api.js';

export default function Fleet({ state }) {
  const robots = state.robots;
  const totalBudget = robots.reduce((a, r) => a + r.monthlyBudget, 0);
  const totalSpent = robots.reduce((a, r) => a + r.spent, 0);
  const totalTasks = robots.reduce((a, r) => a + r.tasksCompleted, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4">
        <Kpi label="Fleet budget" v={money(totalBudget)} />
        <Kpi label="Spent" v={money(totalSpent)} />
        <Kpi label="Remaining" v={money(totalBudget - totalSpent)} accent />
        <Kpi label="Tasks completed" v={totalTasks} />
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
