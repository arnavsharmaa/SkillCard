import React from 'react';
import { money } from '../api.js';

const CATEGORY_LABEL = {
  perception: 'Software / Perception Licensing',
  manipulation: 'Software / Robotics Capability',
  teleop: 'Contract Labor / Teleoperation',
  navigation: 'Software / Autonomy Licensing',
};

export default function ReceiptCard({ r, fresh }) {
  return (
    <div className={`rounded-2xl border border-edge bg-panel overflow-hidden ${fresh ? 'rise-in' : ''}`}>
      {/* header */}
      <div className="flex items-center justify-between border-b border-edge bg-panel2 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-accent/20 text-accent grid place-items-center text-xs font-bold">S</div>
          <div>
            <div className="text-sm font-semibold">SkillCard Receipt</div>
            <div className="text-[10px] font-mono text-muted">{r.id} · {r.ts}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted">Net saved</div>
          <div className={`font-mono font-bold text-xl ${r.netSaved >= 0 ? 'text-accent' : 'text-danger'}`}>
            {money(r.netSaved)}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* who / what */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Robot">{r.robot.name}</Field>
          <Field label="Outcome">
            <span className="text-accent">✓ {r.outcome}</span>
          </Field>
          <Field label="Task" span>{r.task.description}</Field>
        </div>

        {/* diagnosis */}
        <div>
          <Label>Diagnosis</Label>
          <p className="text-sm text-white/85 leading-relaxed">{r.diagnosis}</p>
        </div>

        {/* purchase */}
        <div className="rounded-xl border border-edge bg-panel2 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{r.skill.name}</div>
              <div className="text-xs text-muted">{r.skill.vendor} · {r.skill.pricingModel}</div>
            </div>
            <div className="font-mono text-lg">{money(r.cost)}</div>
          </div>
        </div>

        {/* blocked (if any) */}
        {r.blocked?.length > 0 && (
          <div className="rounded-lg border border-danger/40 bg-danger/5 p-2.5">
            <Label>Blocked by policy</Label>
            {r.blocked.map((b, i) => (
              <p key={i} className="text-xs text-danger/90">{b.name} — {b.reasons.join(' ')}</p>
            ))}
          </div>
        )}

        {/* alternatives */}
        {r.alternatives?.length > 0 && (
          <div>
            <Label>Alternatives considered</Label>
            <div className="space-y-1">
              {r.alternatives.map((a, i) => (
                <p key={i} className="text-xs text-muted">
                  <span className="font-mono text-white/60">{a.skill_id}</span> — {a.reason}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* economics */}
        <div className="grid grid-cols-3 gap-2 border-t border-edge pt-3 font-mono">
          <Stat label="Task value" v={money(r.taskValue)} />
          <Stat label="Human baseline" v={money(r.humanBaseline)} />
          <Stat label="Net saved" v={money(r.netSaved)} accent={r.netSaved >= 0} />
        </div>

        <div className="flex items-center justify-between border-t border-edge pt-3">
          <Label>Accounting category</Label>
          <span className="text-xs font-mono text-white/70">{CATEGORY_LABEL[r.category] || r.category}</span>
        </div>
      </div>
    </div>
  );
}

const Label = ({ children }) => (
  <div className="text-[10px] uppercase tracking-wider text-muted mb-1">{children}</div>
);
const Field = ({ label, children, span }) => (
  <div className={span ? 'col-span-2' : ''}>
    <Label>{label}</Label>
    <div className="text-white/90">{children}</div>
  </div>
);
const Stat = ({ label, v, accent }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    <div className={accent ? 'text-accent' : 'text-white'}>{v}</div>
  </div>
);
