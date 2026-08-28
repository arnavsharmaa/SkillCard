// Unit tests for the policy engine — the most load-bearing code in the repo.
// Pure function, no server needed. Each governance rule is exercised alone,
// the precedence order is pinned, and the ceiling boundary is exact.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPolicy } from '../server/loop.js';

// A permissive baseline; individual tests tighten one dimension at a time.
const robot = (policy = {}, extra = {}) => ({
  name: 'TestBot',
  hardware: [],
  policy: {
    autoApproveCeiling: 100,
    blockedCategories: [],
    requiredCertifications: [],
    requireVerifiedVendor: false,
    blockUnrestrictedPermissions: false,
    ...policy,
  },
  ...extra,
});

const skill = (over = {}) => ({
  id: 'skl-x',
  name: 'Test Skill',
  vendor: 'TestVendor',
  price: 50,
  category: 'perception',
  requiredHardware: [],
  certifications: [],
  requestedPermissions: [],
  ...over,
});

test('a clean, in-ceiling skill auto-approves', () => {
  const r = applyPolicy(skill(), robot());
  assert.equal(r.decision, 'approve');
});

test('blocked category is a hard block', () => {
  const r = applyPolicy(skill({ category: 'teleop' }), robot({ blockedCategories: ['teleop'] }));
  assert.equal(r.decision, 'block');
  assert.match(r.reasons[0], /teleop/);
});

test('missing hardware is a hard block; present hardware is not', () => {
  const needsLidar = skill({ requiredHardware: ['lidar-array'] });
  assert.equal(applyPolicy(needsLidar, robot()).decision, 'block');
  assert.equal(applyPolicy(needsLidar, robot({}, { hardware: ['lidar-array'] })).decision, 'approve');
});

test('unverified vendor blocks only when the policy requires verification', () => {
  const sketchy = skill({ vendorVerified: false });
  assert.equal(applyPolicy(sketchy, robot({ requireVerifiedVendor: true })).decision, 'block');
  assert.equal(applyPolicy(sketchy, robot({ requireVerifiedVendor: false })).decision, 'approve');
  // Skills default to verified when the flag is absent entirely.
  assert.equal(applyPolicy(skill(), robot({ requireVerifiedVendor: true })).decision, 'approve');
});

test('unrestricted permissions block only when the policy scopes permissions', () => {
  const grabby = skill({ requestedPermissions: ['camera:unrestricted'] });
  assert.equal(applyPolicy(grabby, robot({ blockUnrestrictedPermissions: true })).decision, 'block');
  assert.equal(applyPolicy(grabby, robot({ blockUnrestrictedPermissions: false })).decision, 'approve');
  // Scoped permissions are fine even under a strict policy.
  const scoped = skill({ requestedPermissions: ['camera'] });
  assert.equal(applyPolicy(scoped, robot({ blockUnrestrictedPermissions: true })).decision, 'approve');
});

test('missing certification is a hard block; holding it clears', () => {
  const strict = robot({ requiredCertifications: ['SOC2'] });
  assert.equal(applyPolicy(skill(), strict).decision, 'block');
  assert.equal(applyPolicy(skill({ certifications: ['SOC2'] }), strict).decision, 'approve');
});

test('ceiling boundary: at the ceiling approves, one over flags', () => {
  const r = robot({ autoApproveCeiling: 100 });
  assert.equal(applyPolicy(skill({ price: 100 }), r).decision, 'approve');
  assert.equal(applyPolicy(skill({ price: 101 }), r).decision, 'flag');
});

test('a flag is not a block — over-ceiling is human-reviewable, not rejected', () => {
  const r = applyPolicy(skill({ price: 500 }), robot());
  assert.equal(r.decision, 'flag');
  assert.match(r.reasons[0], /ceiling/);
});

test('precedence: security blocks win over the price flag', () => {
  // Expensive AND unverified → the block reason must be the vendor, not the price.
  const r = applyPolicy(
    skill({ price: 500, vendorVerified: false }),
    robot({ requireVerifiedVendor: true })
  );
  assert.equal(r.decision, 'block');
  assert.match(r.reasons[0], /vendor/i);
});

test('precedence: category outranks hardware, vendor, and certification', () => {
  const worst = skill({
    category: 'teleop',
    requiredHardware: ['sonar'],
    vendorVerified: false,
    certifications: [],
  });
  const strict = robot({
    blockedCategories: ['teleop'],
    requireVerifiedVendor: true,
    requiredCertifications: ['SOC2'],
  });
  assert.match(applyPolicy(worst, strict).reasons[0], /Category/);
});

test('every decision carries at least one human-readable reason', () => {
  for (const [s, r] of [
    [skill(), robot()],
    [skill({ price: 999 }), robot()],
    [skill({ category: 'teleop' }), robot({ blockedCategories: ['teleop'] })],
  ]) {
    const res = applyPolicy(s, r);
    assert.ok(res.reasons.length >= 1 && typeof res.reasons[0] === 'string');
  }
});
