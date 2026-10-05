import type { AssessmentConfig } from './config.js';
import { DEFAULT_ASSESSMENT_CONFIG } from './config.js';
import { fisherInformation, resolveIrtParams } from './irt.js';
import type { AssessmentSkill, AssessmentState, ItemMeta } from './types.js';

export type ScoredCandidate = {
  item: ItemMeta;
  fisherInformation: number;
  skillBonus: number;
  totalScore: number;
};

/**
 * Rank candidates by Fisher information at current EAP × skill-coverage bonus.
 * Experimental / unscored items can be included but should not dominate when
 * scored alternatives exist (caller policy).
 */
export function rankItemsForTheta(
  state: AssessmentState,
  candidates: ItemMeta[],
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): ScoredCandidate[] {
  const seenSkills = new Set(
    Object.entries(state.skillEvidence)
      .filter(([, v]) => (v?.attempts ?? 0) > 0)
      .map(([k]) => k as AssessmentSkill),
  );

  const scored = candidates.map((item) => {
    const params = resolveIrtParams(item, config);
    const fisher = item.isScored
      ? fisherInformation(state.theta, params.a, params.b, params.c)
      : fisherInformation(state.theta, params.a, params.b, params.c) * 0.15;
    const skillBonus = seenSkills.has(item.skill) ? 0 : 0.35;
    const novelty =
      state.answerHistory.some((h) => h.questionId === item.id) ? -10 : 0;
    const totalScore = fisher + skillBonus + novelty;
    return { item, fisherInformation: fisher, skillBonus, totalScore };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  return scored;
}

export function pickNextItem(
  state: AssessmentState,
  candidates: ItemMeta[],
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): ItemMeta | null {
  const ranked = rankItemsForTheta(state, candidates, config);
  // Prefer scored items among top candidates.
  const scored = ranked.find((c) => c.item.isScored);
  return (scored ?? ranked[0])?.item ?? null;
}
