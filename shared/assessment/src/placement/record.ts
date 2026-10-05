/**
 * Map AssessmentResult → PlacementRecord-compatible payload.
 * Consumers needing only { level, score } keep working.
 */

import type { AssessmentResult } from '../types.js';
import type { PlacementVersionMetadata } from './versions.js';
import { currentPlacementVersions } from './versions.js';

export type PlacementRecordV1 = {
  completedAt: number;
  language: string;
  /** === verifiedPlacementLevel */
  level: string;
  /** Legacy 0–100 compatibility score. */
  score: number;
  summary?: string;
  hskLevel?: string;

  // Extended assessment fields (optional for old consumers)
  statisticalEstimate?: string;
  theta?: number;
  thetaCredibleInterval?: { lower: number; upper: number };
  confidence?: number;
  confidenceLabel?: string;
  levelProbabilities?: Record<string, number>;
  skillProfile?: AssessmentResult['skillProfile'];
  verification?: AssessmentResult['verification'];
  assessmentEngineVersion?: string;
  orchestratorVersion?: string;
  cefrMapVersion?: string;
  itemQualityVersion?: string;
  placementVersion?: string;
  sessionId?: string;
  assessmentSessionId?: string;
};

export function summaryForVerifiedLevel(level: string): string {
  const map: Record<string, string> = {
    A1: 'You know basic words and simple phrases — a solid starting point.',
    A2: 'You handle everyday topics and simple sentences well.',
    B1: 'You can manage most travel and daily situations independently.',
    B2: 'You understand main ideas on familiar and abstract topics.',
    C1: 'You use the language flexibly for work and study.',
    C2: 'You understand virtually everything with near-native precision.',
  };
  return map[level] ?? 'Your level has been estimated from this short test.';
}

export function placementRecordFromAssessment(input: {
  result: AssessmentResult;
  language: string;
  completedAt?: number;
  sessionId?: string;
  summary?: string;
  hskLevel?: string;
  versions?: PlacementVersionMetadata;
  /** Dev-only shadow — never shown as user-facing dual result. */
  shadowLegacyLevel?: string | null;
}): PlacementRecordV1 {
  const versions = input.versions ?? currentPlacementVersions();
  const level = input.result.verifiedPlacementLevel;
  return {
    completedAt: input.completedAt ?? Date.now(),
    language: input.language,
    level,
    score: input.result.legacyAbility100,
    summary: input.summary ?? summaryForVerifiedLevel(level),
    hskLevel: input.hskLevel,
    statisticalEstimate: input.result.statisticalEstimate,
    theta: input.result.theta,
    thetaCredibleInterval: input.result.thetaCredibleInterval,
    confidence: input.result.confidence,
    confidenceLabel: input.result.confidenceLabel,
    levelProbabilities: input.result.levelProbabilities,
    skillProfile: input.result.skillProfile,
    verification: input.result.verification,
    assessmentEngineVersion: versions.assessmentEngineVersion,
    orchestratorVersion: versions.orchestratorVersion,
    cefrMapVersion: versions.cefrMapVersion,
    itemQualityVersion: versions.itemQualityVersion,
    placementVersion: versions.placementVersion,
    sessionId: input.sessionId,
    assessmentSessionId: input.sessionId,
  };
}

/** API step "done" body result shape. */
export function placementApiResultFromAssessment(input: {
  result: AssessmentResult;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  hskLevel?: string;
}): {
  level: string;
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  hskLevel?: string;
  statisticalEstimate: string;
  theta: number;
  thetaCredibleInterval: { lower: number; upper: number };
  confidence: number;
  confidenceLabel: string;
  levelProbabilities: Record<string, number>;
  skillProfile: AssessmentResult['skillProfile'];
  verification: AssessmentResult['verification'];
  versions: PlacementVersionMetadata;
} {
  const versions = currentPlacementVersions();
  const level = input.result.verifiedPlacementLevel;
  return {
    level,
    score: input.result.legacyAbility100,
    summary: input.summary ?? summaryForVerifiedLevel(level),
    strengths: input.strengths ?? [],
    gaps: input.gaps ?? [],
    hskLevel: input.hskLevel,
    statisticalEstimate: input.result.statisticalEstimate,
    theta: input.result.theta,
    thetaCredibleInterval: input.result.thetaCredibleInterval,
    confidence: input.result.confidence,
    confidenceLabel: input.result.confidenceLabel,
    levelProbabilities: input.result.levelProbabilities,
    skillProfile: input.result.skillProfile,
    verification: input.result.verification,
    versions,
  };
}
