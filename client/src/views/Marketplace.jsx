import React, { useState, useEffect } from 'react';
import { money } from '../api.js';

const CAP_LABEL = {
  'transparent-object-grasp': 'Transparent-object handling',
  'ocr-lowlight': 'Low-light OCR',
  'weld-inspection': 'Weld inspection',
  'material-classification': 'Material classification',
  'flood-navigation': 'Flood navigation',
};

const CATEGORY_LABEL = {
  perception: 'Perception licensing',
  manipulation: 'Robotics capability',
  teleop: 'Contract labor / teleop',
  navigation: 'Autonomy licensing',
};

// Check a skill against a robot's policy + remaining budget (mirrors the
// server's policy engine) so the marketplace can show per-robot compatibility.
function compatibilityFor(skill, robot) {
  const p = robot.policy;
  if (p.blockedCategories?.includes(skill.category)) return { ok: false, reason: `${skill.category} blocked` };
  if ((skill.requiredHardware || []).length > 0) return { ok: false, reason: 'needs hardware' };
  if (p.requireVerifiedVendor && skill.vendorVerified === false) return { ok: false, reason: 'unverified vendor' };
  if (p.blockUnrestrictedPermissions && (skill.requestedPermissions || []).some((x) => x.includes('unrestricted')))
    return { ok: false, reason: 'excess permissions' };
  const missingCert = (p.requiredCertifications || []).filter((c) => !(skill.certifications || []).includes(c));
  if (missingCert.length) return { ok: false, reason: `needs ${missingCert.join(', ')}` };
  if (skill.price > robot.monthlyBudget - robot.spent) return { ok: 'budget', reason: 'over budget' };
  if (skill.price > p.autoApproveCeiling) return { ok: 'flag', reason: 'needs approval' };
  return { ok: true };
}

