// The core loop. Runs the 8 stages and emits each one to a callback so the
// server can stream them. Deterministic where it matters; OpenAI where it reads.

import { diagnose, reason } from './openai.js';
import { makeTelemetry } from './fallbacks.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// STAGE 5 — POLICY. Deterministic. The model proposes, policy disposes.
export function applyPolicy(skill, robot) {
  const p = robot.policy;
  const reasons = [];

  // Hard block: category on the robot's blocked list.
  if (p.blockedCategories.includes(skill.category)) {
    return { decision: 'block', reasons: [`Category "${skill.category}" is blocked for ${robot.name}.`] };
  }
  // Hard block: requires hardware the robot does not have.
  const missingHw = (skill.requiredHardware || []).filter((h) => !(robot.hardware || []).includes(h));
  if (missingHw.length > 0) {
    return { decision: 'block', reasons: [`Requires hardware not installed: ${missingHw.join(', ')}.`] };
  }
  // Hard block: unverified vendor (skills default to verified unless flagged).
  if (p.requireVerifiedVendor && skill.vendorVerified === false) {
    return { decision: 'block', reasons: [`Unverified vendor "${skill.vendor}" — blocked by security policy.`] };
  }
  // Hard block: skill demands unrestricted permissions.
  const unrestricted = (skill.requestedPermissions || []).filter((perm) => perm.includes('unrestricted'));
  if (p.blockUnrestrictedPermissions && unrestricted.length > 0) {
    return { decision: 'block', reasons: [`Requests unrestricted access (${unrestricted.join(', ')}) — blocked by security policy.`] };
  }
  // Hard block: missing a required certification.
  const missingCert = (p.requiredCertifications || []).filter((c) => !(skill.certifications || []).includes(c));
  if (missingCert.length > 0) {
    return { decision: 'block', reasons: [`Missing required certification: ${missingCert.join(', ')}.`] };
  }
  // Over the auto-approve ceiling -> needs human approval (not a hard block).
  if (skill.price > p.autoApproveCeiling) {
    reasons.push(`$${skill.price} exceeds the $${p.autoApproveCeiling} auto-approve ceiling — flagged for approval.`);
    return { decision: 'flag', reasons };
  }
  return { decision: 'approve', reasons: [`$${skill.price} is within the $${p.autoApproveCeiling} ceiling; certifications met.`] };
}

// Pick order for candidates: highest expected value first.
function rankCandidates(candidates, task) {
  return [...candidates].sort(
    (a, b) => (task.taskValue * b.successRate - b.price) - (task.taskValue * a.successRate - a.price)
  );
}

