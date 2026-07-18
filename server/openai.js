// The two reasoning calls. Both use strict JSON output and are wrapped in
// try/catch. On ANY failure (no key, network, bad JSON) we fall back to a
// hardcoded canned response and log to console only — never to the UI.

import OpenAI from 'openai';
import { CANNED_DIAGNOSIS, cannedReasoning } from './fallbacks.js';

// Single constant for the model name — easy to change.
export const MODEL = 'gpt-4o';

// RUN_STUBBED=1 forces canned responses (used for build order step 3 and as a
// safety switch when demoing without a key).
const STUBBED = process.env.RUN_STUBBED === '1';

let client = null;
function getClient() {
  if (client) return client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  client = new OpenAI({ apiKey: key });
  return client;
}

async function callJSON(system, user) {
  const oa = getClient();
  if (!oa) throw new Error('no-api-key');
  const res = await oa.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return JSON.parse(res.choices[0].message.content);
}

// STAGE 2 — DIAGNOSE
export async function diagnose(task, robot, telemetry) {
  const canned = CANNED_DIAGNOSIS[task.id] || CANNED_DIAGNOSIS.default;
  if (STUBBED) return { data: canned, source: 'stub' };

  const system =
    'You are a robotics reliability engineer. Given a failed task, the robot\'s installed ' +
    'capabilities, and raw telemetry, explain in one or two plain-language sentences why it ' +
    'failed — like an engineer talking to a colleague, not a template. Then name the single ' +
    'missing capability. Respond ONLY with JSON: ' +
    '{"diagnosis": string, "missing_capability": string, "confidence": number between 0 and 1}.';

  const user = JSON.stringify({
    task: task.description,
    required_capability: task.requiredCapability,
    installed_capabilities: robot.capabilities,
    telemetry,
  });

  try {
    const data = await callJSON(system, user);
    if (!data.diagnosis || !data.missing_capability) throw new Error('bad-shape');
    if (typeof data.confidence !== 'number') data.confidence = canned.confidence;
    // Keep the missing capability aligned with the marketplace taxonomy.
    data.missing_capability = task.requiredCapability;
    return { data, source: 'openai' };
  } catch (err) {
    console.error('[DIAGNOSE fallback]', err.message);
    return { data: canned, source: 'fallback' };
  }
}

// STAGE 4 — REASON
export async function reason(diagnosis, candidates, task, robot) {
  const canned = cannedReasoning(candidates, task);
  if (STUBBED) return { data: canned, source: 'stub' };

  const system =
    'You are an autonomous procurement agent for a robot fleet. Choose the single best skill ' +
    'to purchase to recover the failed task. Weigh price, success rate, expected value against ' +
    'the task value. Optimize for the best expected value — pick the single highest-EV option. ' +
    'Do NOT enforce the robot policy yourself; a separate policy engine downstream will approve, ' +
    'flag, or block your choice. Cite the actual economics. For every option you do ' +
    'NOT pick, give a concrete reason it lost. Respond ONLY with JSON: ' +
    '{"chosen_skill_id": string, "justification": string (2-3 sentences citing numbers), ' +
    '"rejected": [{"skill_id": string, "reason": string}]}.';

  const user = JSON.stringify({
    diagnosis,
    task_value: task.taskValue,
    human_baseline_cost: task.humanBaselineCost,
    robot_policy: robot.policy,
    candidate_skills: candidates.map((c) => ({
      skill_id: c.id,
      name: c.name,
      vendor: c.vendor,
      price: c.price,
      pricing_model: c.pricingModel,
      success_rate: c.successRate,
      required_hardware: c.requiredHardware,
      certifications: c.certifications,
      category: c.category,
    })),
  });

  try {
    const data = await callJSON(system, user);
    const ok = candidates.some((c) => c.id === data.chosen_skill_id);
    if (!ok || !data.justification) throw new Error('bad-shape');
    if (!Array.isArray(data.rejected)) data.rejected = canned.rejected;
    return { data, source: 'openai' };
  } catch (err) {
    console.error('[REASON fallback]', err.message);
    return { data: canned, source: 'fallback' };
  }
}
