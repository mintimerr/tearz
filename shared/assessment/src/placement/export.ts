/**
 * Anonymized assessment session export for beta calibration.
 * No name / email / phone / chat text / other PII.
 */

import type { AdaptiveTestState, SelectionDecision } from '../orchestrator/types.js';
import type { AssessmentResult } from '../types.js';
import type { ExternalBenchmark } from './benchmark.js';
import type { CanonicalResponse } from './canonical.js';
import type { PlacementVersionMetadata } from './versions.js';

export type AnonymizedAssessmentExport = {
  assessmentSessionId: string;
  language: string;
  exportedAt: number;
  versions: PlacementVersionMetadata;
  canonicalResponses: CanonicalResponse[];
  selectionDecisions: SelectionDecision[];
  /** Posterior EAP trajectory after each scored response. */
  posteriorTrajectory: Array<{
    questionNumber: number;
    theta: number;
    levelProbabilities: AssessmentResult['levelProbabilities'];
  }>;
  finalResult: {
    verifiedPlacementLevel: AssessmentResult['verifiedPlacementLevel'];
    statisticalEstimate: AssessmentResult['statisticalEstimate'];
    theta: number;
    thetaCredibleInterval: AssessmentResult['thetaCredibleInterval'];
    confidence: number;
    confidenceLabel: AssessmentResult['confidenceLabel'];
    levelProbabilities: AssessmentResult['levelProbabilities'];
    skillProfile: AssessmentResult['skillProfile'];
    verification: AssessmentResult['verification'];
    legacyAbility100: number;
  };
  externalBenchmark?: ExternalBenchmark;
};

const PII_KEYS = new Set([
  'email',
  'phone',
  'name',
  'fullName',
  'firstName',
  'lastName',
  'userId',
  'user_id',
  'chat',
  'chatText',
  'message',
  'messages',
  'prompt',
  'selectedAnswer',
  'correctChoice',
  'choices',
]);

export function buildAnonymizedExport(input: {
  assessmentSessionId: string;
  language: string;
  versions: PlacementVersionMetadata;
  canonicalResponses: CanonicalResponse[];
  selectionDecisions: SelectionDecision[];
  adaptiveState?: AdaptiveTestState;
  finalResult: AssessmentResult;
  externalBenchmark?: ExternalBenchmark;
}): AnonymizedAssessmentExport {
  // Strip selectedAnswer from responses for export safety
  const canonicalResponses = input.canonicalResponses.map((r) => {
    const { selectedAnswer: _omit, ...rest } = r;
    void _omit;
    return {
      ...rest,
      presentedItemSnapshot: { ...r.presentedItemSnapshot },
    };
  });

  const posteriorTrajectory = (input.adaptiveState?.assessmentState.answerHistory ?? []).map(
    (a, i) => ({
      questionNumber: i + 1,
      theta: a.thetaAfter,
      levelProbabilities: input.finalResult.levelProbabilities, // filled below if possible
    }),
  );

  // Prefer per-step from answer history when we only have final probs
  const trajectory = (input.adaptiveState?.assessmentState.answerHistory ?? []).map((a, i) => ({
    questionNumber: i + 1,
    theta: a.thetaAfter,
    levelProbabilities: input.finalResult.levelProbabilities,
  }));

  void posteriorTrajectory;

  return {
    assessmentSessionId: input.assessmentSessionId,
    language: input.language,
    exportedAt: Date.now(),
    versions: input.versions,
    canonicalResponses,
    selectionDecisions: input.selectionDecisions,
    posteriorTrajectory: trajectory,
    finalResult: {
      verifiedPlacementLevel: input.finalResult.verifiedPlacementLevel,
      statisticalEstimate: input.finalResult.statisticalEstimate,
      theta: input.finalResult.theta,
      thetaCredibleInterval: input.finalResult.thetaCredibleInterval,
      confidence: input.finalResult.confidence,
      confidenceLabel: input.finalResult.confidenceLabel,
      levelProbabilities: input.finalResult.levelProbabilities,
      skillProfile: input.finalResult.skillProfile,
      verification: input.finalResult.verification,
      legacyAbility100: input.finalResult.legacyAbility100,
    },
    externalBenchmark: input.externalBenchmark,
  };
}

/** Returns true if export JSON contains known PII field names at any depth. */
export function exportContainsPiiKeys(obj: unknown, depth = 0): string[] {
  if (depth > 12 || obj == null) return [];
  if (Array.isArray(obj)) {
    return obj.flatMap((x) => exportContainsPiiKeys(x, depth + 1));
  }
  if (typeof obj !== 'object') return [];
  const found: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (PII_KEYS.has(k)) found.push(k);
    found.push(...exportContainsPiiKeys(v, depth + 1));
  }
  return found;
}
