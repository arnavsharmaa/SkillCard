// SkillCard server — Express + SSE stream for the core loop, with SQLite
// persistence so state survives restarts. No auth.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { seedRobots, seedTasks, seedMarketplace } from './seed.js';
import { runTask, resolveWithOperator, finalizePurchase } from './loop.js';
import { MODEL } from './openai.js';
import { loadState, saveState, closeStore } from './store.js';

const app = express();
app.use(cors());
app.use(express.json());

// Request log: method, path, status, duration. Silenced in tests (RUN_STUBBED)
// and skipped for health polls to keep the log signal-heavy.
if (process.env.RUN_STUBBED !== '1') {
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`);
    });
    next();
  });
}

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
  lastSource: null, // 'openai' | 'fallback' | 'stub' — how the last run reasoned
};

// Rehydrate the durable slice from disk if we've run before.
const persisted = loadState();
if (persisted) Object.assign(state, persisted);

// Persist the durable slice after any mutation.
const persist = () => saveState(state);

// ---- Read endpoints -------------------------------------------------------
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, model: MODEL, hasKey: !!process.env.OPENAI_API_KEY, lastSource: state.lastSource })
);

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

// ---- Finance review: acknowledge a flagged receipt ------------------------
app.post('/api/receipts/:id/acknowledge', (req, res) => {
  const receipt = state.receipts.find((r) => r.id === req.params.id);
  if (!receipt) return res.status(404).json({ error: 'Receipt not found.' });
  receipt.acknowledged = true;
  receipt.acknowledgedAt = '2026-08-14';
  persist();
  res.json({ ok: true, receipt });
});

// ---- Settlement: batch all unsettled charges into vendor payouts -----------
app.post('/api/settle', (_req, res) => {
  const unsettled = state.receipts.filter((r) => !r.settled);
  const byVendor = {};
  for (const r of unsettled) {
    const v = r.skill.vendor;
    byVendor[v] = byVendor[v] || { vendor: v, amount: 0, count: 0 };
    byVendor[v].amount += r.cost;
    byVendor[v].count += 1;
    r.settled = true;
    r.settledAt = '2026-08-14';
  }
  const payouts = Object.values(byVendor).sort((a, b) => b.amount - a.amount);
  persist();
  res.json({ settledCount: unsettled.length, total: payouts.reduce((a, p) => a + p.amount, 0), payouts });
});

// ---- Reset ----------------------------------------------------------------
app.post('/api/reset', (_req, res) => {
  state.robots = seedRobots();
  state.tasks = seedTasks();
  state.marketplace = seedMarketplace();
  state.receipts = [];
  state.totalSaved = 0;
  state.pendingEscalations = {};
  state.pendingApprovals = {};
  state.generation += 1; // any run started before now is now stale
  state.lastSource = null;
  persist();
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
  persist();
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
  const skillId = req.body?.skillId;
  if (typeof skillId !== 'string' || !skillId) {
    return res.status(400).json({ error: 'Body must include a "skillId" string.' });
  }
  applyFinalize(res, req.params.receiptId, skillId, 'operator');
});

// Human authorizes a budget override to buy the over-budget skill anyway.
app.post('/api/override/:receiptId', (req, res) => {
  const pending = state.pendingApprovals[req.params.receiptId];
  if (!pending) return res.status(404).json({ error: 'No pending override.' });
  applyFinalize(res, req.params.receiptId, pending.chosen.id, 'budget-override');
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
  persist();
  res.json({ receipt, netSaved, totalSaved: state.totalSaved, robot });
});

// ---- The core loop as an SSE stream ---------------------------------------
// GET /api/run/:taskId?robotId=rbt-01 — streams each stage as it happens.
app.get('/api/run/:taskId', async (req, res) => {
  // Validate inputs BEFORE opening the stream so bad requests get a real 4xx.
  const task = state.tasks.find((t) => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: `Unknown task "${req.params.taskId}".` });
  const robot = req.query.robotId != null
    ? state.robots.find((r) => r.id === req.query.robotId)
    : state.robots[0];
  if (!robot) return res.status(404).json({ error: `Unknown robot "${req.query.robotId}".` });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send('start', { task, robot: { id: robot.id, name: robot.name } });

  // Snapshot the generation. If a Reset happens while this run is streaming, the
  // generation changes and we discard this run's effects so it can't pollute the
  // freshly-reset state (the cause of "budget still spent after reset").
  const gen = state.generation;

  try {
    const result = await runTask(
      { task, robot, marketplace: state.marketplace, simulateFailure: req.query.fail === '1' },
      (stage) => {
        // Record how the reasoning stages resolved (live model vs fallback).
        if ((stage.stage === 'DIAGNOSE' || stage.stage === 'REASON') && stage.source) {
          state.lastSource = stage.source;
        }
        send('stage', stage);
      },
      // Honor an explicit delay, including 0 (`|| 900` would have treated 0 as unset).
      req.query.delay != null && !Number.isNaN(Number(req.query.delay)) ? Number(req.query.delay) : 900
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

    if (result.needsOverride) {
      // Every viable skill is over budget — park it; client shows override modal.
      const o = result.override;
      state.pendingApprovals[o.receiptId] = o;
      send('done', {
        purchased: false,
        needsOverride: true,
        override: o,
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
    persist();
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

// ---- JSON fallthroughs: the API never returns HTML error pages -------------
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown endpoint.' }));
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
app.use((err, _req, res, _next) => {
  console.error('[API error]', err);
  res.status(500).json({ error: 'Internal error.' });
});

const httpServer = app.listen(PORT, () => {
  console.log(`\n  SkillCard  ·  API on http://localhost:${PORT}  ·  UI on http://localhost:5173`);
  console.log(`  Model: ${MODEL}  |  API key: ${process.env.OPENAI_API_KEY ? 'set (live gpt-4o)' : 'MISSING (using canned fallbacks)'}\n`);
});

// Graceful shutdown: persist, flush the SQLite WAL, stop accepting connections.
// A short force-exit timer covers a stuck close (e.g. an open SSE stream).
function shutdown(signal) {
  console.log(`\n[server] ${signal} — shutting down`);
  try {
    persist();
    closeStore();
  } catch {}
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
