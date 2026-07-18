import React, { useState } from 'react';
import { resolveWithOperator } from '../api.js';

// Single-laptop human-in-the-loop console. When the purchased skill fails, the
// robot escalates here. An approved operator takes time-boxed control, resolves
// the task, and access is revoked — every action logged.
export default function OperatorConsole({ escalationId, task, robotName, onResolved }) {
  const [phase, setPhase] = useState('ready'); // ready -> working -> done -> error
  const [revoked, setRevoked] = useState(false);

  const takeControl = async () => {
    setPhase('working');
    // Brief "operator resolving" beat, then finalize server-side.
    await new Promise((r) => setTimeout(r, 1800));
    try {
      const result = await resolveWithOperator(escalationId);
      setPhase('done');
      setTimeout(() => setRevoked(true), 700);
      onResolved?.(result);
    } catch (_) {
      setPhase('error');
    }
  };

  return (
    <div className="rounded-2xl border-2 border-warn/60 bg-warn/5 overflow-hidden rise-in">
      <div className="flex items-center justify-between border-b border-warn/40 bg-warn/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-warn text-lg">🎮</span>
          <div>
            <div className="text-sm font-semibold text-warn">Operator Console</div>
            <div className="text-[10px] font-mono text-warn/70">
              RemoteAssist (approved vendor) · time-boxed · all actions recorded
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-warn/80">
          {phase === 'done' ? (revoked ? 'access revoked' : 'session ending…') : 'live session'}
        </span>
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="rounded-xl border border-edge bg-panel2 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">Escalated task · {robotName}</div>
          <div className="text-sm text-white/90">{task?.description}</div>
        </div>

        {phase === 'ready' && (
          <button
            onClick={takeControl}
            className="w-full rounded-xl bg-warn py-3.5 font-bold text-ink hover:brightness-110 transition"
          >
            🕹  Take control &amp; resolve
          </button>
        )}

        {phase === 'working' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-warn">
              <span className="h-2 w-2 rounded-full bg-warn animate-ping" />
              Operator has control — guiding the arm to the target…
            </div>
            <div className="h-2 rounded-full bg-panel2 overflow-hidden">
              <div className="h-full bg-warn animate-[riseIn_1.6s_ease-in-out]" style={{ width: '100%' }} />
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-accent font-semibold">
              <span className="text-lg">✓</span> Task resolved by operator
            </div>
            <div className="text-xs text-muted">
              Session closed. Operator access {revoked ? 'revoked' : 'being revoked'} · a $55 operator charge was
              attached to this task record. Receipt filed below.
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="text-sm text-warn">Couldn't reach the operator service — press Run Task to retry.</div>
        )}
      </div>
    </div>
  );
}
