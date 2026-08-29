// The rate limiter is exercised against a dedicated server instance with a
// deliberately tiny budget, so the main smoke suite never trips it.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3998;
const BASE = `http://localhost:${PORT}`;
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'skillcard-rl-'));

let server;

before(async () => {
  server = spawn('node', ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      RUN_STUBBED: '1',
      SKILLCARD_DB: path.join(SCRATCH, 'rl.db'),
      RATE_LIMIT_RPM: '3',
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('server did not start');
});

after(async () => {
  if (server && server.exitCode === null) {
    await new Promise((resolve) => {
      server.once('exit', resolve);
      server.kill();
    });
  }
  fs.rmSync(SCRATCH, { recursive: true, force: true });
});

test('requests beyond the per-minute budget get a 429 with Retry-After', async () => {
  // The startup poll consumed one hit; burn the rest, then expect 429.
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await fetch(`${BASE}/api/state`)).status);
  assert.ok(statuses.includes(429), `expected a 429 in ${statuses}`);

  const limited = await fetch(`${BASE}/api/state`);
  assert.equal(limited.status, 429);
  const retryAfter = Number(limited.headers.get('retry-after'));
  assert.ok(retryAfter >= 1 && retryAfter <= 60, `Retry-After should be sane, got ${retryAfter}`);
  assert.match((await limited.json()).error, /too many/i);
});
