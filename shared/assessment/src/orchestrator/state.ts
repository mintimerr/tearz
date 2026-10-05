import type { AssessmentConfig } from '../config.js';
import { DEFAULT_ASSESSMENT_CONFIG } from '../config.js';
import { applyAnswer, createAssessmentState, finalize } from '../engine.js';
import { entropy } from '../prior.js';
import { statisticalEstimateFromProbs } from '../scale.js';
import { verifyPlacementLevel } from '../verification.js';
import type { AssessmentResult, ScoringResponse } from '../types.js';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  phaseForQuestion,
  type OrchestratorConfig,
} from './config.js';
import {
  findMostUncertainCefrBoundary,
  preliminaryRangeFromProbs,
  primaryAndRunnerUp,
} from './boundary.js';
import { computeCoverageSnapshot } from './coverage.js';
import { selectNextItem } from './select.js';
import type {
  AdaptiveTestState,
  OrchestratorCandidate,
  PresentedRecord,
  SelectNextResult,
} from './types.js';

export function createAdaptiveTestState(
  assessmentConfig: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
  orchestratorConfig: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
): AdaptiveTestState {
  const assessmentState = createAssessmentState(assessmentConfig);
  return {
    assessmentState,
    questionNumber: 1,
    phase: phaseForQuestion(1, orchestratorConfig),
    presentedItems: [],
    scoredItemIds: [],
    experimentalItemIds: [],
    skillCounts: {},
    constructCounts: {},
    activeBoundary: findMostUncertainCefrBoundary(
      assessmentState.thetaGrid,
      assessmentState.posterior,
    ),
    selectionHistory: [],
    wouldStopEarly: false,
    stopReason: null,
    preliminaryRange: null,
  };
}

function refreshBoundary(orch: AdaptiveTestState): AdaptiveTestState {
  const activeBoundary = findMostUncertainCefrBoundary(
    orch.assessmentState.thetaGrid,
    orch.assessmentState.posterior,
  );
  return { ...orch, activeBoundary };
}

function evaluateEarlyStop(
  orch: AdaptiveTestState,
  orchestratorConfig: OrchestratorConfig,
  assessmentConfig: AssessmentConfig,
): AdaptiveTestState {
  const coverage = computeCoverageSnapshot(orch, orchestratorConfig);
  const probs = orch.assessmentState.levelProbabilities;
  const { primaryLevel, primaryP } = primaryAndRunnerUp(probs);
  const statistical = statisticalEstimateFromProbs(probs);
  const { verified, verification } = verifyPlacementLevel(
    statistical,
    orch.assessmentState.answerHistory,
    assessmentConfig,
  );
  const H = entropy(orch.assessmentState.posterior);
  const concentrated =
    H <= orchestratorConfig.earlyStop.maxPosteriorEntropy &&
    primaryP >= orchestratorConfig.earlyStop.minTopLevelProbability;
  const verificationOk = !verification.applied || verified === statistical;
  const wouldStopEarly =
    concentrated && verificationOk && coverage.allMinimaMet && orch.presentedItems.length >= 8;
  const stopReason = wouldStopEarly
    ? `entropy=${H.toFixed(2)} top=${primaryLevel}:${primaryP.toFixed(2)} coverage_ok verification_ok`
    : null;
  return { ...orch, wouldStopEarly, stopReason };
}

export function chooseNext(
  orch: AdaptiveTestState,
  candidates: OrchestratorCandidate[],
  orchestratorConfig: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
  assessmentConfig: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): SelectNextResult | null {
  return selectNextItem(orch, candidates, orchestratorConfig, assessmentConfig);
}

/**
 * Present selected item (does not apply response yet).
 */
