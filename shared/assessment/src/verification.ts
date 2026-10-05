import type { AssessmentConfig } from './config.js';
import { CEFR_LEVELS, DEFAULT_ASSESSMENT_CONFIG } from './config.js';
import { cefrRank, minCefr } from './scale.js';
import type {
  AnswerRecord,
  AssessmentEvidence,
  AssessmentVerification,
  CefrLevel,
} from './types.js';

/**
 * verifiedPlacementLevel may be capped below statisticalEstimate.
 * Posterior / levelProbabilities / statisticalEstimate are NEVER altered here.
 */
export function verifyPlacementLevel(
  statisticalEstimate: CefrLevel,
  answerHistory: AnswerRecord[],
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): { verified: CefrLevel; verification: AssessmentVerification } {
  const scored = answerHistory.filter((h) => h.isScored && !h.timedOut && h.correct);
  const supportC2 = scored.filter((h) => h.difficulty >= 2.0).length;
  const supportC1 = scored.filter((h) => h.difficulty >= 1.0).length;
  const supportB2 = scored.filter((h) => h.difficulty >= 0.0).length;
  const supportB1 = scored.filter((h) => h.difficulty >= -1.0).length;

  let maxAllowed: CefrLevel = 'C2';
  let reason: AssessmentVerification['reason'] = 'ok';
  let details: string | undefined;

  if (supportC2 < config.verification.minC2Supporting) {
    maxAllowed = minCefr(maxAllowed, 'C1');
    if (cefrRank(statisticalEstimate) >= cefrRank('C2')) {
      reason = 'insufficient_high_level_evidence';
      details = `C2 requires ≥${config.verification.minC2Supporting} scored corrects with b≥2.0; got ${supportC2}`;
    }
  }
  if (supportC1 < config.verification.minC1Supporting) {
    maxAllowed = minCefr(maxAllowed, 'B2');
    if (cefrRank(statisticalEstimate) >= cefrRank('C1') && reason === 'ok') {
      reason = 'insufficient_high_level_evidence';
      details = `C1 requires ≥${config.verification.minC1Supporting} scored corrects with b≥1.0; got ${supportC1}`;
    }
  }
  if (supportB2 < config.verification.minB2Supporting) {
    maxAllowed = minCefr(maxAllowed, 'B1');
    if (cefrRank(statisticalEstimate) >= cefrRank('B2') && reason === 'ok') {
      reason = 'insufficient_mid_level_evidence';
      details = `B2 requires ≥${config.verification.minB2Supporting} scored corrects with b≥0; got ${supportB2}`;
    }
  }
  if (supportB1 < config.verification.minB1Supporting) {
    maxAllowed = minCefr(maxAllowed, 'A2');
    if (cefrRank(statisticalEstimate) >= cefrRank('B1') && reason === 'ok') {
      reason = 'insufficient_mid_level_evidence';
      details = `B1 requires ≥${config.verification.minB1Supporting} scored corrects with b≥-1; got ${supportB1}`;
    }
  }
  if (scored.length === 0) {
    maxAllowed = 'A1';
    reason = 'insufficient_mid_level_evidence';
    details = 'No scored correct answers';
  }

  const verified = minCefr(statisticalEstimate, maxAllowed);
  return {
    verified,
    verification: {
      applied: verified !== statisticalEstimate,
      reason: verified === statisticalEstimate ? 'ok' : reason,
      details,
    },
  };
}

export function buildEvidence(
  answerHistory: AnswerRecord[],
  verified: CefrLevel,
  theta: number,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): AssessmentEvidence {
  const scored = answerHistory.filter((h) => h.isScored);
  const supportingItems: string[] = [];
  const boundaryItems: string[] = [];
  const contradictoryItems: string[] = [];

  for (const h of scored) {
    const nearBoundary =
      Math.abs(h.difficulty - theta) <= config.verification.boundaryHalfWidth;
    if (h.correct && !h.timedOut && h.difficulty >= theta - 0.3) {
      supportingItems.push(h.questionId);
    }
    if (nearBoundary) boundaryItems.push(h.questionId);
    if (!h.correct && h.difficulty < theta - 0.8) {
      contradictoryItems.push(h.questionId);
    }
    if (h.correct && !h.timedOut && h.difficulty > theta + 1.2) {
      // Lucky hard hit — mark as contradictory to low estimate context via evidence list
      // (kept for analytics; does not move posterior).
      if (!supportingItems.includes(h.questionId)) {
        /* ignore */
      }
    }
  }

  return {
    supportingItems,
    boundaryItems,
    contradictoryItems,
    highestConsistentlyDemonstratedLevel: highestConsistentLevel(scored, verified, config),
  };
}

function highestConsistentLevel(
  scored: AnswerRecord[],
  floor: CefrLevel,
  config: AssessmentConfig,
): CefrLevel {
  // Walk from high to low; first level that meets its support threshold.
  const corrects = scored.filter((h) => h.correct && !h.timedOut);
  const checks: { level: CefrLevel; need: number; minB: number }[] = [
    { level: 'C2', need: config.verification.minC2Supporting, minB: 2.0 },
    { level: 'C1', need: config.verification.minC1Supporting, minB: 1.0 },
    { level: 'B2', need: config.verification.minB2Supporting, minB: 0.0 },
    { level: 'B1', need: config.verification.minB1Supporting, minB: -1.0 },
    { level: 'A2', need: 1, minB: -2.0 },
    { level: 'A1', need: 0, minB: -3.5 },
  ];
  for (const c of checks) {
    const n = corrects.filter((h) => h.difficulty >= c.minB).length;
    if (n >= c.need) return c.level;
  }
  return floor;
}

export function assertCefrLevel(level: string): level is CefrLevel {
  return (CEFR_LEVELS as string[]).includes(level);
}
