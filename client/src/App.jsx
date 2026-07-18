import React, { useEffect, useState, useCallback } from 'react';
import { getState, reset as resetState } from './api.js';
import SavingsCounter from './components/SavingsCounter.jsx';
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
  const [resetCount, setResetCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setState(await getState());
    } catch (_) {
      // Server not up yet — keep prior state, never crash.
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleReset = async () => {
    await resetState();
    await refresh();
    // Remount LiveRun so the stage returns to script defaults: cleared
    // timeline, task-01 + Atlas-7 selected, failure sim off.
    setResetCount((n) => n + 1);
  };

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
            <div className="text-[11px] text-muted mt-0.5">Spend infrastructure for autonomous machines</div>
          </div>
          <SavingsCounter value={state.totalSaved} />
        </div>

        {/* tabs */}
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.id ? 'text-accent' : 'text-muted hover:text-white'
                }`}
              >
                {t.label}
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