export default function Marketplace({ state }) {
  const skills = state.marketplace;
  const [filter, setFilter] = useState('all');
  const [robotId, setRobotId] = useState('none');
  const [selected, setSelected] = useState(null);

  const capabilities = [...new Set(skills.map((s) => s.capability))];
  const vendors = [...new Set(skills.map((s) => s.vendor))];
  const avgSuccess = skills.length ? Math.round((skills.reduce((a, s) => a + s.successRate, 0) / skills.length) * 100) : 0;
  const shown = filter === 'all' ? skills : skills.filter((s) => s.capability === filter);
  const activeRobot = robotId === 'none' ? null : state.robots.find((r) => r.id === robotId);

  // Which seeded tasks each skill is a candidate for.
  const tasksFor = (cap) => state.tasks.filter((t) => t.requiredCapability === cap);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="flex flex-wrap gap-4">
        <Kpi label="Skills listed" v={skills.length} />
        <Kpi label="Vendors" v={vendors.length} />
        <Kpi label="Capabilities" v={capabilities.length} />
        <Kpi label="Avg success" v={`${avgSuccess}%`} />
      </div>

      {/* capability filter */}
      <div className="flex flex-wrap gap-2">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All skills</Chip>
        {capabilities.map((c) => (
          <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
            {CAP_LABEL[c] || c}
          </Chip>
        ))}
      </div>

      {/* compatibility filter: check each skill against a robot's policy + budget */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted mr-1">Compatible with</span>
        <Chip active={robotId === 'none'} onClick={() => setRobotId('none')}>Any robot</Chip>
        {state.robots.map((r) => (
          <Chip key={r.id} active={robotId === r.id} onClick={() => setRobotId(r.id)}>{r.name}</Chip>
        ))}
      </div>

      <div className="text-[11px] font-mono text-muted">
        showing {shown.length} of {skills.length} skills
        {activeRobot && ` · ${shown.filter((s) => compatibilityFor(s, activeRobot).ok === true).length} run on ${activeRobot.name}`}
      </div>

      {/* skill grid */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s)}
            className="text-left rounded-2xl border border-edge bg-panel p-4 hover:border-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{s.name}</div>
                <div className="text-xs text-muted truncate">{s.vendor}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-lg">{money(s.price)}</div>
                <div className="text-[10px] text-muted">{s.pricingModel}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-panel2 overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${Math.round(s.successRate * 100)}%` }} />
                </div>
              </div>
              <span className="text-[11px] font-mono text-accent">{Math.round(s.successRate * 100)}%</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Tag>{CAP_LABEL[s.capability] || s.capability}</Tag>
              {s.vendorVerified === false ? (
                <Tag tone="danger">unverified</Tag>
              ) : (
                <Tag tone="accent">verified</Tag>
              )}
              {s.category === 'teleop' && <Tag tone="warn">human</Tag>}
              {(s.requiredHardware || []).length > 0 && <Tag tone="warn">needs hardware</Tag>}
            </div>

            {activeRobot && (() => {
              const c = compatibilityFor(s, activeRobot);
              const tone = c.ok === true ? 'accent' : c.ok === 'flag' || c.ok === 'budget' ? 'warn' : 'danger';
              const label =
                c.ok === true ? `✓ runs on ${activeRobot.name}` : `✕ ${c.reason} on ${activeRobot.name}`;
              return (
                <div className={`mt-2 border-t border-edge pt-2 text-[11px] font-mono ${
                  tone === 'accent' ? 'text-accent' : tone === 'warn' ? 'text-warn' : 'text-danger'
                }`}>
                  {label}
                </div>
              );
            })()}
          </button>
        ))}
      </div>

      {selected && <SkillDetail skill={selected} tasks={tasksFor(selected.capability)} onClose={() => setSelected(null)} />}
    </div>
  );
}

function SkillDetail({ skill, tasks, onClose }) {
  const risk = skill.riskLevel || 'low';
  const verified = skill.vendorVerified !== false;
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-edge bg-panel overflow-hidden rise-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-edge bg-panel2 px-5 py-4">
          <div>
            <div className="text-lg font-semibold">{skill.name}</div>
            <div className="text-xs text-muted">{skill.vendor} · {skill.id}</div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-3 font-mono">
            <Stat label="Price" v={money(skill.price)} />
            <Stat label="Billing" v={skill.pricingModel} />
            <Stat label="Success" v={`${Math.round(skill.successRate * 100)}%`} accent />
          </div>

          <Spec k="Capability provided" v={CAP_LABEL[skill.capability] || skill.capability} />
          <Spec k="Accounting category" v={CATEGORY_LABEL[skill.category] || skill.category} />
          <Spec k="Vendor status" v={verified ? '✓ Verified vendor' : '⚠ Unverified vendor'} tone={verified ? 'accent' : 'danger'} />
          <Spec k="Risk level" v={risk} tone={risk === 'high' ? 'danger' : risk === 'medium' ? 'warn' : 'accent'} />
          <Spec k="Required hardware" v={(skill.requiredHardware || []).length ? skill.requiredHardware.join(', ') : 'none'} />
          <Spec k="Certifications" v={(skill.certifications || []).length ? skill.certifications.join(', ') : 'none'} />
          <Spec k="Requested permissions" v={(skill.requestedPermissions || []).length ? skill.requestedPermissions.join(', ') : 'standard'} tone={(skill.requestedPermissions || []).some((p) => p.includes('unrestricted')) ? 'danger' : undefined} />

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Resolves these tasks</div>
            {tasks.length ? (
              <ul className="space-y-1">
                {tasks.map((t) => (
                  <li key={t.id} className="text-sm text-white/85">• {t.description}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted">—</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const Kpi = ({ label, v }) => (
  <div className="rounded-xl border border-edge bg-panel px-5 py-3">
    <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    <div className="font-mono text-xl font-bold">{v}</div>
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
const Tag = ({ children, tone = 'edge' }) => {
  const tones = {
    edge: 'bg-panel2 text-muted border-edge',
    accent: 'bg-accent/10 text-accent border-accent/30',
    danger: 'bg-danger/10 text-danger border-danger/40',
    warn: 'bg-warn/10 text-warn border-warn/40',
  };
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-mono ${tones[tone]}`}>{children}</span>;
};
const Stat = ({ label, v, accent }) => (
  <div className="rounded-lg border border-edge bg-panel2 px-3 py-2">
    <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    <div className={accent ? 'text-accent' : 'text-white'}>{v}</div>
  </div>
);
const Spec = ({ k, v, tone }) => {
  const c = tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : tone === 'accent' ? 'text-accent' : 'text-white/85';
  return (
    <div className="flex items-center justify-between border-b border-edge/60 pb-1.5">
      <span className="text-xs uppercase tracking-wider text-muted">{k}</span>
      <span className={`text-sm font-mono ${c}`}>{v}</span>
    </div>
  );
};
