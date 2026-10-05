/**
 * Answer transition telemetry — separates evaluation from next-item prep.
 *
 * Flow timestamps:
 *   answerTap → answerEvaluated → posteriorUpdated → nextItemSelected → nextItemRendered
 */

export type PlacementTransitionMarks = {
  answerTapAt: number;
  answerEvaluatedAt?: number;
  posteriorUpdatedAt?: number;
  nextItemSelectedAt?: number;
  nextItemRenderedAt?: number;
};

export type PlacementTransitionMetrics = {
  answerEvaluationMs: number | null;
  assessmentUpdateMs: number | null;
  selectionMs: number | null;
  transitionTotalMs: number | null;
};

export type PlacementTransitionTelemetry = PlacementTransitionMarks & PlacementTransitionMetrics;

export function createTransitionMarks(answerTapAt = Date.now()): PlacementTransitionMarks {
  return { answerTapAt };
}

export function computeTransitionMetrics(m: PlacementTransitionMarks): PlacementTransitionMetrics {
  const { answerTapAt, answerEvaluatedAt, posteriorUpdatedAt, nextItemSelectedAt, nextItemRenderedAt } =
    m;
  return {
    answerEvaluationMs:
      answerEvaluatedAt != null ? Math.max(0, answerEvaluatedAt - answerTapAt) : null,
    assessmentUpdateMs:
      answerEvaluatedAt != null && posteriorUpdatedAt != null
        ? Math.max(0, posteriorUpdatedAt - answerEvaluatedAt)
        : null,
    selectionMs:
      posteriorUpdatedAt != null && nextItemSelectedAt != null
        ? Math.max(0, nextItemSelectedAt - posteriorUpdatedAt)
        : null,
    transitionTotalMs:
      nextItemRenderedAt != null ? Math.max(0, nextItemRenderedAt - answerTapAt) : null,
  };
}

export function finalizeTransitionTelemetry(
  m: PlacementTransitionMarks,
): PlacementTransitionTelemetry {
  return { ...m, ...computeTransitionMetrics(m) };
}

/** Dev/test sink — last completed transitions (ring buffer). */
const recent: PlacementTransitionTelemetry[] = [];
const MAX_RECENT = 32;

export function recordPlacementTransition(t: PlacementTransitionTelemetry): void {
  recent.push(t);
  if (recent.length > MAX_RECENT) recent.shift();
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[placement transition]', {
      answerEvaluationMs: t.answerEvaluationMs,
      assessmentUpdateMs: t.assessmentUpdateMs,
      selectionMs: t.selectionMs,
      transitionTotalMs: t.transitionTotalMs,
    });
  }
}

export function getRecentPlacementTransitions(): readonly PlacementTransitionTelemetry[] {
  return recent;
}

export function clearPlacementTransitionTelemetry(): void {
  recent.length = 0;
}
