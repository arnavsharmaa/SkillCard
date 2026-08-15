// Lightweight file persistence so fleet/receipt state survives a server restart.
// Durable slice only — the transient pending-approval/escalation maps are not
// persisted (they're mid-request context that a restart legitimately drops).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');

export function saveState(state) {
  try {
    const durable = {
      robots: state.robots,
      tasks: state.tasks,
      marketplace: state.marketplace,
      receipts: state.receipts,
      totalSaved: state.totalSaved,
      generation: state.generation,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(durable, null, 0));
  } catch (err) {
    console.error('[persist] save failed', err.message);
  }
}

export function loadState() {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('[persist] load failed — starting from seed', err.message);
    return null;
  }
}
