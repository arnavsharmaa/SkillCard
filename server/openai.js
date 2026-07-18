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
// The agent's CHOICE is deterministic: it proposes the highest-expected-value
// candidate (a formula, not a judgment call). The model's job is to ARTICULATE
// that reasoning in plain language and explain why each alternative lost — which
// is what it's good at, and what makes the agent look like it's thinking. This
// also keeps the demo's policy-block beat reliable (a "smart" live model would
// otherwise dodge the blocked option and never trigger the block).
export async function reason(diagnosis, candidates, chosen, task, robot) {
  const canned = cannedReasoning(candidates, task, chosen);
  if (STUBBED) return { data: canned, source: 'stub' };

  const ev = (c) => Math.round(task.taskValue * c.successRate - c.price);
  const system =
    'You are an autonomous procurement agent for a robot fleet. The agent has already ' +
    'selected the skill with the highest expected value (success_rate × task_value − price). ' +
    'Your job is to ARTICULATE that decision, not change it. Write a 2-3 sentence justification ' +
    'for the chosen skill citing the actual numbers (expected value vs the task value), and for ' +
    'every other candidate give one concrete reason it lost. Do NOT enforce robot policy — a ' +
    'separate policy engine handles that. Respond ONLY with JSON: ' +
    '{"justification": string, "rejected": [{"skill_id": string, "reason": string}]}.';

  const user = JSON.stringify({
    diagnosis,
    task_value: task.taskValue,
    human_baseline_cost: task.humanBaselineCost,
    chosen_skill_id: chosen.id,
    chosen_expected_value: ev(chosen),
    candidate_skills: candidates.map((c) => ({
      skill_id: c.id,
      name: c.name,
      vendor: c.vendor,
      price: c.price,
      pricing_model: c.pricingModel,
      success_rate: c.successRate,
      expected_value: ev(c),
      required_hardware: c.requiredHardware,
      certifications: c.certifications,
      category: c.category,
    })),
  });

  try {
    const data = await callJSON(system, user);
    if (!data.justification) throw new Error('bad-shape');
    if (!Array.isArray(data.rejected)) data.rejected = canned.rejected;
    data.chosen_skill_id = chosen.id;
    return { data, source: 'openai' };
  } catch (err) {
    console.error('[REASON fallback]', err.message);
    return { data: canned, source: 'fallback' };
  }
}
