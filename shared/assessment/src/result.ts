import type { AssessmentConfig } from './config.js';
import { DEFAULT_ASSESSMENT_CONFIG } from './config.js';
import { computeConfidence } from './confidence.js';
import { summarizePosterior } from './posterior.js';
import { thetaToLegacyAbility100, statisticalEstimateFromProbs } from './scale.js';
import { buildEvidence, verifyPlacementLevel } from './verification.js';
import type { AssessmentResult, AssessmentState } from './types.js';

export function finalizeAssessment(
  state: AssessmentState,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): AssessmentResult {
  const summary = summarizePosterior(state.thetaGrid, state.posterior, config);
  const statisticalEstimate = statisticalEstimateFromProbs(summary.levelProbabilities);
  const { verified, verification } = verifyPlacementLevel(
    statisticalEstimate,
    state.answerHistory,
    config,
  );
  const conf = computeConfidence({
    levelProbabilities: summary.levelProbabilities,
    thetaCredibleInterval: summary.thetaCredibleInterval,
    answerHistory: state.answerHistory,
    skillProfile: state.skillEvidence,
    config,
  });
  const evidence = buildEvidence(state.answerHistory, verified, summary.theta, config);

  return {
    cefrLevel: verified,
    verifiedPlacementLevel: verified,
    statisticalEstimate,
    theta: summary.theta,
    thetaCredibleInterval: summary.thetaCredibleInterval,
    confidence: conf.confidence,
    measurementConfidence: conf.measurementConfidence,
    qualityConfidence: conf.qualityConfidence,
    confidenceLabel: conf.confidenceLabel,
    levelProbabilities: summary.levelProbabilities,
    skillProfile: state.skillEvidence,
    verification,
    evidence,
    answerHistory: state.answerHistory,
    legacyAbility100: thetaToLegacyAbility100(summary.theta, config),
  };
}
