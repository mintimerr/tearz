/**
 * Authoritative finalize from canonical history (shared by client + server).
 * Client-sent level/theta are never authoritative.
 */

import type { AssessmentResult } from '../types.js';
import {
  assessmentResultsMatch,
  replayFromCanonicalHistory,
  type CanonicalSessionHistory,
} from './canonical.js';
import {
  placementApiResultFromAssessment,
  placementRecordFromAssessment,
} from './record.js';
import { currentPlacementVersions } from './versions.js';
import { thetaToLegacyAbility100 } from '../scale.js';

export type ClientResultHint = {
  level?: string;
  verifiedPlacementLevel?: string;
  theta?: number;
  confidence?: number;
  statisticalEstimate?: string;
  levelProbabilities?: AssessmentResult['levelProbabilities'];
};

export function finalizeAuthoritativeFromCanonical(input: {
  history: CanonicalSessionHistory;
  clientResult?: ClientResultHint | null;
}): {
  ok: true;
  ability: number;
  result: ReturnType<typeof placementApiResultFromAssessment>;
  record: ReturnType<typeof placementRecordFromAssessment>;
  assessmentResult: AssessmentResult;
  mismatch: null | {
    clientLevel?: string;
    serverLevel: string;
    clientTheta?: number;
    serverTheta: number;
    mismatches: string[];
  };
} {
  const { result } = replayFromCanonicalHistory(input.history);
  const apiResult = placementApiResultFromAssessment({ result });
  const record = placementRecordFromAssessment({
    result,
    language: input.history.language,
    sessionId: input.history.assessmentSessionId,
    versions: input.history.versions ?? currentPlacementVersions(),
  });

  let mismatch: null | {
    clientLevel?: string;
    serverLevel: string;
    clientTheta?: number;
    serverTheta: number;
    mismatches: string[];
  } = null;

  const client = input.clientResult;
  if (client && (client.level || client.verifiedPlacementLevel) && Number.isFinite(Number(client.theta))) {
    const clientLevel = (client.verifiedPlacementLevel || client.level) as AssessmentResult['verifiedPlacementLevel'];
    const synthetic: AssessmentResult = {
      ...result,
      verifiedPlacementLevel: clientLevel,
      cefrLevel: clientLevel,
      statisticalEstimate: (client.statisticalEstimate as AssessmentResult['statisticalEstimate']) || clientLevel,
      theta: Number(client.theta),
      confidence: Number.isFinite(Number(client.confidence)) ? Number(client.confidence) : result.confidence,
      levelProbabilities: client.levelProbabilities ?? result.levelProbabilities,
    };
    const cmp = assessmentResultsMatch(synthetic, result, 1e-4);
    if (!cmp.ok) {
      mismatch = {
        clientLevel,
        serverLevel: result.verifiedPlacementLevel,
        clientTheta: Number(client.theta),
        serverTheta: result.theta,
        mismatches: cmp.mismatches,
      };
    }
  }

  return {
    ok: true,
    ability: thetaToLegacyAbility100(result.theta),
    result: apiResult,
    record,
    assessmentResult: result,
    mismatch,
  };
}
