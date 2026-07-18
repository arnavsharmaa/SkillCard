// SkillCard server — Express + in-memory state + SSE stream for the core loop.
// No DB, no auth, no persistence. State resets on restart.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { seedRobots, seedTasks, seedMarketplace } from './seed.js';
import { runTask, resolveWithOperator, finalizePurchase } from './loop.js';
import { MODEL } from './openai.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ---- In-memory state: a plain object. -------------------------------------
const state = {
  robots: seedRobots(),
  tasks: seedTasks(),
  marketplace: seedMarketplace(),
  receipts: [],
  totalSaved: 0,
  pendingEscalations: {}, // escalationId -> { escalation, robotId }
  pendingApprovals: {}, // receiptId -> approval context awaiting a human decision
  generation: 0, // bumped on reset; a run started before a reset is discarded
};

// ---- Read endpoints -------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true, model: MODEL, hasKey: !!process.env.OPENAI_API_KEY }));

app.get('/api/state', (_req, res) => {
  res.json({
    robots: state.robots,
    tasks: state.tasks,
    marketplace: state.marketplace,
    receipts: state.receipts,
    totalSaved: state.totalSaved,
  });
});

app.get('/api/receipts', (_req, res) => res.json(state.receipts));

// ---- Reset (handy between demo runs) --------------------------------------
app.post('/api/reset', (_req, res) => {
  state.robots = seedRobots();
  state.tasks = seedTasks();
  state.marketplace = seedMarketplace();
  state.receipts = [];
  state.totalSaved = 0;
  state.pendingEscalations = {};
  state.pendingApprovals = {};
  state.generation += 1; // any run started before now is now stale
  res.json({ ok: true });
});

// ---- Human decisions on a flagged (over-ceiling) purchase -----------------
function applyFinalize(res, receiptId, chosenId, approvedBy) {
  const pending = state.pendingApprovals[receiptId];
  if (!pending) return res.status(404).json({ error: 'No pending approval.' });
  const robot = state.robots.find((r) => r.id === pending.robotId);
  const task = state.tasks.find((t) => t.id === pending.taskId);
  const chosen = state.marketplace.find((s) => s.id === chosenId);
  if (!robot || !task || !chosen) return res.status(400).json({ error: 'Bad approval context.' });
  const { receipt, netSaved, stages } = finalizePurchase(task, robot, chosen, {
    receiptId,
    diagnosis: pending.diagnosis,
    rejected: pending.rejected,
    fallbackChain: pending.fallbackChain,
    approvedBy,
  });
  state.receipts.unshift(receipt);
  state.totalSaved += netSaved;
  delete state.pendingApprovals[receiptId];
  res.json({ receipt, netSaved, stages, totalSaved: state.totalSaved, robot });
}

// Approve the flagged (over-ceiling) skill as-is.
app.post('/api/approve/:receiptId', (req, res) => {
  const pending = state.pendingApprovals[req.params.receiptId];
  if (!pending) return res.status(404).json({ error: 'No pending approval.' });
  applyFinalize(res, req.params.receiptId, pending.chosen.id, 'human');
});

// Human picks a different skill from the marketplace instead.
app.post('/api/skill-choice/:receiptId', (req, res) => {
  applyFinalize(res, req.params.receiptId, req.body.skillId, 'operator');
});

// ---- Operator console finalizes an escalated task -------------------------
app.post('/api/operator/:escalationId', (req, res) => {
  const pending = state.pendingEscalations[req.params.escalationId];
  if (!pending) return res.status(404).json({ error: 'No pending escalation.' });
  const robot = state.robots.find((r) => r.id === pending.robotId);
  const { receipt, netSaved } = resolveWithOperator(pending.escalation, robot);
  state.receipts.unshift(receipt);
  state.totalSaved += netSaved;
  delete state.pendingEscalations[req.params.escalationId];
  res.json({ receipt, netSaved, totalSaved: state.totalSaved, robot });
});

// ---- The core loop as an SSE stream ---------------------------------------
// GET /api/run/:taskId?robotId=rbt-01 — streams each stage as it happens.
app.get('/api/run/:taskId', async (req, res) => {
  const task = state.tasks.find((t) => t.id === req.params.taskId);
  const robot =
    state.robots.find((r) => r.id === req.query.robotId) || state.robots[0];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  if (!task) {
    send('error', { message: 'Task not found' });
    return res.end();
  }

  send('start', { task, robot: { id: robot.id, name: robot.name } });

  // Snapshot the generation. If a Reset happens while this run is streaming, the
  // generation changes and we discard this run's effects so it can't pollute the
  // freshly-reset state (the cause of "budget still spent after reset").
  const gen = state.generation;

  try {
    const result = await runTask(
      { task, robot, marketplace: state.marketplace, simulateFailure: req.query.fail === '1' },
      (stage) => send('stage', stage),
      Number(req.query.delay) || 900
    );

    if (gen !== state.generation) {
      // Superseded by a reset — drop everything, don't touch state.
      send('done', { purchased: false, superseded: true, totalSaved: state.totalSaved });
      return res.end();
    }

    if (result.needsApproval) {
      // Park the approval context; the client shows an approve/choose modal.
      const a = result.approval;
      state.pendingApprovals[a.receiptId] = a;
      send('done', {
        purchased: false,
        needsApproval: true,
        approval: a,
      });
      return res.end();
    }

    if (result.needsOperator) {
      // Park the escalation context so the operator console can finalize it.
      const escId = result.escalation.receiptBase.id;
      state.pendingEscalations[escId] = { escalation: result.escalation, robotId: robot.id };
      send('done', {
        purchased: true,
        needsOperator: true,
        escalationId: escId,
        task: { id: task.id, description: task.description },
        robot: state.robots.find((r) => r.id === robot.id),
        totalSaved: state.totalSaved,
      });
      return res.end();
    }

    if (result.purchased && result.receipt) {
      state.receipts.unshift(result.receipt);
      state.totalSaved += result.netSaved;
    }
    send('done', {
      purchased: result.purchased,
      totalSaved: state.totalSaved,
      robot: state.robots.find((r) => r.id === robot.id),
    });
  } catch (err) {
    // Never surface a raw error to the UI — send a clean, friendly signal.
    console.error('[RUN error]', err);
    send('error', { message: 'The run hit a snag. Please try again.' });
  }
  res.end();
});

app.listen(PORT, () => {
  console.log(`\n  SkillCard server on http://localhost:${PORT}`);
  console.log(`  Model: ${MODEL}  |  API key: ${process.env.OPENAI_API_KEY ? 'set' : 'MISSING (using canned fallbacks)'}\n`);
});
