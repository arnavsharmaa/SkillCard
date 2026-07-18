// Hardcoded but realistic canned responses. Used as the catch fallback for both
// OpenAI calls so the demo NEVER breaks. Also used directly when RUN_STUBBED=1.
// Keyed by task id, with a generic default. These read like a real engineer.

export const CANNED_DIAGNOSIS = {
  'task-01': {
    diagnosis:
      "The robot drove straight at the bottle and stalled — its depth camera reads the clear plastic as empty floor, so it never registers an obstacle to move. This is a sensing gap, not a motion-planning failure.",
    missing_capability: 'transparent-object-grasp',
    confidence: 0.93,
  },
  'task-02': {
    diagnosis:
      "OCR confidence collapsed below 0.3 on every frame. The label is legible to a human but the current vision stack has no low-light text model, so characters resolve as noise.",
    missing_capability: 'ocr-lowlight',
    confidence: 0.9,
  },
  'task-03': {
    diagnosis:
      "Surface cameras can see the weld bead but cannot resolve sub-surface micro-fractures. The unit lacks any penetrating weld-inspection capability, so it cannot certify the seam.",
    missing_capability: 'weld-inspection',
    confidence: 0.95,
  },
  'task-04': {
    diagnosis:
      "The robot detects objects on the conveyor but classifies every item as 'unknown material.' Without a spectral material model it cannot decide which bin each piece belongs to.",
    missing_capability: 'material-classification',
    confidence: 0.88,
  },
  'task-05': {
    diagnosis:
      "Standard navigation aborted at the waterline — the floor plane estimator fails on reflective standing water and the unit has no flood-rated navigation policy to fall back on.",
    missing_capability: 'flood-navigation',
    confidence: 0.86,
  },
  default: {
    diagnosis:
      "The task failed because the robot is missing a required capability. Telemetry shows repeated retries with low sensor confidence and no successful actuation.",
    missing_capability: 'unknown',
    confidence: 0.8,
  },
};

// Reasoning fallback is generated dynamically from the actual candidate list so
// it always references real skills/prices. Returns strict-JSON-shaped object.
export function cannedReasoning(candidates, task, preChosen) {
  if (!candidates || candidates.length === 0) {
    return { chosen_skill_id: null, justification: 'No candidate skills available.', rejected: [] };
  }

  // Score by expected value. The agent optimizes PURE expected value; the
  // downstream policy engine disposes (may block and force a fallback).
  const scored = candidates.map((c) => ({
    skill: c,
    ev: Math.round(task.taskValue * c.successRate - c.price),
  }));
  scored.sort((a, b) => b.ev - a.ev);

  // Use the caller's deterministic pick when provided (keeps fallback aligned
  // with the server's choice); otherwise the highest-EV option.
  const chosen = (preChosen && scored.find((s) => s.skill.id === preChosen.id)) || scored[0];

  const rejected = scored
    .filter((s) => s.skill.id !== chosen.skill.id)
    .map((s) => {
      const c = s.skill;
      let reason;
      if ((c.requiredHardware || []).length > 0) {
        reason = `Requires ${c.requiredHardware.join(', ')} hardware the robot does not have.`;
      } else if (c.category === 'teleop') {
        reason = `Human teleop at $${c.price} is reliable but far exceeds the cheaper autonomous option and burns budget.`;
      } else if (c.successRate < 0.8) {
        reason = `At ${Math.round(c.successRate * 100)}% success its expected value ($${s.ev}) trails the chosen skill despite the low price.`;
      } else {
        reason = `Priced at $${c.price} it delivers similar success for a worse expected value ($${s.ev}).`;
      }
      return { skill_id: c.id, reason };
    });

  const justification =
    `${chosen.skill.name} clears the task at ${Math.round(chosen.skill.successRate * 100)}% for $${chosen.skill.price}, ` +
    `an expected value of $${chosen.ev} against the $${task.taskValue} task value — the strongest economics of any candidate. ` +
    `Policy review is a separate step.`;

  return { chosen_skill_id: chosen.skill.id, justification, rejected };
}

// Fake telemetry for the ATTEMPT stage. Deterministic per task.
export function makeTelemetry(task) {
  const codes = {
    'task-01': 'E_GRASP_EMPTY',
    'task-02': 'E_OCR_LOWCONF',
    'task-03': 'E_SUBSURFACE_UNRESOLVED',
    'task-04': 'E_CLASS_UNKNOWN',
    'task-05': 'E_PLANE_LOST',
  };
  // Stable pseudo-values derived from the task id.
  const n = parseInt(task.id.replace(/\D/g, ''), 10) || 1;
  return {
    grasp_force_N: (0.2 + n * 0.05).toFixed(2),
    depth_confidence: (0.18 + (n % 3) * 0.04).toFixed(2),
    retry_count: 2 + (n % 3),
    error_code: codes[task.id] || 'E_CAPABILITY_MISSING',
    duration_ms: 1400 + n * 130,
  };
}
