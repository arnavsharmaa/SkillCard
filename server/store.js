// SQLite-backed persistence. The server keeps its working state in memory and
// write-throughs here on every mutation; on boot the state is rebuilt from the
// database. Nested structures (policies, histories, receipt bodies) live in
// JSON columns — the entities and the fields that get queried are real columns.
//
// The database path is configurable via SKILLCARD_DB (tests point it at a
// scratch file). A legacy server/data.json from the pre-SQLite store is
// imported once on first boot, then renamed to data.json.imported.

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.SKILLCARD_DB || path.join(__dirname, 'skillcard.db');
const LEGACY_JSON = path.join(__dirname, 'data.json');

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS robots (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    model           TEXT NOT NULL,
    type            TEXT,
    monthly_budget  REAL NOT NULL,
    spent           REAL NOT NULL,
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    policy          TEXT NOT NULL,   -- JSON
    capabilities    TEXT NOT NULL,   -- JSON array
    hardware        TEXT,            -- JSON array
    history         TEXT NOT NULL    -- JSON array
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id                  TEXT PRIMARY KEY,
    description         TEXT NOT NULL,
    required_capability TEXT NOT NULL,
    task_value          REAL NOT NULL,
    human_baseline_cost REAL NOT NULL,
    downtime_cost       REAL,
    difficulty          TEXT,
    blocker             TEXT
  );
  CREATE TABLE IF NOT EXISTS marketplace (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    vendor                TEXT NOT NULL,
    price                 REAL NOT NULL,
    pricing_model         TEXT NOT NULL,
    capability            TEXT NOT NULL,
    success_rate          REAL NOT NULL,
    category              TEXT NOT NULL,
    vendor_verified       INTEGER,         -- null = verified by default
    risk_level            TEXT,
    required_hardware     TEXT,            -- JSON array
    certifications        TEXT,            -- JSON array
    requested_permissions TEXT             -- JSON array
  );
  CREATE TABLE IF NOT EXISTS receipts (
    id   TEXT PRIMARY KEY,
    seq  INTEGER NOT NULL,               -- insertion order; newest = highest
    data TEXT NOT NULL                   -- full receipt JSON
  );
  CREATE INDEX IF NOT EXISTS receipts_seq ON receipts (seq DESC);
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const J = (v) => JSON.stringify(v ?? null);
const P = (v) => (v == null ? null : JSON.parse(v));

const stmts = {
  clearRobots: db.prepare('DELETE FROM robots'),
  clearTasks: db.prepare('DELETE FROM tasks'),
  clearMarket: db.prepare('DELETE FROM marketplace'),
  clearReceipts: db.prepare('DELETE FROM receipts'),
  putRobot: db.prepare(`INSERT OR REPLACE INTO robots
    (id, name, model, type, monthly_budget, spent, tasks_completed, policy, capabilities, hardware, history)
    VALUES (@id, @name, @model, @type, @monthlyBudget, @spent, @tasksCompleted, @policy, @capabilities, @hardware, @history)`),
  putTask: db.prepare(`INSERT OR REPLACE INTO tasks
    (id, description, required_capability, task_value, human_baseline_cost, downtime_cost, difficulty, blocker)
    VALUES (@id, @description, @requiredCapability, @taskValue, @humanBaselineCost, @downtimeCost, @difficulty, @blocker)`),
  putSkill: db.prepare(`INSERT OR REPLACE INTO marketplace
    (id, name, vendor, price, pricing_model, capability, success_rate, category, vendor_verified, risk_level, required_hardware, certifications, requested_permissions)
    VALUES (@id, @name, @vendor, @price, @pricingModel, @capability, @successRate, @category, @vendorVerified, @riskLevel, @requiredHardware, @certifications, @requestedPermissions)`),
  putReceipt: db.prepare('INSERT OR REPLACE INTO receipts (id, seq, data) VALUES (?, ?, ?)'),
  putMeta: db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)'),
  allRobots: db.prepare('SELECT * FROM robots'),
  allTasks: db.prepare('SELECT * FROM tasks'),
  allSkills: db.prepare('SELECT * FROM marketplace'),
  allReceipts: db.prepare('SELECT data FROM receipts ORDER BY seq DESC'),
  getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
};

