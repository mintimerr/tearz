/**
 * Server bridge to shared @tearz/assessment core.
 * Final CEFR always recomputed from canonical response history.
 */

import { finalizeAuthoritativeFromCanonical } from '../../shared/assessment/dist/placement/finalize-authoritative.js';
import { currentPlacementVersions } from '../../shared/assessment/dist/placement/versions.js';

export function finalizeFromCanonicalHistory({
  language,
  assessmentSessionId,
  canonicalResponses,
  clientResult,
  analyticsSink,
}) {
  const responses = Array.isArray(canonicalResponses) ? canonicalResponses : [];
  if (!responses.length) {
    return {
      ok: false,
      error: 'canonical_history_empty',
      source: 'assessment-engine-v1.1',
    };
  }

  const finalized = finalizeAuthoritativeFromCanonical({
    history: {
      assessmentSessionId: assessmentSessionId || 'server-unknown',
      language: language || 'english',
      versions: currentPlacementVersions(),
      responses,
    },
    clientResult,
  });

  if (finalized.mismatch) {
    analyticsSink?.({
      name: 'placement_client_server_mismatch',
      assessmentSessionId: assessmentSessionId || 'server-unknown',
      sessionId: assessmentSessionId || 'server-unknown',
      clientLevel: finalized.mismatch.clientLevel,
      serverLevel: finalized.mismatch.serverLevel,
      clientTheta: finalized.mismatch.clientTheta,
      serverTheta: finalized.mismatch.serverTheta,
      mismatches: finalized.mismatch.mismatches,
      timestamp: Date.now(),
    });
  }

  return {
    ok: true,
    ability: finalized.ability,
    result: finalized.result,
    record: finalized.record,
    versions: currentPlacementVersions(),
    source: 'assessment-engine-v1.1',
    mismatch: finalized.mismatch,
    authoritative: true,
  };
}

/** @deprecated */
export function finalizePlacementWithAssessment() {
  return {
    ok: false,
    error: 'legacy_history_not_supported_use_canonical',
    source: 'assessment-engine-v1.1',
  };
}

export function shadowLegacyLevel(ability, history, conservativePlacementLevel) {
  try {
    return conservativePlacementLevel(ability, history);
  } catch {
    return null;
  }
}