// emit(stage) is called for every stage; delayMs paces the visual timeline.
export async function runTask({ task, robot, marketplace, reasoningResult, diagnosisResult, simulateFailure }, emit, delayMs = 900) {
  const receiptId = `rcpt-${Date.now().toString(36)}`;

  // 1. ATTEMPT ------------------------------------------------------------
  const telemetry = makeTelemetry(task);
  emit({
    stage: 'ATTEMPT',
    status: 'fail',
    title: 'Robot attempts the task',
    telemetry,
    text: `${robot.name} attempted "${task.description}" and failed after ${telemetry.retry_count} retries (${telemetry.error_code}).`,
  });
  await sleep(delayMs);

  // 2. DIAGNOSE (OpenAI) --------------------------------------------------
  const dg = diagnosisResult || (await diagnose(task, robot, telemetry));
  emit({
    stage: 'DIAGNOSE',
    status: 'ok',
    title: 'Agent diagnoses the failure',
    text: dg.data.diagnosis,
    missing_capability: dg.data.missing_capability,
    confidence: dg.data.confidence,
    source: dg.source,
  });
  await sleep(delayMs);

  // 3. SHOP ---------------------------------------------------------------
  const candidates = rankCandidates(
    marketplace.filter((s) => s.capability === task.requiredCapability),
    task
  )
    .slice(0, 4)
    // Pre-screen every candidate against policy so the marketplace shows a
    // compatible / needs-approval / blocked badge on each option.
    .map((c) => {
      const pol = applyPolicy(c, robot);
      return { ...c, policyBadge: pol.decision, policyNote: pol.reasons[0] };
    });
  emit({
    stage: 'SHOP',
    status: 'ok',
    title: 'Shopping the skill marketplace',
    text: `Found ${candidates.length} skills that provide "${task.requiredCapability}".`,
    candidates,
  });
  await sleep(delayMs);

  // Defensive guard: if the marketplace has nothing for this capability, end
  // gracefully instead of crashing. (All seeded tasks have candidates.)
  if (candidates.length === 0) {
    emit({
      stage: 'RECEIPT',
      status: 'fail',
      title: 'No skill available',
      text: `The marketplace has no skill that provides "${task.requiredCapability}" yet.`,
    });
    return { purchased: false };
  }

  // 4. REASON (OpenAI) ----------------------------------------------------
  // Deterministic proposal: highest expected value (candidates are EV-ranked).
  // The model articulates the reasoning; it does not get to change the pick.
  let chosen = candidates[0];
  const rs = reasoningResult || (await reason(dg.data.diagnosis, candidates, chosen, task, robot));
  emit({
    stage: 'REASON',
    status: 'ok',
    title: 'Agent reasons about the economics',
    text: rs.data.justification,
    chosen_skill_id: chosen.id,
    chosen_skill: chosen,
    rejected: rs.data.rejected,
    source: rs.source,
  });
  await sleep(delayMs);

  // 5. POLICY (deterministic) --------------------------------------------
  let policy = applyPolicy(chosen, robot);
  const fallbackChain = [];
  // If the model's pick is hard-blocked, fall back to the next best candidate.
  while (policy.decision === 'block') {
    fallbackChain.push({ skill: chosen, reasons: policy.reasons });
    const next = candidates.find(
      (c) => c.id !== chosen.id && !fallbackChain.some((f) => f.skill.id === c.id)
    );
    if (!next) break;
    chosen = next;
    policy = applyPolicy(chosen, robot);
  }
  emit({
    stage: 'POLICY',
    status: policy.decision === 'block' ? 'fail' : policy.decision === 'flag' ? 'warn' : 'ok',
    title: 'Policy engine reviews the purchase',
    decision: policy.decision,
    reasons: policy.reasons,
    chosen_skill: chosen,
    blocked: fallbackChain.map((f) => ({ skill: f.skill, reasons: f.reasons })),
    text:
      fallbackChain.length > 0
        ? `${fallbackChain[0].skill.name} was blocked — falling back to ${chosen.name}.`
        : `${chosen.name} ${policy.decision === 'approve' ? 'auto-approved' : 'flagged for approval'}.`,
  });
  await sleep(delayMs);

  if (policy.decision === 'block') {
    // Nothing purchasable — end gracefully without a purchase.
    emit({
      stage: 'RECEIPT',
      status: 'fail',
      title: 'No compliant option',
      text: 'Every candidate was blocked by policy. No purchase made.',
    });
    return { purchased: false };
  }

  // 6. PURCHASE -----------------------------------------------------------
  robot.spent += chosen.price;
  robot.monthlyBudget; // (budget is the ceiling; remaining derived on read)
  if (!robot.capabilities.includes(task.requiredCapability)) {
    robot.capabilities.push(task.requiredCapability);
  }
  robot.history.push({ label: chosen.name, amount: chosen.price, ts: '2026-07-18' });
  emit({
    stage: 'PURCHASE',
    status: 'ok',
    title: 'Purchase executed on virtual card',
    text: `Charged $${chosen.price} to ${robot.name}'s card. Capability "${task.requiredCapability}" installed.`,
    amount: chosen.price,
    spent: robot.spent,
    remaining: robot.monthlyBudget - robot.spent,
  });
  await sleep(delayMs);

  // Shared receipt fields (used by both the success and escalation paths).
  const receiptBase = {
    id: receiptId,
    ts: '2026-07-18',
    robot: { id: robot.id, name: robot.name },
    task: { id: task.id, description: task.description },
    diagnosis: dg.data.diagnosis,
    skill: { id: chosen.id, name: chosen.name, vendor: chosen.vendor, price: chosen.price, pricingModel: chosen.pricingModel },
    alternatives: rs.data.rejected || [],
    blocked: fallbackChain.map((f) => ({ name: f.skill.name, reasons: f.reasons })),
    taskValue: task.taskValue,
    humanBaseline: task.humanBaselineCost,
    downtimeAvoided: task.downtimeCost || 0,
    category: chosen.category,
    policyDecision: policy.decision,
  };

  // 7. RETRY --------------------------------------------------------------
  if (simulateFailure) {
    // The purchased skill underperformed in the physical world. Escalate to an
    // approved human operator — governed, time-boxed, fully logged.
    emit({
      stage: 'RETRY',
      status: 'fail',
      title: 'Robot retries the task',
      text: `${robot.name} retried with ${chosen.name} but the grasp failed — real-world confidence stayed below threshold.`,
    });
    await sleep(delayMs);
    emit({
      stage: 'ESCALATE',
      status: 'warn',
      title: 'Escalating to an approved human operator',
      text: `${chosen.name} underperformed. Requesting a time-boxed session from an approved operator vendor. All actions will be recorded and access revoked when the task ends.`,
    });
    // Hand back the context so the operator console can finalize the receipt.
    return {
      purchased: true,
      needsOperator: true,
      escalation: { receiptBase, skillCost: chosen.price, robotId: robot.id },
    };
  }

  emit({
    stage: 'RETRY',
    status: 'ok',
    title: 'Robot retries the task',
    text: `${robot.name} retried "${task.description}" with ${chosen.name} and succeeded (${Math.round(chosen.successRate * 100)}% expected).`,
  });
  await sleep(delayMs);
  robot.tasksCompleted += 1;

  // 8. RECEIPT ------------------------------------------------------------
  const netSaved = task.humanBaselineCost - chosen.price;
  const receipt = { ...receiptBase, outcome: 'success', cost: chosen.price, netSaved };
  emit({ stage: 'RECEIPT', status: 'ok', title: 'Receipt emitted', text: 'Purchase justified and logged.', receipt });

  return { purchased: true, receipt, netSaved };
}

// Called by the operator console (POST /api/operator) to finalize an escalated
// task after a human resolves it. Deterministic — no model involved.
export function resolveWithOperator(escalation, robot, operatorCost = 55) {
  const { receiptBase, skillCost } = escalation;
  const totalCost = skillCost + operatorCost;
  robot.spent += operatorCost;
  robot.history.push({ label: 'Human Operator (escalation)', amount: operatorCost, ts: '2026-07-18' });
  robot.tasksCompleted += 1;
  const netSaved = receiptBase.humanBaseline - totalCost;
  const receipt = {
    ...receiptBase,
    outcome: 'resolved by operator',
    operator: { vendor: 'RemoteAssist (approved)', cost: operatorCost, accessRevoked: true },
    cost: totalCost,
    skillCost,
    operatorCost,
    netSaved,
  };
  return { receipt, netSaved };
}