// Full write-through of the durable slice, atomically.
const writeAll = db.transaction((state) => {
  stmts.clearRobots.run();
  for (const r of state.robots) {
    stmts.putRobot.run({
      id: r.id, name: r.name, model: r.model, type: r.type ?? null,
      monthlyBudget: r.monthlyBudget, spent: r.spent, tasksCompleted: r.tasksCompleted ?? 0,
      policy: J(r.policy), capabilities: J(r.capabilities), hardware: J(r.hardware), history: J(r.history),
    });
  }
  stmts.clearTasks.run();
  for (const t of state.tasks) {
    stmts.putTask.run({
      id: t.id, description: t.description, requiredCapability: t.requiredCapability,
      taskValue: t.taskValue, humanBaselineCost: t.humanBaselineCost,
      downtimeCost: t.downtimeCost ?? null, difficulty: t.difficulty ?? null, blocker: t.blocker ?? null,
    });
  }
  stmts.clearMarket.run();
  for (const s of state.marketplace) {
    stmts.putSkill.run({
      id: s.id, name: s.name, vendor: s.vendor, price: s.price, pricingModel: s.pricingModel,
      capability: s.capability, successRate: s.successRate, category: s.category,
      vendorVerified: s.vendorVerified == null ? null : Number(s.vendorVerified),
      riskLevel: s.riskLevel ?? null, requiredHardware: J(s.requiredHardware),
      certifications: J(s.certifications), requestedPermissions: J(s.requestedPermissions),
    });
  }
  stmts.clearReceipts.run();
  // state.receipts is newest-first; store seq so ORDER BY seq DESC restores it.
  const n = state.receipts.length;
  state.receipts.forEach((r, i) => stmts.putReceipt.run(r.id, n - i, J(r)));
  stmts.putMeta.run('totalSaved', String(state.totalSaved));
  stmts.putMeta.run('generation', String(state.generation));
});

export function saveState(state) {
  try {
    writeAll(state);
  } catch (err) {
    console.error('[persist] save failed', err.message);
  }
}

function rowToRobot(row) {
  const robot = {
    id: row.id, name: row.name, model: row.model,
    monthlyBudget: row.monthly_budget, spent: row.spent, tasksCompleted: row.tasks_completed,
    policy: P(row.policy), capabilities: P(row.capabilities), history: P(row.history),
  };
  if (row.type != null) robot.type = row.type;
  const hardware = P(row.hardware);
  if (hardware != null) robot.hardware = hardware;
  return robot;
}

function rowToTask(row) {
  const task = {
    id: row.id, description: row.description, requiredCapability: row.required_capability,
    taskValue: row.task_value, humanBaselineCost: row.human_baseline_cost,
  };
  if (row.downtime_cost != null) task.downtimeCost = row.downtime_cost;
  if (row.difficulty != null) task.difficulty = row.difficulty;
  if (row.blocker != null) task.blocker = row.blocker;
  return task;
}

function rowToSkill(row) {
  const skill = {
    id: row.id, name: row.name, vendor: row.vendor, price: row.price,
    pricingModel: row.pricing_model, capability: row.capability,
    successRate: row.success_rate, category: row.category,
  };
  if (row.vendor_verified != null) skill.vendorVerified = Boolean(row.vendor_verified);
  if (row.risk_level != null) skill.riskLevel = row.risk_level;
  for (const [col, key] of [
    ['required_hardware', 'requiredHardware'],
    ['certifications', 'certifications'],
    ['requested_permissions', 'requestedPermissions'],
  ]) {
    const v = P(row[col]);
    if (v != null) skill[key] = v;
  }
  return skill;
}

export function loadState() {
  try {
    // One-time import of the legacy JSON store.
    if (fs.existsSync(LEGACY_JSON)) {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf8'));
      writeAll({ generation: 0, ...legacy });
      fs.renameSync(LEGACY_JSON, `${LEGACY_JSON}.imported`);
      console.log('[persist] imported legacy data.json into SQLite');
    }

    const robots = stmts.allRobots.all().map(rowToRobot);
    if (robots.length === 0) return null; // fresh database — caller seeds
    return {
      robots,
      tasks: stmts.allTasks.all().map(rowToTask),
      marketplace: stmts.allSkills.all().map(rowToSkill),
      receipts: stmts.allReceipts.all().map((r) => P(r.data)),
      totalSaved: Number(stmts.getMeta.get('totalSaved')?.value ?? 0),
      generation: Number(stmts.getMeta.get('generation')?.value ?? 0),
    };
  } catch (err) {
    console.error('[persist] load failed — starting from seed', err.message);
    return null;
  }
}
