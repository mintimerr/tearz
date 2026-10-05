import type { AssessmentConfig } from './config.js';
import {
  CEFR_LEVELS,
  combineConfidence,
  confidenceLabelFromValue,
  DEFAULT_ASSESSMENT_CONFIG,
} from './config.js';
import { skillCoverageScore } from './skill-profile.js';
import type {
  AnswerRecord,
  AssessmentSkill,
  CredibleInterval,
  LevelProbabilities,
  SkillEvidence,
} from './types.js';

export type ConfidenceBreakdown = {
  measurementConfidence: number;
  qualityConfidence: number;
  confidence: number;
  confidenceLabel: ReturnType<typeof confidenceLabelFromValue>;
};

/**
 * measurementConfidence: from posterior uncertainty (CI width + top-level mass).
 * qualityConfidence: boundary evidence, coverage, informative scored items, consistency.
 * Combined via config.confidenceFormula (provisional geometric mean v1).
 */
export function computeConfidence(args: {
  levelProbabilities: LevelProbabilities;
  thetaCredibleInterval: CredibleInterval;
  answerHistory: AnswerRecord[];
  skillProfile: Partial<Record<AssessmentSkill, SkillEvidence>>;
  config?: AssessmentConfig;
}): ConfidenceBreakdown {
  const config = args.config ?? DEFAULT_ASSESSMENT_CONFIG;
  const measurement = measurementConfidence(
    args.levelProbabilities,
    args.thetaCredibleInterval,
    config,
  );
  const quality = qualityConfidence(
    args.answerHistory,
    args.skillProfile,
    args.thetaCredibleInterval,
    config,
  );
  const confidence = combineConfidence(measurement, quality, config);
  return {
    measurementConfidence: measurement,
    qualityConfidence: quality,
    confidence,
    confidenceLabel: confidenceLabelFromValue(confidence, config),
  };
}

function measurementConfidence(
  probs: LevelProbabilities,
  ci: CredibleInterval,
  config: AssessmentConfig,
): number {
  let top = 0;
  for (const L of CEFR_LEVELS) top = Math.max(top, probs[L]);

  const span = config.thetaMax - config.thetaMin;
  const ciWidth = Math.max(0, ci.upper - ci.lower);
  // Narrow CI → high confidence. Full-span CI → ~0.
  const ciScore = 1 - Math.min(1, ciWidth / (span * 0.85));

  // Blend concentration of level mass with CI tightness.
  return clamp01(0.55 * top + 0.45 * ciScore);
}

function qualityConfidence(
  history: AnswerRecord[],
  skillProfile: Partial<Record<AssessmentSkill, SkillEvidence>>,
  _ci: CredibleInterval,
  config: AssessmentConfig,
): number {
  const scored = history.filter((h) => h.isScored);
  if (scored.length === 0) return 0.15;

  const informative = scored.filter(
    (h) => h.fisherInformation >= config.quality.informativeFisherThreshold,
  ).length;
  const informativeRatio = Math.min(
    1,
    informative / config.quality.minInformativeItemsForFull,
  );

  const coverage = skillCoverageScore(skillProfile);

  // Boundary: scored items with |b − θ_after| small on average presence.
  let boundaryHits = 0;
  for (const h of scored) {
    if (Math.abs(h.difficulty - h.thetaAfter) <= config.verification.boundaryHalfWidth) {
      boundaryHits += 1;
    }
  }
  const boundaryScore = Math.min(1, boundaryHits / 3);

  const flips = contradictionFlips(scored);
  const consistency = Math.max(0, 1 - flips * config.quality.contradictionFlipPenalty);

  return clamp01(
    0.35 * informativeRatio + 0.25 * coverage + 0.25 * boundaryScore + 0.15 * consistency,
  );
}

function contradictionFlips(scored: AnswerRecord[]): number {
  if (scored.length < 4) return 0;
  let flips = 0;
  for (let i = 1; i < scored.length; i += 1) {
    const a = scored[i - 1];
    const b = scored[i];
    // Flip between nearby difficulties is more contradictory.
    if (a.correct !== b.correct && Math.abs(a.difficulty - b.difficulty) < 1.0) {
      flips += 1;
    }
  }
  return flips;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
