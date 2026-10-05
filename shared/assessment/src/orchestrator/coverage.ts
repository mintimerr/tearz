import type { AssessmentSkill } from '../types.js';
import type { OrchestratorConfig } from './config.js';
import { DEFAULT_ORCHESTRATOR_CONFIG } from './config.js';
import type { AdaptiveTestState } from './types.js';

export type CoverageSnapshot = {
  scoredRemaining: number;
  deficits: Partial<Record<AssessmentSkill, number>>;
  /** Priority 0..1+ for each skill (higher = more urgent). */
  skillPriority: Partial<Record<AssessmentSkill, number>>;
  allMinimaMet: boolean;
};

export function scoredSkillCount(
  state: AdaptiveTestState,
  skill: AssessmentSkill,
): number {
  return state.skillCounts[skill] ?? 0;
}

export function computeCoverageSnapshot(
  orch: AdaptiveTestState,
  config: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
): CoverageSnapshot {
  const presented = orch.presentedItems.length;
  const remainingSlots = Math.max(0, config.totalPresentedItems - presented);
  // Prefer to reserve experimental budget from scoring capacity when estimating pressure
  const experimentalLeft = Math.max(
    0,
    config.maxExperimentalItems - orch.experimentalItemIds.length,
  );
  const scoredRemaining = Math.max(0, remainingSlots - Math.min(experimentalLeft, remainingSlots));

  const deficits: Partial<Record<AssessmentSkill, number>> = {};
  const skillPriority: Partial<Record<AssessmentSkill, number>> = {};
  let allMinimaMet = true;

  for (const [skill, min] of Object.entries(config.skillMinima) as Array<
    [AssessmentSkill, number]
  >) {
    const have = scoredSkillCount(orch, skill);
    const need = Math.max(0, min - have);
    deficits[skill] = need;
    if (need > 0) allMinimaMet = false;
    // Urgency rises as remaining slots shrink relative to deficit
    if (need <= 0) {
      skillPriority[skill] = 0;
    } else if (scoredRemaining <= 0) {
      skillPriority[skill] = 3;
    } else {
      skillPriority[skill] = need / scoredRemaining + (scoredRemaining <= need + 1 ? 1.25 : 0);
    }
  }

  return { scoredRemaining, deficits, skillPriority, allMinimaMet };
}

export function consecutiveSkillRun(
  orch: AdaptiveTestState,
  skill: AssessmentSkill,
): number {
  let n = 0;
  for (let i = orch.presentedItems.length - 1; i >= 0; i -= 1) {
    if (orch.presentedItems[i].item.skill === skill) n += 1;
    else break;
  }
  return n;
}

export function consecutiveConstructRun(orch: AdaptiveTestState, construct: string): number {
  let n = 0;
  for (let i = orch.presentedItems.length - 1; i >= 0; i -= 1) {
    if (orch.presentedItems[i].item.construct === construct) n += 1;
    else break;
  }
  return n;
}
