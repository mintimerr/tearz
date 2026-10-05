/**
 * Canonical presented-item snapshot + response history.
 *
 * Effective IRT parameters are frozen at answer time so historical sessions
 * replay identically even after bank recalibration.
 */

import type { AssessmentConfig } from '../config.js';
import { DEFAULT_ASSESSMENT_CONFIG, reliabilityForItem } from '../config.js';
import { applyAnswer, createAssessmentState, finalize } from '../engine.js';
import { resolveIrtParams } from '../irt.js';
import type {
  AssessmentResult,
  AssessmentSkill,
  CalibrationStatus,
  CefrLevel,
  ItemMeta,
  ItemType,
  ResponseFormat,
  ScoringResponse,
} from '../types.js';
import type { PlacementVersionMetadata } from './versions.js';
import { currentPlacementVersions } from './versions.js';

/** Immutable psychometric snapshot of an item as used when it was presented/scored. */
export type PresentedItemSnapshot = {
  itemId: string;
  itemVersion?: string;
  skill: AssessmentSkill;
  construct: string;
  itemType: ItemType;
  targetLevel: CefrLevel;
  difficultyWithinLevel: number;

  /** Effective 3PL params at answer time — never re-resolve from live bank. */
  effectiveDifficulty: number;
  effectiveDiscrimination: number;
  effectiveGuessingProbability: number;
  irtParamSource: 'empirical' | 'predicted' | 'frozen';

  calibrationStatus: CalibrationStatus;
  evidenceWeight: number;
  isScored: boolean;

  responseFormat: ResponseFormat;
  optionCount?: number;

  generationPromptVersion?: string;
  semanticReviewVersion?: string;
  adversarialReviewVersion?: string;
  itemQualityVersion?: string;
  qualityGate?: 'PASS' | 'REVISE' | 'REJECT';
};

/** One persisted response — the only input needed for deterministic assessment replay. */
export type CanonicalResponse = {
  presentedItemSnapshot: PresentedItemSnapshot;
  correct: boolean;
  timedOut: boolean;
  /** Effective weight applied to the posterior update (responseWeight × reliability). */
  responseWeight: number;
  responseTimeMs?: number;
  timestamp: number;
  questionNumber: number;
  selectedAnswer?: string;
};

export type CanonicalSessionHistory = {
  assessmentSessionId: string;
  language: string;
  versions: PlacementVersionMetadata;
  responses: CanonicalResponse[];
};

/**
 * Freeze ItemMeta → PresentedItemSnapshot using params resolved NOW.
 * Call at answer time (or present time) and persist; never recompute later.
 */
export function freezePresentedItemSnapshot(
  item: ItemMeta,
  opts?: {
    itemVersion?: string;
    evidenceWeight?: number;
    generationPromptVersion?: string;
    semanticReviewVersion?: string;
    adversarialReviewVersion?: string;
    itemQualityVersion?: string;
    qualityGate?: 'PASS' | 'REVISE' | 'REJECT';
    config?: AssessmentConfig;
  },
): PresentedItemSnapshot {
  const config = opts?.config ?? DEFAULT_ASSESSMENT_CONFIG;
  const params = resolveIrtParams(item, config);
  const evidenceWeight =
    typeof opts?.evidenceWeight === 'number'
      ? opts.evidenceWeight
      : item.isScored
        ? reliabilityForItem(item.calibrationStatus, config)
        : 0;

  return {
    itemId: item.id,
    itemVersion: opts?.itemVersion,
    skill: item.skill,
    construct: item.construct,
    itemType: item.itemType,
    targetLevel: item.targetLevel,
    difficultyWithinLevel: item.difficultyWithinLevel,
    effectiveDifficulty: params.b,
    effectiveDiscrimination: params.a,
    effectiveGuessingProbability: params.c,
    irtParamSource: 'frozen',
    calibrationStatus: item.calibrationStatus,
    evidenceWeight,
    isScored: item.isScored,
    responseFormat: item.responseFormat,
    optionCount: item.optionCount,
    generationPromptVersion: opts?.generationPromptVersion,
    semanticReviewVersion: opts?.semanticReviewVersion,
    adversarialReviewVersion: opts?.adversarialReviewVersion,
    itemQualityVersion: opts?.itemQualityVersion,
    qualityGate: opts?.qualityGate,
  };
}

