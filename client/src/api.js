// Thin client for the SkillCard server. SSE for the run stream, fetch for reads.

export async function getState() {
  const r = await fetch('/api/state', { cache: 'no-store' });
  return r.json();
}

export async function getHealth() {
  const r = await fetch('/api/health', { cache: 'no-store' });
  return r.json();
}

export async function reset() {
  await fetch('/api/reset', { method: 'POST' });
}

// Runs a task and invokes handlers as stages stream in.
// Returns a cancel function. Uses EventSource for reliable SSE.
export function runTask(taskId, robotId, { onStart, onStage, onDone, onError }, delay = 900, fail = false) {
  const url = `/api/run/${taskId}?robotId=${robotId}&delay=${delay}${fail ? '&fail=1' : ''}`;
  const es = new EventSource(url);

  es.addEventListener('start', (e) => onStart?.(JSON.parse(e.data)));
  es.addEventListener('stage', (e) => onStage?.(JSON.parse(e.data)));
  es.addEventListener('done', (e) => {
    onDone?.(JSON.parse(e.data));
    es.close();
  });
  es.addEventListener('error', (e) => {
    // EventSource fires 'error' both on our custom error event and on close.
    let msg = 'Connection interrupted.';
    try {
      if (e.data) msg = JSON.parse(e.data).message;
    } catch (_) {}
    if (es.readyState === EventSource.CLOSED || e.data) {
      onError?.({ message: msg });
      es.close();
    }
  });

  return () => es.close();
}

// Finalize an escalated task after a human operator resolves it.
export async function resolveWithOperator(escalationId) {
  const r = await fetch(`/api/operator/${escalationId}`, { method: 'POST' });
  if (!r.ok) throw new Error('operator finalize failed');
  return r.json();
}

// Approve a flagged (over-ceiling) purchase as-is.
export async function approvePurchase(receiptId) {
  const r = await fetch(`/api/approve/${receiptId}`, { method: 'POST' });
  if (!r.ok) throw new Error('approve failed');
  return r.json();
}

// Human picks a different skill from the marketplace for a flagged purchase.
export async function chooseSkill(receiptId, skillId) {
  const r = await fetch(`/api/skill-choice/${receiptId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId }),
  });
  if (!r.ok) throw new Error('skill choice failed');
  return r.json();
}

// Human authorizes a budget override for an over-budget purchase.
export async function authorizeOverride(receiptId) {
  const r = await fetch(`/api/override/${receiptId}`, { method: 'POST' });
  if (!r.ok) throw new Error('override failed');
  return r.json();
}

// Finance acknowledges a flagged receipt (clears it from the review queue).
export async function acknowledgeReceipt(receiptId) {
  const r = await fetch(`/api/receipts/${receiptId}/acknowledge`, { method: 'POST' });
  if (!r.ok) throw new Error('acknowledge failed');
  return r.json();
}

export const money = (n) =>
  (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

// Spend alerts: does a receipt warrant a human finance review? Returns a short
// reason (with a severity) or null. Auto-approved, in-budget purchases don't.
export function reviewFlag(r) {
  if (r.approvedBy === 'budget-override') return { reason: 'Budget override — spent beyond the monthly budget', level: 'danger' };
  if (r.operator) return { reason: 'Escalated to a human operator', level: 'warn' };
  if (r.approvedBy === 'human-approved') return { reason: 'Approved over the auto-approve ceiling', level: 'warn' };
  if (r.approvedBy === 'operator-chosen') return { reason: 'Operator overrode the agent’s choice', level: 'warn' };
  if (r.taskValue && r.cost > r.taskValue * 0.3) return { reason: 'High cost relative to task value', level: 'warn' };
  return null;
}
