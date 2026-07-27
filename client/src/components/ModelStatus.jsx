import React from 'react';

// At-a-glance proof of how the agent is reasoning right now. Reflects the ACTUAL
// last-run source, not just whether a key is configured — so if the live model
// ever drops to the canned fallback mid-demo, the presenter sees it here.
export default function ModelStatus({ health }) {
  if (!health) return null;

  // Before any run: keyed = ready to call the model; no key = canned fallbacks.
  let tone, dot, label;
  if (health.lastSource === 'openai') {
    tone = 'accent';
    dot = 'live';
    label = `${health.model} · live`;
  } else if (health.lastSource === 'fallback' || health.lastSource === 'stub') {
    tone = 'muted';
    dot = 'idle';
    label = 'offline reasoning';
  } else {
    // No run yet.
    tone = health.hasKey ? 'accent' : 'muted';
    dot = health.hasKey ? 'ready' : 'idle';
    label = health.hasKey ? `${health.model} · ready` : 'offline · canned';
  }

  const color = tone === 'accent' ? 'text-accent border-accent/40 bg-accent/10' : 'text-muted border-edge bg-panel2';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider ${color}`}
      title="How the DIAGNOSE and REASON stages resolved on the last run"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone === 'accent' ? 'bg-accent' : 'bg-muted'} ${dot === 'live' ? 'pulse-dot' : ''}`} />
      {label}
    </span>
  );
}
