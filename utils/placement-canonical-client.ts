/**
 * Accumulate canonical responses for remote placement steps.
 * Builds frozen psychometric snapshots from presented PlacementQuestions
 * so server finalize never needs synthetic bank replay.
 */

import type { PlacementQuestion } from '@/types/placement-api';
import { itemMetaFromLegacyQuestion } from '../shared/assessment/src/legacy-bridge.js';
import {
  freezePresentedItemSnapshot,
  type CanonicalResponse,
} from '../shared/assessment/src/placement/index.js';
import { createSessionId } from '../shared/assessment/src/placement/session.js';

let assessmentSessionId = createSessionId();
let canonicalResponses: CanonicalResponse[] = [];
let pending: { question: PlacementQuestion; snapshot: CanonicalResponse['presentedItemSnapshot'] } | null =
  null;

export function getAssessmentSessionId(): string {
  return assessmentSessionId;
}

export function getCanonicalResponses(): CanonicalResponse[] {
  return [...canonicalResponses];
}

export function resetCanonicalPlacementSession(seed?: string) {
  assessmentSessionId = createSessionId(seed);
  canonicalResponses = [];
  pending = null;
  return assessmentSessionId;
}

export function notePlacementItemPresented(question: PlacementQuestion, language = 'english') {
  const item = itemMetaFromLegacyQuestion({
    id: question.id,
    kind: question.kind,
    section: question.section,
    difficulty: question.difficulty,
    choices: question.choices,
    language,
  });
  const snapshot = freezePresentedItemSnapshot(item, {
    qualityGate: 'PASS',
  });
  pending = { question, snapshot };
}

export function notePlacementItemAnswered(input: {
  correct: boolean;
  timedOut?: boolean;
  responseTimeMs?: number;
  selectedAnswer?: string;
}) {
  if (!pending) return;
  const lastAnswerWeight = pending.snapshot.evidenceWeight;
  canonicalResponses.push({
    presentedItemSnapshot: pending.snapshot,
    correct: input.timedOut ? false : input.correct,
    timedOut: input.timedOut === true,
    responseWeight: lastAnswerWeight,
    responseTimeMs: input.responseTimeMs,
    timestamp: Date.now(),
    questionNumber: canonicalResponses.length + 1,
    selectedAnswer: input.selectedAnswer,
  });
  pending = null;
}

export function canonicalPlacementFields() {
  return {
    assessmentSessionId,
    canonicalResponses: getCanonicalResponses(),
  };
}
