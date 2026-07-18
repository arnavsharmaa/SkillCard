// Thin client for the SkillCard server. SSE for the run stream, fetch for reads.

export async function getState() {
  const r = await fetch('/api/state', { cache: 'no-store' });
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

export const money = (n) =>
  (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
