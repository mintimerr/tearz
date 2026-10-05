/**
 * Placement stack version stamps — persisted on every completed PlacementRecord.
 * Required for future calibration audits ("which algorithm gave this user B2?").
 */

import { DEFAULT_ASSESSMENT_CONFIG } from '../config.js';
import { DEFAULT_ORCHESTRATOR_CONFIG } from '../orchestrator/config.js';

export const PLACEMENT_STACK_VERSIONS = {
  placementVersion: 'tearz-placement-v1',
  assessmentEngineVersion: DEFAULT_ASSESSMENT_CONFIG.configVersion,
  orchestratorVersion: DEFAULT_ORCHESTRATOR_CONFIG.configId,
  cefrMapVersion: 'en-cefr-map-provisional-v1',
  itemQualityVersion: 'item-quality-gate-v1',
} as const;

export type PlacementVersionMetadata = {
  placementVersion: string;
  assessmentEngineVersion: string;
  orchestratorVersion: string;
  cefrMapVersion: string;
  itemQualityVersion: string;
};

export function currentPlacementVersions(): PlacementVersionMetadata {
  return { ...PLACEMENT_STACK_VERSIONS };
}
