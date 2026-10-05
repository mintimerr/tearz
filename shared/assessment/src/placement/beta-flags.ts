/**
 * Beta feature flags for AI-generated placement items.
 * Psychometric / Quality Gate thresholds are NOT altered here —
 * only whether AI items may enter the scoring path.
 */

export type AiItemScoringPolicy =
  /** Beta default: AI items never contribute scoring evidence. */
  | 'never_score'
  /** AI items may score only after full gate PASS + eligibility. */
  | 'require_full_gate'
  /** Allow provisional PASS AI items to score with reduced reliability weight. */
  | 'allow_provisional_scoring';

export type PlacementBetaFlags = {
  /**
   * Remote AI-generated items scoring policy.
   * Preferred beta default: never_score until pipeline proven end-to-end.
   */
  aiItemScoringPolicy: AiItemScoringPolicy;
  /**
   * If semantic/adversarial reviewer unavailable → fail closed (no AI scoring).
   * Always true in beta; exposed for tests.
   */
  failClosedOnReviewerUnavailable: boolean;
};

export const DEFAULT_PLACEMENT_BETA_FLAGS: PlacementBetaFlags = {
  aiItemScoringPolicy: 'never_score',
  failClosedOnReviewerUnavailable: true,
};

export function resolveAiScoringAllowed(
  flags: PlacementBetaFlags,
  gate: {
    fullGateCompleted: boolean;
    qualityGate: 'PASS' | 'REVISE' | 'REJECT' | null;
    reviewersAvailable: boolean;
    eligibilityIsScored: boolean;
  },
): { mayScore: boolean; reason: string } {
  if (!gate.reviewersAvailable && flags.failClosedOnReviewerUnavailable) {
    return { mayScore: false, reason: 'reviewer_unavailable' };
  }
  if (!gate.qualityGate || gate.qualityGate !== 'PASS') {
    return { mayScore: false, reason: 'quality_not_pass' };
  }
  if (!gate.fullGateCompleted) {
    return { mayScore: false, reason: 'full_gate_incomplete' };
  }

  if (flags.aiItemScoringPolicy === 'never_score') {
    return { mayScore: false, reason: 'beta_never_score' };
  }
  if (flags.aiItemScoringPolicy === 'require_full_gate') {
    return {
      mayScore: gate.eligibilityIsScored,
      reason: gate.eligibilityIsScored ? 'full_gate_ok' : 'eligibility_not_scored',
    };
  }
  // allow_provisional_scoring
  return {
    mayScore: gate.eligibilityIsScored,
    reason: gate.eligibilityIsScored ? 'provisional_ok' : 'eligibility_not_scored',
  };
}
