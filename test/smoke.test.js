// End-to-end smoke test: boots the server on a scratch port with a scratch
// SQLite database, runs every seeded task through the loop, and asserts the
// governance invariants hold. Uses RUN_STUBBED=1 so it needs no API key and is
// deterministic. Run with `npm test`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'skillcard-test-'));
const DB_FILE = path.join(SCRATCH, 'test.db');

let server;

async function startServer() {
  const child = spawn('node', ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), RUN_STUBBED: '1', SKILLCARD_DB: DB_FILE },
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return child;
    } catch {}
    await sleep(250);
  }
  throw new Error('server did not start');
}

async function stopServer(child) {
  if (child && child.exitCode === null) {
    await new Promise((resolve) => {
      child.once('exit', resolve);
      child.kill();
    });
  }
}

before(async () => {
  server = await startServer();
});

after(async () => {
  await stopServer(server);
  fs.rmSync(SCRATCH, { recursive: true, force: true });
});

// Consume an SSE run and return its stages + the `done` payload.
async function runTask(taskId, robotId, extra = '') {
  const res = await fetch(`${BASE}/api/run/${taskId}?robotId=${robotId}&delay=0${extra}`);
  const text = await res.text();
  const stages = [];
  let done = null;
  let event = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) {
      const payload = JSON.parse(line.slice(5).trim());
      if (event === 'stage') stages.push(payload);
      if (event === 'done') done = payload;
      if (event === 'error') throw new Error(`run error: ${payload.message}`);
    }
  }
  return { stages, done };
}

