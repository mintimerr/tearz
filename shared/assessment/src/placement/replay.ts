/**
 * Deterministic replay — prefers canonical frozen history.
 * Bank re-selection replay remains only for selection-path tests (not assessment SoT).
 */

import type { AssessmentConfig } from '../config.js';
import { DEFAULT_ASSESSMENT_CONFIG } from '../config.js';
import type { OrchestratorConfig } from '../orchestrator/config.js';
import { finalizeAdaptiveTest } from '../orchestrator/state.js';
import type { AssessmentResult } from '../types.js';
import {
  replayFromCanonicalHistory,
  type CanonicalResponse,
  type CanonicalSessionHistory,
} from './canonical.js';
import type { PlacementContentItem } from './content-bank.js';
import { placementRecordFromAssessment, type PlacementRecordV1 } from './record.js';
import type { PlacementSessionSnapshot } from './session.js';
import { PlacementOrchestrationService } from './service.js';

/** Assessment SoT replay from frozen item params + responses. */
export function replayCanonicalAssessment(
  history: CanonicalSessionHistory | CanonicalResponse[],
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): { result: AssessmentResult; record: PlacementRecordV1; assessmentSessionId: string } {
  const replayed = replayFromCanonicalHistory(history, config);
  const language = Array.isArray(history) ? 'english' : history.language;
  const sessionId = replayed.assessmentSessionId;
  return {
    result: replayed.result,
    record: placementRecordFromAssessment({
      result: replayed.result,
      language,
      sessionId,
      versions: Array.isArray(history) ? undefined : history.versions,
    }),
    assessmentSessionId: sessionId,
  };
}

/**
 * @deprecated Prefer replayCanonicalAssessment for scoring SoT.
 * Re-runs orchestrator selection from a content bank (selection tests only).
 */
export function replayPlacementSession(input: {
  language: string;
  contentBank: PlacementContentItem[];
  answers: Array<{ correct: boolean; timedOut?: boolean }>;
  assessmentConfig?: AssessmentConfig;
  orchestratorConfig?: OrchestratorConfig;
}): { result: AssessmentResult; record: PlacementRecordV1; presentedIds: string[] } {
  const svc = new PlacementOrchestrationService({
    language: input.language,
    contentBank: input.contentBank,
    assessmentConfig: input.assessmentConfig,
    orchestratorConfig: input.orchestratorConfig,
  });
  let step = svc.start();
  for (const ans of input.answers) {
    if (step.done) break;
    step = svc.answer({ correct: ans.correct, timedOut: ans.timedOut });
  }
  if (!step.done) {
    const result = finalizeAdaptiveTest(
      svc.getSnapshot().adaptiveState,
      input.assessmentConfig,
    );
    return {
      result,
      record: placementRecordFromAssessment({
        result,
        language: input.language,
        sessionId: svc.getSessionId(),
      }),
      presentedIds: svc.getSnapshot().presentedItemIds,
    };
  }
  return {
    result: finalizeAdaptiveTest(step.snapshot.adaptiveState, input.assessmentConfig),
    record: step.record,
    presentedIds: step.snapshot.presentedItemIds,
  };
}

/** Replay assessment from a persisted session snapshot via canonical history. */
export function replayFromSnapshot(
  snap: PlacementSessionSnapshot,
  _contentBank?: PlacementContentItem[],
): { result: AssessmentResult; record: PlacementRecordV1; presentedIds: string[] } {
  if (snap.canonicalResponses?.length) {
    const { result, record } = replayCanonicalAssessment(
      {
        assessmentSessionId: snap.assessmentSessionId ?? snap.sessionId,
        language: snap.language,
        versions: snap.versions,
        responses: snap.canonicalResponses,
      },
      DEFAULT_ASSESSMENT_CONFIG,
    );
    return {
      result,
      record,
      presentedIds: snap.presentedItemIds,
    };
  }
  // Legacy fallback: no canonical history
  void _contentBank;
  const result = finalizeAdaptiveTest(snap.adaptiveState);
  return {
    result,
    record: placementRecordFromAssessment({
      result,
      language: snap.language,
      sessionId: snap.assessmentSessionId ?? snap.sessionId,
      versions: snap.versions,
    }),
    presentedIds: snap.presentedItemIds,
  };
}
