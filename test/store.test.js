// Unit tests for the SQLite store: exact round-tripping of the durable slice.
// The e2e suite proves persistence across a server restart; these tests pin the
// column-level behavior — optional-field omission, receipt ordering, meta
// coercion — directly against a scratch database.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'skillcard-store-'));
process.env.SKILLCARD_DB = path.join(SCRATCH, 'store.db');

// The store binds its database path at import time, so the env var above must
// be set before this dynamic import.
const { saveState, loadState, closeStore } = await import('../server/store.js');
const { seedRobots, seedTasks, seedMarketplace } = await import('../server/seed.js');

after(() => {
  closeStore();
  fs.rmSync(SCRATCH, { recursive: true, force: true });
});

const receipt = (id, over = {}) => ({
  id,
  ts: '2026-09-23T12:00:00Z',
  robot: { id: 'rbt-01', name: 'Atlas-7' },
  task: { id: 'task-01', description: 'x' },
  skill: { id: 'skl-01', name: 'S', vendor: 'V', price: 40 },
  cost: 40,
  netSaved: 180,
  ...over,
});

const freshState = () => ({
  robots: seedRobots(),
  tasks: seedTasks(),
  marketplace: seedMarketplace(),
  receipts: [],
  totalSaved: 0,
  generation: 0,
});

test('a fresh database loads as null so the caller seeds', () => {
  assert.equal(loadState(), null);
});

test('the full seed state round-trips exactly', () => {
  const state = freshState();
  saveState(state);
  const loaded = loadState();
  assert.deepEqual(loaded.robots, state.robots);
  assert.deepEqual(loaded.tasks, state.tasks);
  assert.deepEqual(loaded.marketplace, state.marketplace);
  assert.deepEqual(loaded.receipts, []);
  assert.equal(loaded.totalSaved, 0);
  assert.equal(loaded.generation, 0);
});

test('receipts come back newest-first with their full bodies', () => {
  const state = freshState();
  // The server unshifts, so index 0 is newest.
  state.receipts = [receipt('rcpt-newest'), receipt('rcpt-middle'), receipt('rcpt-oldest')];
  state.totalSaved = 540;
  state.generation = 3;
  saveState(state);
  const loaded = loadState();
  assert.deepEqual(loaded.receipts.map((r) => r.id), ['rcpt-newest', 'rcpt-middle', 'rcpt-oldest']);
  assert.deepEqual(loaded.receipts, state.receipts);
  assert.equal(loaded.totalSaved, 540);
  assert.equal(loaded.generation, 3);
});

test('save is a full replacement, not an append', () => {
  const state = freshState();
  state.receipts = [receipt('rcpt-only')];
  saveState(state);
  const loaded = loadState();
  assert.equal(loaded.receipts.length, 1, 'receipts from the previous save are gone');
  assert.equal(loaded.receipts[0].id, 'rcpt-only');
});

test('optional fields absent on save stay absent on load (no null pollution)', () => {
  const state = freshState();
  // A minimal skill with every optional column omitted.
  state.marketplace = [{
    id: 'skl-min', name: 'Minimal', vendor: 'V', price: 10,
    pricingModel: 'one-time', capability: 'grasp-detection', successRate: 0.9, category: 'perception',
  }];
  saveState(state);
  const [skill] = loadState().marketplace;
  assert.deepEqual(skill, state.marketplace[0]);
  for (const k of ['vendorVerified', 'riskLevel', 'requiredHardware', 'certifications', 'requestedPermissions']) {
    assert.ok(!(k in skill), `${k} should be omitted, not null`);
  }
});

test('vendorVerified survives as a real boolean through the INTEGER column', () => {
  const state = freshState();
  const flagged = state.marketplace.find((s) => s.vendorVerified === false);
  assert.ok(flagged, 'seed contains an unverified-vendor skill');
  saveState(state);
  const loaded = loadState().marketplace.find((s) => s.id === flagged.id);
  assert.equal(loaded.vendorVerified, false);
  assert.equal(typeof loaded.vendorVerified, 'boolean');
});
