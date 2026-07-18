import React from 'react';
import { money } from '../api.js';

const STAGE_META = {
  ATTEMPT: { n: 1, label: 'Attempt' },
  DIAGNOSE: { n: 2, label: 'Diagnose' },
  SHOP: { n: 3, label: 'Shop' },
  REASON: { n: 4, label: 'Reason' },
  POLICY: { n: 5, label: 'Policy' },
  PURCHASE: { n: 6, label: 'Purchase' },
  RETRY: { n: 7, label: 'Retry' },
  RECEIPT: { n: 8, label: 'Receipt' },
};

const statusDot = {
  ok: 'bg-accent',
  fail: 'bg-danger',
  warn: 'bg-warn',
  pending: 'bg-edge',
};

function Chip({ children, tone = 'edge' }) {
  const tones = {
    edge: 'bg-panel2 text-muted border-edge',
    accent: 'bg-accent/10 text-accent border-accent/30',
    danger: 'bg-danger/10 text-danger border-danger/40',
    warn: 'bg-warn/10 text-warn border-warn/40',
  };
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-[11px] font-mono ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Renders the body of a single stage based on its type.
function StageBody({ s }) {
  switch (s.stage) {
    case 'ATTEMPT':
      return (
        <div className="space-y-2">
          <p className="text-sm text-white/80">{s.text}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
            <Telemetry label="grasp force" v={`${s.telemetry.grasp_force_N} N`} />
            <Telemetry label="depth conf" v={s.telemetry.depth_confidence} bad={Number(s.telemetry.depth_confidence) < 0.35} />
            <Telemetry label="retries" v={s.telemetry.retry_count} />
            <Telemetry label="error" v={s.telemetry.error_code} bad />
          </div>
        </div>
      );

    case 'DIAGNOSE':
      return (
        <div className="space-y-2">
          <p className="text-[15px] leading-relaxed text-white">{s.text}</p>
          <div className="flex flex-wrap gap-2">
            <Chip tone="accent">missing: {s.missing_capability}</Chip>
            <Chip>confidence {Math.round((s.confidence || 0) * 100)}%</Chip>
            <SourceChip source={s.source} />
          </div>
        </div>
      );

    case 'SHOP':
      return (
        <div className="space-y-2">
          <p className="text-sm text-white/80">{s.text}</p>
          <div className="flex flex-wrap gap-2">
            {s.candidates.map((c) => (
              <span key={c.id} className="rounded border border-edge bg-panel2 px-2 py-1 text-[11px] font-mono">
                {c.name} <span className="text-muted">· ${c.price} · {Math.round(c.successRate * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      );

    case 'REASON':
      return (
        <div className="space-y-3">
          <p className="text-[15px] leading-relaxed text-white">{s.text}</p>
          <div className="flex flex-wrap gap-2">
            <Chip tone="accent">chose: {s.chosen_skill?.name}</Chip>
            <SourceChip source={s.source} />
          </div>
          {s.rejected?.length > 0 && (
            <div className="space-y-1 border-l-2 border-edge pl-3">
              <div className="text-[11px] uppercase tracking-wider text-muted">Rejected</div>
              {s.rejected.map((r, i) => (
                <p key={i} className="text-xs text-muted">
                  <span className="text-white/60 font-mono">{r.skill_id}</span> — {r.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      );

    case 'POLICY': {
      const hasBlock = s.blocked?.length > 0;
      const resolved = s.decision !== 'block'; // a fallback (or clean pick) survived policy
      const verdictChips = (
        <div className="flex flex-wrap items-center gap-2">
          {s.decision === 'approve' && <Chip tone="accent">AUTO-APPROVED</Chip>}
          {s.decision === 'flag' && <Chip tone="warn">FLAGGED FOR APPROVAL</Chip>}
          {s.reasons?.map((r, i) => (
            <span key={i} className="text-xs text-muted">{r}</span>
          ))}
        </div>
      );
      return (
        <div className="space-y-3">
          {hasBlock && (
            <div className="blocked-card rounded-xl border-2 border-danger bg-danger/15 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-danger/80 mb-1.5">
                Policy violation
              </div>
              <div className="text-danger font-black text-lg sm:text-xl leading-tight mb-1.5">
                ⛔ BLOCKED — {s.blocked[0].skill.name}
              </div>
              {s.blocked[0].reasons.map((r, i) => (
                <p key={i} className="text-sm font-medium text-danger/90">{r}</p>
              ))}
            </div>
          )}
          {hasBlock && resolved ? (
            <div
              className={`fallback-resolve flex items-start gap-2.5 rounded-xl border p-3.5 ${
                s.decision === 'flag' ? 'border-warn/50 bg-warn/10' : 'border-accent/50 bg-accent/10'
              }`}
            >
              <span className={`mt-0.5 text-lg leading-none ${s.decision === 'flag' ? 'text-warn' : 'text-accent'}`}>↳</span>
              <div className="space-y-2">
                <p className={`text-[15px] font-medium ${s.decision === 'flag' ? 'text-warn' : 'text-accent'}`}>
                  {s.text}
                </p>
                {verdictChips}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className={`text-sm ${
                s.decision === 'approve' ? 'text-accent' : s.decision === 'flag' ? 'text-warn' : 'text-danger font-semibold'
              }`}>
                {s.text}
              </p>
              {verdictChips}
            </div>
          )}
        </div>
      );
    }

    case 'PURCHASE':
      return (
        <div className="space-y-2">
          <p className="text-sm text-white/80">{s.text}</p>
          <div className="flex flex-wrap gap-2 font-mono text-[11px]">
            <Chip tone="accent">−{money(s.amount)}</Chip>
            <Chip>spent {money(s.spent)}</Chip>
            <Chip>remaining {money(s.remaining)}</Chip>
          </div>
        </div>
      );

    case 'RETRY':
      return (
        <div className="flex items-center gap-2">
          <span className="text-accent text-lg">✓</span>
          <p className="text-sm text-white">{s.text}</p>
        </div>
      );

    case 'RECEIPT':
      return <p className="text-sm text-white/80">{s.text}</p>;

    default:
      return <p className="text-sm text-white/80">{s.text}</p>;
  }
}

function Telemetry({ label, v, bad }) {
  return (
    <div className="rounded border border-edge bg-panel2 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`font-mono ${bad ? 'text-danger' : 'text-white'}`}>{v}</div>
    </div>
  );
}

function SourceChip({ source }) {
  if (source === 'openai') return <Chip tone="accent">gpt-4o</Chip>;
  if (source === 'fallback' || source === 'stub') return <Chip>offline reasoning</Chip>;
  return null;
}

export default function StageTimeline({ stages, live = false }) {
  return (
    <div className="relative">
      {stages.map((s, i) => {
        const meta = STAGE_META[s.stage] || { n: i + 1, label: s.stage };
        const last = i === stages.length - 1;
        const active = live && last;
        return (
          <div key={i} className="relative flex gap-4">
            {/* rail */}
            <div className="flex flex-col items-center">
              <div
                className={`pop-in relative mt-1 h-8 w-8 shrink-0 rounded-full border border-edge flex items-center justify-center font-mono text-sm font-bold ${
                  statusDot[s.status] || 'bg-edge'
                } ${s.status === 'ok' ? 'text-ink' : 'text-white'}`}
              >
                {active && <span className="live-ring absolute inset-0 rounded-full" />}
                {meta.n}
              </div>
              {!last && <div className="draw-down w-px flex-1 bg-edge my-1" />}
            </div>
            {/* body */}
            <div className="stage-in flex-1 pb-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs uppercase tracking-[0.18em] text-muted">{meta.label}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot[s.status]} ${active ? 'animate-pulse' : ''}`} />
              </div>
              <div className="rounded-xl border border-edge bg-panel p-4">
                <div className="text-[15px] font-semibold text-white/90 mb-2">{s.title}</div>
                <StageBody s={s} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