/**
 * Rebuild an ItemMeta that forces resolveIrtParams to return the frozen a/b/c.
 * Does not change psychometric formulas — only feeds historical params.
 */
export function itemMetaFromPresentedSnapshot(
  snap: PresentedItemSnapshot,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): ItemMeta {
  return {
    id: snap.itemId,
    language: 'frozen',
    skill: snap.skill,
    construct: snap.construct,
    itemType: snap.itemType,
    responseFormat: snap.responseFormat,
    optionCount: snap.optionCount,
    targetLevel: snap.targetLevel,
    difficultyWithinLevel: snap.difficultyWithinLevel,
    predictedDifficulty: snap.effectiveDifficulty,
    predictedDiscrimination: snap.effectiveDiscrimination,
    guessingProbability: snap.effectiveGuessingProbability,
    // Force empirical path so later bank recalibration cannot change a/b/c
    empiricalDifficulty: snap.effectiveDifficulty,
    empiricalDiscrimination: snap.effectiveDiscrimination,
    empiricalGuessingProbability: snap.effectiveGuessingProbability,
    sampleSize: config.minCalibrationSampleSize,
    calibrationStatus: snap.calibrationStatus,
    isScored: snap.isScored,
    status: 'active',
    source: 'bank',
    createdAt: 0,
  };
}

export type CanonicalReplayResult = {
  result: AssessmentResult;
  state: ReturnType<typeof createAssessmentState>;
  assessmentSessionId: string;
};

/**
 * Deterministic assessment replay from canonical response history ONLY.
 * Does not consult live item bank or synthetic banks.
 */
export function replayFromCanonicalHistory(
  history: CanonicalSessionHistory | CanonicalResponse[],
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): CanonicalReplayResult {
  const responses = Array.isArray(history) ? history : history.responses;
  const assessmentSessionId = Array.isArray(history)
    ? 'anonymous'
    : history.assessmentSessionId;

  let state = createAssessmentState(config);
  for (const resp of responses) {
    const item = itemMetaFromPresentedSnapshot(resp.presentedItemSnapshot, config);
    // Guard: snapshot isScored drives scoring; never upgrade from live bank.
    const scoring: ScoringResponse = {
      correct: resp.correct,
      timedOut: resp.timedOut,
      responseTimeMs: resp.responseTimeMs,
      timestamp: resp.timestamp,
      selectedAnswer: resp.selectedAnswer,
    };
    state = applyAnswer(state, item, scoring, config).state;
  }

  return {
    result: finalize(state, config),
    state,
    assessmentSessionId,
  };
}

/** Compare two assessment results within float tolerance. */
export function assessmentResultsMatch(
  a: AssessmentResult,
  b: AssessmentResult,
  eps = 1e-9,
): { ok: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  if (a.verifiedPlacementLevel !== b.verifiedPlacementLevel) {
    mismatches.push(`verified ${a.verifiedPlacementLevel}≠${b.verifiedPlacementLevel}`);
  }
  if (a.statisticalEstimate !== b.statisticalEstimate) {
    mismatches.push(`statistical ${a.statisticalEstimate}≠${b.statisticalEstimate}`);
  }
  if (Math.abs(a.theta - b.theta) > eps) mismatches.push(`theta ${a.theta}≠${b.theta}`);
  if (Math.abs(a.confidence - b.confidence) > 1e-6) {
    mismatches.push(`confidence ${a.confidence}≠${b.confidence}`);
  }
  for (const L of Object.keys(a.levelProbabilities) as CefrLevel[]) {
    if (Math.abs(a.levelProbabilities[L] - b.levelProbabilities[L]) > 1e-9) {
      mismatches.push(`P(${L})`);
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

export function emptyCanonicalHistory(
  assessmentSessionId: string,
  language: string,
): CanonicalSessionHistory {
  return {
    assessmentSessionId,
    language,
    versions: currentPlacementVersions(),
    responses: [],
  };
}