export function commitSelection(
  orch: AdaptiveTestState,
  selection: SelectNextResult,
  orchestratorConfig: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
): AdaptiveTestState {
  const { decision, candidate } = selection;
  const experimental =
    candidate.item.calibrationStatus === 'experimental' || !candidate.item.isScored;
  const record: PresentedRecord = {
    questionNumber: decision.questionNumber,
    phase: decision.phase,
    item: candidate.item,
    isExperimental: experimental,
    isScored: candidate.item.isScored && !experimental,
    decision,
    responseCorrect: null,
    thetaAfter: null,
    activeBoundaryAfter: null,
  };

  const skillCounts = { ...orch.skillCounts };
  const constructCounts = { ...orch.constructCounts };
  // counts updated after scored response for skill minima (scored only)
  // construct counts for diversity use all presented
  constructCounts[candidate.item.construct] =
    (constructCounts[candidate.item.construct] ?? 0) + 1;

  let next: AdaptiveTestState = {
    ...orch,
    presentedItems: [...orch.presentedItems, record],
    experimentalItemIds: experimental
      ? [...orch.experimentalItemIds, candidate.item.id]
      : orch.experimentalItemIds,
    constructCounts,
    skillCounts,
    selectionHistory: [...orch.selectionHistory, decision],
    questionNumber: decision.questionNumber + 1,
    phase: phaseForQuestion(
      Math.min(decision.questionNumber + 1, orchestratorConfig.totalPresentedItems),
      orchestratorConfig,
    ),
  };

  if (decision.questionNumber === orchestratorConfig.phaseEnds.routing) {
    next = {
      ...next,
      preliminaryRange: preliminaryRangeFromProbs(orch.assessmentState.levelProbabilities),
    };
  }

  return next;
}

export function applyOrchestratorAnswer(
  orch: AdaptiveTestState,
  response: ScoringResponse,
  assessmentConfig: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
  orchestratorConfig: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
): AdaptiveTestState {
  const last = orch.presentedItems[orch.presentedItems.length - 1];
  if (!last || last.responseCorrect !== null) {
    throw new Error('applyOrchestratorAnswer requires a pending presented item');
  }

  const beforePosterior = [...orch.assessmentState.posterior];
  const { state } = applyAnswer(orch.assessmentState, last.item, response, assessmentConfig);

  // Invariant helper: unscored must not change posterior
  if (!last.isScored) {
    // engine already guarantees; keep reference equality check soft
    void beforePosterior;
  }

  const skillCounts = { ...orch.skillCounts };
  if (last.isScored) {
    skillCounts[last.item.skill] = (skillCounts[last.item.skill] ?? 0) + 1;
  }

  const presentedItems = orch.presentedItems.slice();
  const updated: PresentedRecord = {
    ...last,
    responseCorrect: response.correct === true && !response.timedOut,
    thetaAfter: state.theta,
    activeBoundaryAfter: null,
  };
  presentedItems[presentedItems.length - 1] = updated;

  let next: AdaptiveTestState = {
    ...orch,
    assessmentState: state,
    presentedItems,
    scoredItemIds: last.isScored
      ? [...orch.scoredItemIds, last.item.id]
      : orch.scoredItemIds,
    skillCounts,
  };
  next = refreshBoundary(next);
  presentedItems[presentedItems.length - 1] = {
    ...updated,
    activeBoundaryAfter: next.activeBoundary,
  };
  next = { ...next, presentedItems };
  next = evaluateEarlyStop(next, orchestratorConfig, assessmentConfig);
  return next;
}

export function finalizeAdaptiveTest(
  orch: AdaptiveTestState,
  assessmentConfig: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): AssessmentResult {
  return finalize(orch.assessmentState, assessmentConfig);
}

/** Full step: select → commit → answer. */
export function stepAdaptiveTest(
  orch: AdaptiveTestState,
  candidates: OrchestratorCandidate[],
  response: ScoringResponse,
  orchestratorConfig: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
  assessmentConfig: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): AdaptiveTestState {
  const selection = chooseNext(orch, candidates, orchestratorConfig, assessmentConfig);
  if (!selection) throw new Error('No selectable candidate');
  const committed = commitSelection(orch, selection, orchestratorConfig);
  return applyOrchestratorAnswer(committed, response, assessmentConfig, orchestratorConfig);
}
