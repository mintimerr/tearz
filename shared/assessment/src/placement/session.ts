/**
 * Placement session snapshot — enough for deterministic replay + restore.
 * Canonical response history is the assessment SoT (not theta alone, not synthetic bank).
 */

import type { AssessmentConfig } from '../config.js';
import { DEFAULT_ASSESSMENT_CONFIG } from '../config.js';
import type { OrchestratorConfig } from '../orchestrator/config.js';
import { DEFAULT_ORCHESTRATOR_CONFIG } from '../orchestrator/config.js';
import type { AdaptiveTestState, SelectionDecision } from '../orchestrator/types.js';
import type { ExternalBenchmark } from './benchmark.js';
import type { CanonicalResponse } from './canonical.js';
import type { PlacementVersionMetadata } from './versions.js';
import { currentPlacementVersions } from './versions.js';

export type PlacementSessionSnapshot = {
  /** Unique id for this placement attempt — alias assessmentSessionId. */
  sessionId: string;
  assessmentSessionId: string;
  language: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'completed' | 'abandoned' | 'failed';
  versions: PlacementVersionMetadata;
  assessmentConfigId: string;
  assessmentConfigVersion: string;
  orchestratorConfigId: string;
  /** Full adaptive state (includes posterior + answerHistory). */
  adaptiveState: AdaptiveTestState;
  /** Presented item IDs in order. */
  presentedItemIds: string[];
  /**
   * Canonical response history — THE source for deterministic assessment replay.
   * Each entry freezes effective psychometric params at answer time.
   */
  canonicalResponses: CanonicalResponse[];
  selectionHistory: SelectionDecision[];
  /** Current pending item id (presented, awaiting answer), if any. */
  pendingItemId: string | null;
  /** Frozen snapshot for the pending item (set at present time). */
  pendingItemSnapshot?: CanonicalResponse['presentedItemSnapshot'] | null;
  questionNumber: number;
  /** Optional post-test research field — never used during scoring. */
  externalBenchmark?: ExternalBenchmark;
  /** Optional shadow legacy comparison (dev only). */
  shadowLegacyLevel?: string | null;
};

export function createSessionId(seed?: string): string {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e9).toString(36);
  return seed ? `plc_${seed}_${t}` : `plc_${t}_${r}`;
}

export function emptySnapshot(input: {
  sessionId?: string;
  language: string;
  adaptiveState: AdaptiveTestState;
  assessmentConfig?: AssessmentConfig;
  orchestratorConfig?: OrchestratorConfig;
}): PlacementSessionSnapshot {
  const assessmentConfig = input.assessmentConfig ?? DEFAULT_ASSESSMENT_CONFIG;
  const orchestratorConfig = input.orchestratorConfig ?? DEFAULT_ORCHESTRATOR_CONFIG;
  const now = Date.now();
  const sessionId = input.sessionId ?? createSessionId();
  return {
    sessionId,
    assessmentSessionId: sessionId,
    language: input.language,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    versions: currentPlacementVersions(),
    assessmentConfigId: assessmentConfig.configId,
    assessmentConfigVersion: assessmentConfig.configVersion,
    orchestratorConfigId: orchestratorConfig.configId,
    adaptiveState: input.adaptiveState,
    presentedItemIds: [],
    canonicalResponses: [],
    selectionHistory: [],
    pendingItemId: null,
    pendingItemSnapshot: null,
    questionNumber: 1,
  };
}

export function serializeSnapshot(snap: PlacementSessionSnapshot): string {
  return JSON.stringify(snap);
}

export function deserializeSnapshot(raw: string): PlacementSessionSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as PlacementSessionSnapshot;
    if (!parsed?.sessionId || !parsed.adaptiveState || !parsed.versions) return null;
    // Migrate older snapshots
    if (!parsed.assessmentSessionId) parsed.assessmentSessionId = parsed.sessionId;
    if (!parsed.canonicalResponses) parsed.canonicalResponses = [];
    return parsed;
  } catch {
    return null;
  }
}
