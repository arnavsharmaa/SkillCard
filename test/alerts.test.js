// Unit tests for the client's pure governance helpers: reviewFlag (per-receipt
// spend alerts) and detectAnomalies (cross-receipt patterns). Both are plain
// functions, so they're tested directly without a browser or server.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewFlag, detectAnomalies } from '../client/src/api.js';

const receipt = (over = {}) => ({
  id: 'rcpt-x',
  cost: 40,
  taskValue: 480,
  skill: { id: 'skl-1', name: 'Skill One', vendor: 'VendorA' },
  ...over,
});

// ---- reviewFlag -----------------------------------------------------------

test('a clean auto-approved receipt is not flagged', () => {
  assert.equal(reviewFlag(receipt()), null);
});

test('budget overrides are flagged at danger level', () => {
  const f = reviewFlag(receipt({ approvedBy: 'budget-override' }));
  assert.equal(f.level, 'danger');
  assert.match(f.reason, /override/i);
});

test('operator escalations, human approvals, and operator picks flag at warn', () => {
  for (const r of [
    receipt({ operator: { vendor: 'RemoteAssist' } }),
    receipt({ approvedBy: 'human-approved' }),
    receipt({ approvedBy: 'operator-chosen' }),
  ]) {
    assert.equal(reviewFlag(r).level, 'warn');
  }
});

test('high cost relative to task value flags; proportionate cost does not', () => {
  assert.ok(reviewFlag(receipt({ cost: 200, taskValue: 480 })));
  assert.equal(reviewFlag(receipt({ cost: 100, taskValue: 480 })), null);
});

test('override outranks the high-cost reason when both apply', () => {
  const f = reviewFlag(receipt({ approvedBy: 'budget-override', cost: 400, taskValue: 480 }));
  assert.match(f.reason, /override/i);
});

// ---- detectAnomalies ------------------------------------------------------

test('no anomalies on an empty or small, diverse ledger', () => {
  assert.deepEqual(detectAnomalies([]), []);
  const diverse = [
    receipt({ id: 'a', skill: { id: 's1', name: 'A', vendor: 'V1' } }),
    receipt({ id: 'b', skill: { id: 's2', name: 'B', vendor: 'V2' } }),
  ];
  assert.deepEqual(detectAnomalies(diverse), []);
});

test('vendor concentration over half of fleet spend is flagged', () => {
  const rs = [
    receipt({ id: 'a', cost: 300, skill: { id: 's1', name: 'A', vendor: 'BigVendor' } }),
    receipt({ id: 'b', cost: 50, skill: { id: 's2', name: 'B', vendor: 'V2' } }),
    receipt({ id: 'c', cost: 50, skill: { id: 's3', name: 'C', vendor: 'V3' } }),
  ];
  const out = detectAnomalies(rs);
  assert.ok(out.some((a) => /BigVendor/.test(a.message) && /concentration/.test(a.message)));
});

test('buying the same skill twice reads as redundant spend', () => {
  const rs = [
    receipt({ id: 'a', skill: { id: 's1', name: 'NightRead OCR', vendor: 'V1' } }),
    receipt({ id: 'b', skill: { id: 's1', name: 'NightRead OCR', vendor: 'V1' } }),
  ];
  const out = detectAnomalies(rs);
  assert.ok(out.some((a) => /NightRead OCR/.test(a.message) && /redundant/i.test(a.message)));
});

test('two or more budget overrides escalate to a danger-level anomaly', () => {
  const rs = [
    receipt({ id: 'a', approvedBy: 'budget-override', skill: { id: 's1', name: 'A', vendor: 'V1' } }),
    receipt({ id: 'b', approvedBy: 'budget-override', skill: { id: 's2', name: 'B', vendor: 'V2' } }),
  ];
  const out = detectAnomalies(rs);
  const hit = out.find((a) => /override/i.test(a.message));
  assert.equal(hit.level, 'danger');
});
