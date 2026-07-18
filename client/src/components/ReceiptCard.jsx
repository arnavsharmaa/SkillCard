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
    <div className={fresh ? 'rise-in' : ''}>
      <div className="relative rounded-t-2xl border border-b-0 border-edge bg-panel overflow-hidden">
        {r.outcome === 'success' && (
          <div className={`receipt-stamp ${fresh ? 'stamp-in' : ''}`}>✓ Paid</div>
        )}

        {/* header */}
        <div className="flex items-center justify-between border-b border-dashed border-edge bg-panel2 px-5 py-3">
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

        <div className="px-5 divide-y divide-dashed divide-edge">
          {/* who / what */}
          <div className="grid grid-cols-2 gap-4 text-sm py-4">
            <Field label="Robot">{r.robot.name}</Field>
            <Field label="Outcome">
              <span className="text-accent">✓ {r.outcome}</span>
            </Field>
            <Field label="Task" span>{r.task.description}</Field>
          </div>

          {/* diagnosis */}
          <div className="py-4">
            <Label>Diagnosis</Label>
            <p className="text-sm text-white/85 leading-relaxed">{r.diagnosis}</p>
          </div>

          {/* itemized purchase */}
          <div className="py-4 font-mono">
            <Label>Item purchased</Label>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-white/90">{r.skill.name}</span>
              <span>{money(r.cost)}</span>
            </div>
            <div className="text-xs text-muted mt-0.5">{r.skill.vendor} · {r.skill.pricingModel}</div>
          </div>

          {/* blocked (if any) */}
          {r.blocked?.length > 0 && (
            <div className="py-4">
              <div className="rounded-lg border border-danger/40 bg-danger/5 p-2.5">
                <Label>Blocked by policy</Label>
                {r.blocked.map((b, i) => (
                  <p key={i} className="text-xs text-danger/90">{b.name} — {b.reasons.join(' ')}</p>
                ))}
              </div>
            </div>
          )}

          {/* alternatives */}
          {r.alternatives?.length > 0 && (
            <div className="py-4">
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

          {/* ledger */}
          <div className="py-4 font-mono text-sm">
            <MonoRow k="Task value" v={money(r.taskValue)} />
            <MonoRow k="Human baseline" v={money(r.humanBaseline)} />
            <MonoRow k="Skill cost" v={`−${money(r.cost)}`} />
            <div className="mt-2.5 border-t border-dashed border-edge pt-2.5 flex items-baseline justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted">Net saved</span>
              <span className={`text-2xl font-bold ${r.netSaved >= 0 ? 'text-accent' : 'text-danger'}`}>
                {money(r.netSaved)}
              </span>
            </div>
          </div>

          {/* category + barcode */}
          <div className="py-4">
            <div className="flex items-center justify-between">
              <Label>Accounting category</Label>
              <span className="text-xs font-mono text-white/70">{CATEGORY_LABEL[r.category] || r.category}</span>
            </div>
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <div className="barcode h-8 w-3/5 opacity-50" />
              <div className="text-[10px] font-mono text-muted uppercase tracking-[0.3em]">{r.id}</div>
            </div>
          </div>
        </div>
      </div>
      {/* perforated tear-off edge */}
      <div className="receipt-tear" />
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
const MonoRow = ({ k, v }) => (
  <div className="flex items-baseline justify-between py-0.5">
    <span className="text-xs uppercase tracking-wider text-muted">{k}</span>
    <span className="text-white/90">{v}</span>
  </div>
);
