/**
 * Versioned offline placement content bank types.
 * Separate from IRT engine / LearnerModel.
 */

import type {
  AssessmentSkill,
  CalibrationStatus,
  CefrLevel,
  ItemType,
  ResponseFormat,
} from '../types.js';
import type { ItemLifecycleState } from '../items/types.js';

export const BANK_VERSIONS = ['v1'] as const;
export type BankVersion = (typeof BANK_VERSIONS)[number];

export const BANK_LANGUAGES = ['en', 'fr', 'zh', 'de', 'ru'] as const;
export type BankLanguage = (typeof BANK_LANGUAGES)[number];

export const ITEM_QUALITY_VERSION = 'item-quality-gate-v1';

export type BankManifest = {
  bankVersion: BankVersion;
  language: BankLanguage;
  itemQualityVersion: string;
  itemCount: number;
  countsByLevel: Partial<Record<CefrLevel, number>>;
  countsBySkill: Partial<Record<AssessmentSkill, number>>;
  /** sha256 hex of canonical items.json bytes, prefixed with "sha256:" */
  checksum: string;
};

/**
 * Serialized bank item — maps to PlacementContentItem via bankItemsToContentBank.
 * Factory may only emit approved_provisional + provisional calibration.
 */
export type BankItemRecord = {
  id: string;
  language: BankLanguage;
  skill: AssessmentSkill;
  construct: string;
  itemType: ItemType;
  responseFormat: ResponseFormat;
  optionCount: number;
  targetLevel: CefrLevel;
  difficultyWithinLevel: number;
  predictedDifficulty: number;
  predictedDiscrimination: number;
  /** Offline bank items are always provisional — never calibrated/anchor from factory. */
  calibrationStatus: Extract<CalibrationStatus, 'provisional'>;
  lifecycleState: Extract<ItemLifecycleState, 'approved_provisional'>;
  qualityGate: 'PASS';
  stem: string;
  prompt: string;
  instruction: string;
  choices: string[];
  correctChoice: string;
  explanation: string;
  generationModel: string;
  generationPromptVersion: string;
  itemQualityVersion: string;
  createdAt: number;
  /** Slot key used by the factory (language|skill|level|slotIndex). */
  slotKey?: string;
};

/** Stub interface for a future CDN / remote bank refresh. Not implemented. */
export type RemoteBankRefresh = {
  fetchManifest(language: BankLanguage, version: BankVersion): Promise<BankManifest>;
  fetchItems(language: BankLanguage, version: BankVersion): Promise<BankItemRecord[]>;
};

export class StubRemoteBankRefresh implements RemoteBankRefresh {
  async fetchManifest(_language: BankLanguage, _version: BankVersion): Promise<BankManifest> {
    throw new Error('Remote bank refresh is not implemented (stub only — no CDN).');
  }

  async fetchItems(_language: BankLanguage, _version: BankVersion): Promise<BankItemRecord[]> {
    throw new Error('Remote bank refresh is not implemented (stub only — no CDN).');
  }
}
