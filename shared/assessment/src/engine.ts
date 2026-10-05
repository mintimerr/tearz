import type { AssessmentConfig } from './config.js';
import { DEFAULT_ASSESSMENT_CONFIG, reliabilityForItem } from './config.js';
import { fisherInformation, resolveIrtParams } from './irt.js';
import { buildNormalPrior, buildThetaGrid } from './prior.js';
import { updatePosterior, summarizePosterior } from './posterior.js';
import { finalizeAssessment } from './result.js';
import { statisticalEstimateFromProbs } from './scale.js';
import { updateSkillEvidence } from './skill-profile.js';
import type {
  AnswerRecord,
  AssessmentResult,
  AssessmentState,
  ItemMeta,
  ScoringResponse,
} from './types.js';

export function createAssessmentState(
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): AssessmentState {
  const thetaGrid = buildThetaGrid(config);
  const prior = buildNormalPrior(thetaGrid, config);
  const posterior = [...prior];
  const summary = summarizePosterior(thetaGrid, posterior, config);
  return {
    configId: config.configId,
    thetaGrid,
    prior,
    posterior,
    theta: summary.theta,
    thetaCredibleInterval: summary.thetaCredibleInterval,
    levelProbabilities: summary.levelProbabilities,
    skillEvidence: {},
    answerHistory: [],
    scoredAnswerCount: 0,
  };
}

export type ApplyAnswerResult = {
  state: AssessmentState;
  record: AnswerRecord;
};

/**
 * Apply one response. Unscored items update history only.
 * Timeout uses responseWeight < 1 (soft incorrect likelihood).
 */
export function applyAnswer(
  state: AssessmentState,
  item: ItemMeta,
  response: ScoringResponse,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): ApplyAnswerResult {
  const params = resolveIrtParams(item, config);
  const timedOut = response.timedOut === true;
  const correct = timedOut ? false : response.correct === true;
  const thetaBefore = state.theta;
  const fisher = fisherInformation(thetaBefore, params.a, params.b, params.c);

  let responseWeight = 1;
  if (!item.isScored) responseWeight = config.unscoredResponseWeight;
  else if (timedOut) responseWeight = config.timeoutResponseWeight;

  const itemReliability = item.isScored
    ? reliabilityForItem(item.calibrationStatus, config)
    : 0;
  const effectiveWeight = responseWeight * itemReliability;

  let posterior = state.posterior;
  let theta = state.theta;
  let ci = state.thetaCredibleInterval;
  let levelProbabilities = state.levelProbabilities;
  let posteriorInformationGain = 0;
  let scoredAnswerCount = state.scoredAnswerCount;

  if (item.isScored && effectiveWeight > 0) {
    const updated = updatePosterior(
      state.thetaGrid,
      state.posterior,
      params,
      correct,
      effectiveWeight,
      config,
    );
    posterior = updated.posterior;
    theta = updated.theta;
    ci = updated.thetaCredibleInterval;
    levelProbabilities = updated.levelProbabilities;
    posteriorInformationGain = updated.posteriorInformationGain;
    scoredAnswerCount += 1;
  }

  const record: AnswerRecord = {
    questionId: item.id,
    skill: item.skill,
    construct: item.construct,
    itemType: item.itemType,
    responseFormat: item.responseFormat,
    targetLevel: item.targetLevel,
    difficultyWithinLevel: item.difficultyWithinLevel,
    difficulty: params.b,
    discrimination: params.a,
    guessingProbability: params.c,
    correct,
    timedOut,
    selectedAnswer: response.selectedAnswer,
    responseTimeMs: response.responseTimeMs,
    responseWeight: effectiveWeight,
    isScored: item.isScored,
    thetaBefore,
    thetaAfter: theta,
    fisherInformation: fisher,
    posteriorInformationGain,
    timestamp: response.timestamp ?? Date.now(),
  };

  const skillEvidence = updateSkillEvidence(state.skillEvidence, record);

  const next: AssessmentState = {
    ...state,
    posterior,
    theta,
    thetaCredibleInterval: ci,
    levelProbabilities,
    skillEvidence,
    answerHistory: [...state.answerHistory, record],
    scoredAnswerCount,
  };

  return { state: next, record };
}

export function getStatisticalEstimate(state: AssessmentState) {
  return statisticalEstimateFromProbs(state.levelProbabilities);
}

export function finalize(
  state: AssessmentState,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): AssessmentResult {
  return finalizeAssessment(state, config);
}

/** Convenience: run a full scored sequence for tests / sims. */
export function runSequence(
  itemsAndResponses: { item: ItemMeta; response: ScoringResponse }[],
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): { state: AssessmentState; result: AssessmentResult } {
  let state = createAssessmentState(config);
  for (const step of itemsAndResponses) {
    state = applyAnswer(state, step.item, step.response, config).state;
  }
  return { state, result: finalize(state, config) };
}
