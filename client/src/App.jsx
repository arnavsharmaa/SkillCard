import React, { useEffect, useState, useCallback } from 'react';
import { getState, getHealth, reset as resetState } from './api.js';
import SavingsCounter from './components/SavingsCounter.jsx';
import ModelStatus from './components/ModelStatus.jsx';
import LiveRun from './views/LiveRun.jsx';
import Receipts from './views/Receipts.jsx';
import Fleet from './views/Fleet.jsx';
import Marketplace from './views/Marketplace.jsx';

const TABS = [
  { id: 'live', label: 'Live Run' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'fleet', label: 'Fleet' },
];

export default function App() {
  const [tab, setTab] = useState('live');
  const [state, setState] = useState(null);
  const [health, setHealth] = useState(null);
  const [resetCount, setResetCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([getState(), getHealth()]);
      setState(s);
      setHealth(h);
    } catch (_) {
      // Server not up yet — keep prior state, never crash.
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleReset = useCallback(async () => {
    await resetState();
    await refresh();
    // Remount LiveRun so the stage returns to script defaults: cleared
    // timeline, task-01 + Atlas-7 selected, failure sim off.
    setResetCount((n) => n + 1);
  }, [refresh]);

  // Presenter hotkeys: R = reset, 1-4 = switch tabs. (Enter = run lives in
  // LiveRun.) Ignored while typing in a field or with a modifier held.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.matches?.('input, textarea, select, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (k === 'r') handleReset();
      else if (k === '1') setTab('live');
      else if (k === '2') setTab('marketplace');
      else if (k === '3') setTab('receipts');
      else if (k === '4') setTab('fleet');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleReset]);

  if (!state) {
    return (
      <div className="h-full grid place-items-center text-muted">
        <div className="text-center">
          <div className="text-2xl font-bold text-accent mb-2">SkillCard</div>
          <div className="text-sm">Connecting to fleet…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* pinned header with the hero number */}
      <header className="sticky top-0 z-20 border-b border-edge bg-ink/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-accent text-ink grid place-items-center font-black">S</div>
              <span className="text-lg font-bold tracking-tight">SkillCard</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-muted">Spend infrastructure for autonomous machines</span>
              <ModelStatus health={health} />
            </div>
          </div>
          <SavingsCounter value={state.totalSaved} />
        </div>

        {/* tabs */}
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center gap-1">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={`${t.label} — press ${i + 1}`}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.id ? 'text-accent' : 'text-muted hover:text-white'
                }`}
              >
                {t.label}
                {t.id === 'receipts' && state.receipts.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-mono text-accent align-middle">
                    {state.receipts.length}
                  </span>
                )}
                {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-accent rounded-full" />}
              </button>
            ))}
            <button
              onClick={handleReset}
              className="ml-auto text-xs font-mono text-muted hover:text-white border border-edge rounded px-3 py-1.5"
            >
              ↺ Reset demo
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl w-full px-6 py-7 flex-1">
        {tab === 'live' && <LiveRun key={resetCount} state={state} onComplete={refresh} />}
        {tab === 'marketplace' && <Marketplace state={state} />}
        {tab === 'receipts' && <Receipts state={state} />}
        {tab === 'fleet' && <Fleet state={state} />}
      </main>
    </div>
  );
}
