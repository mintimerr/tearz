/**
 * Deterministic offline template generator v2 — language-independent pools.
 * predictedDifficulty / predictedDiscrimination are engineering priors only
 * until empirical calibration (never mark calibrated/anchor here).
 */

import { createHash } from 'node:crypto';

import type { GeneratedItem, ItemSpecification } from '../../items/types.js';
import { generationPromptVersionForLanguage } from '../../items/prompt-versions.js';
import type { AssessmentSkill, CefrLevel } from '../../types.js';
import type { BankLanguage } from '../types.js';
import type { BlueprintSlot } from './blueprint.js';
import { EN_POOLS, type PoolItem } from './pools-en.js';
import { FR_POOLS } from './pools-fr.js';
import { ZH_POOLS } from './pools-zh.js';
import { DE_POOLS } from './pools-de.js';
import { RU_POOLS } from './pools-ru.js';

export const TEMPLATE_MODEL_ID = 'tearz-offline-template-v3';
/** @deprecated use generationPromptVersionForLanguage */
export const TEMPLATE_PROMPT_VERSION = 'en_item_generation_v2';

const POOLS: Record<BankLanguage, Record<AssessmentSkill, Partial<Record<CefrLevel, PoolItem[]>>>> = {
  en: EN_POOLS,
  fr: FR_POOLS,
  zh: ZH_POOLS,
  de: DE_POOLS,
  ru: RU_POOLS,
};

function stableId(slot: BlueprintSlot, attempt: number, conceptKey: string): string {
  const raw = `${slot.slotKey}|${attempt}|${conceptKey}|v3`;
  const h = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return `bank.${slot.language}.${slot.skill}.${slot.level}.${slot.slotIndex}.a${attempt}.${h}`;
}

function pickTemplate(slot: BlueprintSlot, attempt: number): PoolItem {
  const pool = POOLS[slot.language]?.[slot.skill]?.[slot.level] ?? [];
  if (pool.length === 0) {
    throw new Error(`No v2 template pool for ${slot.slotKey}`);
  }
  return pool[Math.min(attempt, pool.length - 1)]!;
}

export function generateTemplateCandidate(slot: BlueprintSlot, attempt = 0): GeneratedItem {
  const tpl = pickTemplate(slot, attempt);
  const spec: ItemSpecification = { ...slot.specification };
  const options = tpl.options.map((text, i) => ({
    id: String.fromCharCode(65 + i),
    text,
    isCorrect: i === tpl.correctIndex,
  }));
  const promptVersion = generationPromptVersionForLanguage(slot.language);
  return {
    id: stableId(slot, attempt, tpl.conceptKey),
    specificationId: spec.id ?? slot.slotKey,
    language: slot.language,
    stem: tpl.stem,
    prompt: tpl.prompt,
    options,
    correctAnswer: options[tpl.correctIndex]!.text,
    explanation: tpl.explanation,
    generationModel: TEMPLATE_MODEL_ID,
    generationPromptVersion: promptVersion,
    generatedAt: Date.now(),
    calibrationStatus: 'provisional',
    specification: spec,
  };
}

export function templateConceptKey(slot: BlueprintSlot, attempt = 0): string {
  return pickTemplate(slot, attempt).conceptKey;
}
