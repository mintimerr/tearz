/**
 * Typed placement analytics events.
 * Provider-agnostic: emit to a sink when wired; never include raw user PII/text.
 */

import type { AssessmentSkill, CalibrationStatus, CefrLevel, LevelProbabilities } from '../types.js';
import type { PlacementVersionMetadata } from './versions.js';

export type PlacementAnalyticsEventName =
  | 'placement_started'
  | 'placement_item_presented'
  | 'placement_item_answered'
  | 'placement_item_timed_out'
  | 'placement_generation_requested'
  | 'placement_generation_failed'
  | 'placement_quality_rejected'
  | 'placement_fallback_used'
  | 'placement_client_server_mismatch'
  | 'placement_item_quality_failed'
  | 'placement_item_regenerated'
  | 'placement_completed'
  | 'placement_abandoned';

export type PlacementStartedEvent = {
  name: 'placement_started';
  assessmentSessionId: string;
  /** @deprecated alias of assessmentSessionId */
  sessionId: string;
  language: string;
  assessmentEngineVersion: string;
  orchestratorVersion: string;
  placementVersion: string;
  timestamp: number;
};

export type PlacementItemPresentedEvent = {
  name: 'placement_item_presented';
  assessmentSessionId: string;
  sessionId: string;
  questionNumber: number;
  itemId: string;
  skill: AssessmentSkill;
  construct: string;
  targetLevel: CefrLevel;
  predictedDifficulty: number;
  calibrationStatus: CalibrationStatus;
  timestamp: number;
};

export type PlacementItemAnsweredEvent = {
  name: 'placement_item_answered';
  assessmentSessionId: string;
  sessionId: string;
  questionNumber: number;
  itemId: string;
  skill: AssessmentSkill;
  construct: string;
  targetLevel: CefrLevel;
  predictedDifficulty: number;
  calibrationStatus: CalibrationStatus;
  correct: boolean;
  timedOut: boolean;
  responseTimeMs?: number;
  thetaBefore: number;
  thetaAfter: number;
  activeBoundary: string | null;
  timestamp: number;
};

export type PlacementItemTimedOutEvent = {
  name: 'placement_item_timed_out';
  assessmentSessionId: string;
  sessionId: string;
  questionNumber: number;
  itemId: string;
  timestamp: number;
};

export type PlacementGenerationRequestedEvent = {
  name: 'placement_generation_requested';
  assessmentSessionId: string;
  sessionId: string;
  questionNumber: number;
  targetLevel: CefrLevel;
  skill?: AssessmentSkill;
  timestamp: number;
};

export type PlacementGenerationFailedEvent = {
  name: 'placement_generation_failed';
  assessmentSessionId: string;
  sessionId: string;
  questionNumber?: number;
  reason: string;
  timestamp: number;
};

export type PlacementQualityRejectedEvent = {
  name: 'placement_quality_rejected';
  assessmentSessionId: string;
  sessionId: string;
  itemId?: string;
  reasonCodes: string[];
  timestamp: number;
};

export type PlacementFallbackUsedEvent = {
  name: 'placement_fallback_used';
  assessmentSessionId: string;
  sessionId: string;
  questionNumber: number;
  reason: string;
  fallbackItemId?: string;
  timestamp: number;
};

export type PlacementClientServerMismatchEvent = {
  name: 'placement_client_server_mismatch';
  assessmentSessionId: string;
  sessionId: string;
  clientLevel?: string;
  serverLevel: string;
  clientTheta?: number;
  serverTheta: number;
  mismatches: string[];
  timestamp: number;
};

export type PlacementItemQualityFailedEvent = {
  name: 'placement_item_quality_failed';
  assessmentSessionId: string;
  sessionId: string;
  itemId?: string;
  reasonCodes: string[];
  timestamp: number;
};

export type PlacementItemRegeneratedEvent = {
  name: 'placement_item_regenerated';
  assessmentSessionId: string;
  sessionId: string;
  questionNumber: number;
  previousItemId?: string;
  newItemId: string;
  reason: string;
  timestamp: number;
};

export type PlacementCompletedEvent = {
  name: 'placement_completed';
  assessmentSessionId: string;
  sessionId: string;
  verifiedPlacementLevel: CefrLevel;
  statisticalEstimate: CefrLevel;
  theta: number;
  thetaCredibleInterval: { lower: number; upper: number };
  confidence: number;
  levelProbabilities: LevelProbabilities;
  skillProfile: AssessmentResultSkillProfile;
  versions: PlacementVersionMetadata;
  questionCount: number;
  timestamp: number;
};

type AssessmentResultSkillProfile = Record<string, unknown>;

export type PlacementAbandonedEvent = {
  name: 'placement_abandoned';
  assessmentSessionId: string;
  sessionId: string;
  questionNumber: number;
  reason?: string;
  timestamp: number;
};

export type PlacementAnalyticsEvent =
  | PlacementStartedEvent
  | PlacementItemPresentedEvent
  | PlacementItemAnsweredEvent
  | PlacementItemTimedOutEvent
  | PlacementGenerationRequestedEvent
  | PlacementGenerationFailedEvent
  | PlacementQualityRejectedEvent
  | PlacementFallbackUsedEvent
  | PlacementClientServerMismatchEvent
  | PlacementItemQualityFailedEvent
  | PlacementItemRegeneratedEvent
  | PlacementCompletedEvent
  | PlacementAbandonedEvent;

export type PlacementAnalyticsSink = (event: PlacementAnalyticsEvent) => void;

/** Dev/test sink that collects events in memory. */
export function createMemoryAnalyticsSink(): {
  sink: PlacementAnalyticsSink;
  events: PlacementAnalyticsEvent[];
} {
  const events: PlacementAnalyticsEvent[] = [];
  return {
    events,
    sink: (e) => {
      events.push(e);
    },
  };
}
