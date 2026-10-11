// Bearer-token auth is exercised against a dedicated server instance booted
// with SKILLCARD_API_TOKEN set. The main smoke suite runs with auth off, which
// also proves the default (tokenless) deployment stays fully open.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3997;
const BASE = `http://localhost:${PORT}`;
const TOKEN = 'test-token-7f3a9c1d2e4b';
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'skillcard-auth-'));

let server;

before(async () => {
  server = spawn('node', ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      RUN_STUBBED: '1',
      SKILLCARD_DB: path.join(SCRATCH, 'auth.db'),
      SKILLCARD_API_TOKEN: TOKEN,
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

const post = (p, headers = {}) => fetch(`${BASE}${p}`, { method: 'POST', headers });

test('reads stay open when auth is enabled', async () => {
  for (const p of ['/api/health', '/api/state', '/api/receipts', '/api/docs', '/api/export']) {
    assert.equal((await fetch(`${BASE}${p}`)).status, 200, `${p} should not require a token`);
  }
});

test('a mutating request without a token is a 401 with WWW-Authenticate', async () => {
  const res = await post('/api/reset');
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  assert.match((await res.json()).error, /bearer token/i);
});

test('wrong tokens are rejected regardless of shape', async () => {
  for (const bad of [
    `Bearer ${TOKEN.slice(0, -1)}x`, // right length, wrong value
    'Bearer nope', // wrong length
    TOKEN, // missing the Bearer scheme
    `Basic ${TOKEN}`, // wrong scheme
  ]) {
    const res = await post('/api/reset', { Authorization: bad });
    assert.equal(res.status, 401, `should reject: ${bad}`);
  }
});

test('the correct token authorizes mutations end-to-end', async () => {
  const auth = { Authorization: `Bearer ${TOKEN}` };
  assert.equal((await post('/api/reset', auth)).status, 200);
  const settle = await post('/api/settle', auth);
  assert.equal(settle.status, 200);
  assert.equal((await settle.json()).settledCount, 0);
});

test('auth happens before business validation — no resource probing without a token', async () => {
  // Unknown receipt id: 401 without a token (not 404), 404 with one.
  assert.equal((await post('/api/approve/rcpt-does-not-exist')).status, 401);
  const withToken = await post('/api/approve/rcpt-does-not-exist', { Authorization: `Bearer ${TOKEN}` });
  assert.equal(withToken.status, 404);
});