const state = async () => (await fetch(`${BASE}/api/state`)).json();
const post = (p, body) =>
  fetch(`${BASE}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

test('health reports model, version, and uptime', async () => {
  const h = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(h.ok, true);
  assert.ok(h.model);
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(h.version, pkg.version);
  assert.ok(Number.isInteger(h.uptimeSec) && h.uptimeSec >= 0);
});

test('every seeded task completes the loop or pauses for a human decision', async () => {
  await post('/api/reset');
  const { tasks, robots } = await state();
  assert.equal(tasks.length, 5);
  assert.equal(robots.length, 3);

  for (const task of tasks) {
    const { stages, done } = await runTask(task.id, 'rbt-02');
    const names = stages.map((s) => s.stage);
    assert.ok(names.includes('ATTEMPT') && names.includes('DIAGNOSE') && names.includes('POLICY'), `${task.id}: core stages`);
    // Either finished with a receipt, or paused for approval/override.
    const finished = names.includes('RECEIPT') && stages.at(-1).receipt;
    const paused = done?.needsApproval || done?.needsOverride;
    assert.ok(finished || paused, `${task.id}: should finish or pause, got ${names.join('→')}`);
    if (paused) await post(done.needsApproval ? `/api/approve/${done.approval.receiptId}` : `/api/override/${done.override.receiptId}`);
  }

  const s = await state();
  assert.equal(s.receipts.length, 5, 'one receipt per task');
  assert.ok(s.totalSaved > 0, 'savings accrue');
});

test('policy hard-blocks teleop for the autonomous unit and falls back', async () => {
  await post('/api/reset');
  const { stages } = await runTask('task-01', 'rbt-01');
  const policy = stages.find((s) => s.stage === 'POLICY');
  assert.ok(policy.blocked?.length > 0, 'something was blocked');
  assert.ok(policy.blocked.some((b) => b.skill.category === 'teleop'), 'the teleop option was blocked');
  assert.notEqual(policy.chosen_skill.category, 'teleop', 'fallback is not teleop');
  const receipt = stages.at(-1).receipt;
  assert.equal(receipt.netSaved, receipt.humanBaseline - receipt.cost, 'net saved = baseline − cost');
});

test('unverified / over-permissioned skills are badged blocked in SHOP', async () => {
  await post('/api/reset');
  const { stages } = await runTask('task-01', 'rbt-01');
  const shop = stages.find((s) => s.stage === 'SHOP');
  const sketchy = shop.candidates.find((c) => c.vendorVerified === false);
  assert.ok(sketchy, 'the unverified vendor skill is a candidate');
  assert.equal(sketchy.policyBadge, 'block');
});

test('over-ceiling purchase pauses for approval and resumes on approve', async () => {
  await post('/api/reset');
  const { done } = await runTask('task-03', 'rbt-02');
  assert.equal(done.needsApproval, true);
  const r = await (await post(`/api/approve/${done.approval.receiptId}`)).json();
  assert.equal(r.receipt.policyDecision, 'human-approved');
  assert.ok(r.stages.some((s) => s.stage === 'RECEIPT'));
});

test('over-budget purchase requires an override', async () => {
  await post('/api/reset');
  const { done } = await runTask('task-03', 'rbt-03');
  assert.equal(done.needsOverride, true);
  const r = await (await post(`/api/override/${done.override.receiptId}`)).json();
  assert.equal(r.receipt.policyDecision, 'budget-override');
  assert.ok(r.robot.spent > r.robot.monthlyBudget, 'robot is now over budget');
});

test('failed skill escalates to an operator and both charges land on one receipt', async () => {
  await post('/api/reset');
  const { done } = await runTask('task-01', 'rbt-01', '&fail=1');
  assert.equal(done.needsOperator, true);
  const r = await (await post(`/api/operator/${done.escalationId}`)).json();
  assert.equal(r.receipt.outcome, 'resolved by operator');
  assert.equal(r.receipt.cost, r.receipt.skillCost + r.receipt.operatorCost);
  // Double-finalize must be rejected.
  assert.equal((await post(`/api/operator/${done.escalationId}`)).status, 404);
});

test('settlement batches charges per vendor and is idempotent', async () => {
  await post('/api/reset');
  await runTask('task-02', 'rbt-02');
  await runTask('task-04', 'rbt-02');
  const first = await (await post('/api/settle')).json();
  assert.equal(first.settledCount, 2);
  assert.equal(first.total, first.payouts.reduce((a, p) => a + p.amount, 0));
  const second = await (await post('/api/settle')).json();
  assert.equal(second.settledCount, 0);
});

test('invalid input gets a clean JSON 4xx, never HTML or a silent fallback', async () => {
  await post('/api/reset');
  // Unknown task / robot are rejected before the stream opens.
  const badTask = await fetch(`${BASE}/api/run/task-99?robotId=rbt-01`);
  assert.equal(badTask.status, 404);
  assert.match((await badTask.json()).error, /task/i);
  const badRobot = await fetch(`${BASE}/api/run/task-01?robotId=rbt-99`);
  assert.equal(badRobot.status, 404);
  assert.match((await badRobot.json()).error, /robot/i);
  // A body-less skill choice is a 400, not a crash.
  const noBody = await fetch(`${BASE}/api/skill-choice/whatever`, { method: 'POST' });
  assert.equal(noBody.status, 400);
  // Unknown API routes return JSON, not an HTML error page.
  const unknown = await fetch(`${BASE}/api/nope`);
  assert.equal(unknown.status, 404);
  assert.ok((await unknown.json()).error);
});

test('reset reseeds state and a stale run cannot pollute it', async () => {
  await runTask('task-02', 'rbt-02');
  await post('/api/reset');
  const s = await state();
  assert.equal(s.receipts.length, 0);
  assert.equal(s.totalSaved, 0);
  assert.equal(s.robots[0].spent, 340, 'Atlas-7 back to seed spend');
});

test('CORS allows only the configured origin; body limits return clean 4xx', async () => {
  const allowed = await fetch(`${BASE}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const denied = await fetch(`${BASE}/api/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);

  const huge = await fetch(`${BASE}/api/skill-choice/x`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId: 'x'.repeat(20000) }),
  });
  assert.equal(huge.status, 413);
  const malformed = await fetch(`${BASE}/api/skill-choice/x`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not json',
  });
  assert.equal(malformed.status, 400);
});

test('audit export snapshots the full durable state as an attachment', async () => {
  await post('/api/reset');
  await runTask('task-02', 'rbt-02');
  const res = await fetch(`${BASE}/api/export`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition') || '', /attachment; filename="skillcard-export-/);
  const snap = await res.json();
  assert.ok(snap.exportedAt && snap.version);
  assert.equal(snap.receipts.length, 1);
  assert.equal(snap.totalSaved, snap.receipts[0].netSaved);
  assert.equal(snap.robots.length, 3);
});

test('state survives a full server restart (SQLite persistence)', async () => {
  await post('/api/reset');
  await runTask('task-01', 'rbt-01');
  const beforeRestart = await state();
  assert.equal(beforeRestart.receipts.length, 1);
  assert.ok(beforeRestart.totalSaved > 0);

  await stopServer(server);
  server = await startServer();

  const afterRestart = await state();
  assert.equal(afterRestart.totalSaved, beforeRestart.totalSaved, 'savings survive');
  assert.equal(afterRestart.receipts.length, 1, 'receipts survive');
  assert.equal(afterRestart.receipts[0].id, beforeRestart.receipts[0].id, 'same receipt');
  assert.deepEqual(
    afterRestart.robots.map((r) => [r.id, r.spent, r.capabilities.length]),
    beforeRestart.robots.map((r) => [r.id, r.spent, r.capabilities.length]),
    'robot spend and installed capabilities survive'
  );
  assert.deepEqual(afterRestart.tasks, beforeRestart.tasks, 'tasks round-trip exactly');
  assert.deepEqual(afterRestart.marketplace, beforeRestart.marketplace, 'marketplace round-trips exactly');
});
