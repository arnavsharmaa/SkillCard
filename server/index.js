// SkillCard server — Express + in-memory state + SSE stream for the core loop.
// No DB, no auth, no persistence. State resets on restart.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { seedRobots, seedTasks, seedMarketplace } from './seed.js';
import { runTask } from './loop.js';
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
  res.json({ ok: true });
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

  try {
    const result = await runTask(
      { task, robot, marketplace: state.marketplace },
      (stage) => send('stage', stage),
      Number(req.query.delay) || 900
    );

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
