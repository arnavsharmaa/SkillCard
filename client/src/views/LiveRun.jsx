import React, { useEffect, useRef, useState } from 'react';
import { runTask as runTaskStream, money } from '../api.js';
import StageTimeline from '../components/StageTimeline.jsx';
import ReceiptCard from '../components/ReceiptCard.jsx';
import OperatorConsole from '../components/OperatorConsole.jsx';
import RobotAvatar from '../components/RobotAvatar.jsx';

export default function LiveRun({ state, onComplete }) {
  const [selectedTask, setSelectedTask] = useState('task-01');
  const [selectedRobot, setSelectedRobot] = useState('rbt-01');
  const [simulateFail, setSimulateFail] = useState(false);
  const [stages, setStages] = useState([]);
  const [running, setRunning] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [escalation, setEscalation] = useState(null); // { escalationId, task, robotName }
  const [notice, setNotice] = useState(null);

  const task = state.tasks.find((t) => t.id === selectedTask);

  // Follow the stream: keep the newest stage (and finally the receipt) in view
  // so the presenter never has to scroll mid-run.
  const bottomRef = useRef(null);
  useEffect(() => {
    if (running || receipt) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [stages.length, receipt, running]);

  const run = () => {
    setStages([]);
    setReceipt(null);
    setEscalation(null);
    setNotice(null);
    setRunning(true);

    runTaskStream(
      selectedTask,
      selectedRobot,
      {
        onStage: (s) => {
          setStages((prev) => [...prev, s]);
          if (s.stage === 'RECEIPT' && s.receipt) setReceipt(s.receipt);
        },
        onDone: (d) => {
          setRunning(false);
          if (d.needsOperator) {
            setEscalation({ escalationId: d.escalationId, task: d.task, robotName: d.robot?.name });
          }
          onComplete?.(d);
        },
        onError: () => {
          setRunning(false);
          setNotice('That run hit a snag — press Run Task to try again.');
        },
      },
      850,
      simulateFail
    );
  };

  const onOperatorResolved = (result) => {
    setReceipt(result.receipt);
    onComplete?.(result);
  };

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      {/* control column */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-edge bg-panel p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3">Task queue</div>
          <div className="space-y-2">
            {state.tasks.map((t) => (
              <button
                key={t.id}
                disabled={running}
                onClick={() => setSelectedTask(t.id)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  selectedTask === t.id ? 'border-accent bg-accent/5' : 'border-edge bg-panel2 hover:border-muted/40'
                } ${running ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="text-sm text-white/90 leading-snug">{t.description}</div>
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-mono text-muted">
                  <span className="whitespace-nowrap text-accent">{money(t.taskValue)} value</span>
                  <span className="whitespace-nowrap">· {t.difficulty}</span>
                  <span className="whitespace-nowrap">· needs {t.requiredCapability}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-edge bg-panel p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3">Run as robot</div>
          <div className="grid grid-cols-3 gap-2">
            {state.robots.map((r) => (
              <button
                key={r.id}
                disabled={running}
                onClick={() => setSelectedRobot(r.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-mono transition-colors ${
                  selectedRobot === r.id ? 'border-accent bg-accent/5 text-accent' : 'border-edge bg-panel2 text-muted hover:border-muted/40'
                }`}
              >
                <RobotAvatar type={r.type} size={30} className={selectedRobot === r.id ? 'text-accent' : 'text-muted'} />
                {r.name}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={run}
          disabled={running}
          className={`w-full rounded-2xl py-5 text-lg font-bold tracking-wide transition-all ${
            running
              ? 'bg-panel2 text-muted cursor-not-allowed'
              : 'bg-accent text-ink hover:brightness-110 pulse-ring'
          }`}
        >
          {running ? 'Running…' : '▶  Run Task'}
        </button>

        {/* Demo control: force the purchased skill to fail so the robot
            escalates to a human operator. */}
        <label className={`flex items-center gap-2.5 rounded-xl border border-edge bg-panel px-4 py-3 text-sm ${running ? 'opacity-60' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            checked={simulateFail}
            disabled={running}
            onChange={(e) => setSimulateFail(e.target.checked)}
            className="h-4 w-4 accent-warn"
          />
          <span className="text-white/85">Simulate skill failure</span>
          <span className="ml-auto text-[11px] text-muted">→ human escalation</span>
        </label>
        {notice && <div className="text-xs text-warn text-center">{notice}</div>}
      </div>

      {/* timeline column */}
      <div className="min-h-[400px]">
        {stages.length === 0 && !running && (
          <div className="h-full rounded-2xl border border-dashed border-edge grid place-items-center text-center p-10">
            <div>
              <div className="text-5xl mb-3">🤖</div>
              <div className="text-lg font-semibold">Press Run Task</div>
              <p className="text-sm text-muted mt-1 max-w-sm">
                Watch the agent diagnose the failure, shop the marketplace, reason about the economics,
                clear policy, buy the skill, and retry — in about 20 seconds.
              </p>
            </div>
          </div>
        )}

        {stages.length > 0 && <StageTimeline stages={stages} live={running} />}

        {escalation && !receipt && (
          <div className="mt-2 max-w-xl">
            <OperatorConsole
              escalationId={escalation.escalationId}
              task={escalation.task}
              robotName={escalation.robotName}
              onResolved={onOperatorResolved}
            />
          </div>
        )}

        {receipt && (
          <div className="mt-2 max-w-xl">
            <ReceiptCard r={receipt} fresh />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
