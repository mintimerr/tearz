/**
 * Build ItemSpecification slots from language construct catalogs.
 * Pilot: 2 items × 6 CEFR × 4 skills × 5 langs = 240 target slots.
 */

import type { ItemSpecification } from '../../items/types.js';
import type { AssessmentSkill, CefrLevel, ItemType } from '../../types.js';
import { cefrRank } from '../../scale.js';
import type { ConstructEntry } from '../../languages/types.js';
import type { BankLanguage } from '../types.js';
import { BANK_LANGUAGES } from '../types.js';
import { factoryConstructsFor } from './constructs.js';

export const PILOT_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const PILOT_SKILLS: AssessmentSkill[] = ['grammar', 'vocabulary', 'reading', 'functional'];
export const PILOT_ITEMS_PER_CELL = 2;

/** UI-compatible MCQ item types only. */
export const UI_ITEM_TYPES: ItemType[] = [
  'fillBlank',
  'sentenceCompletion',
  'vocabularyChoice',
  'grammarForm',
  'readingComprehension',
  'functionalPhrase',
  'errorCorrection',
];

const DIFFICULTY_WITHIN: number[] = [0.25, 0.55, 0.8]; // low / mid / high rotation

export type BlueprintSlot = {
  slotKey: string;
  language: BankLanguage;
  skill: AssessmentSkill;
  level: CefrLevel;
  slotIndex: number;
  specification: ItemSpecification;
  construct: ConstructEntry;
};

function pickConstruct(
  constructs: ConstructEntry[],
  skill: AssessmentSkill,
  level: CefrLevel,
  slotIndex: number,
): ConstructEntry {
  const rank = cefrRank(level);
  const matching = constructs.filter(
    (c) =>
      c.skill === skill &&
      cefrRank(c.minLevel) <= rank &&
      cefrRank(c.maxLevel) >= rank,
  );
  if (matching.length === 0) {
    throw new Error(`No construct for ${skill}@${level}`);
  }
  // Prefer typicalLevel closest to target
  matching.sort((a, b) => {
    const da = Math.abs(cefrRank(a.typicalLevel) - rank);
    const db = Math.abs(cefrRank(b.typicalLevel) - rank);
    return da - db;
  });
  return matching[slotIndex % matching.length]!;
}

function pickItemType(construct: ConstructEntry, skill: AssessmentSkill): ItemType {
  const allowed = construct.allowedItemTypes.filter((t) => UI_ITEM_TYPES.includes(t));
  if (allowed.length === 0) {
    // Fallback by skill
    if (skill === 'reading') return 'readingComprehension';
    if (skill === 'vocabulary') return 'vocabularyChoice';
    if (skill === 'functional') return 'functionalPhrase';
    return 'grammarForm';
  }
  // Prefer skill-natural types
  const preferred: ItemType[] =
    skill === 'reading'
      ? ['readingComprehension']
      : skill === 'vocabulary'
        ? ['vocabularyChoice', 'fillBlank', 'sentenceCompletion']
        : skill === 'functional'
          ? ['functionalPhrase', 'sentenceCompletion']
          : ['grammarForm', 'fillBlank', 'sentenceCompletion', 'errorCorrection'];
  for (const p of preferred) {
    if (allowed.includes(p)) return p;
  }
  return allowed[0]!;
}

function withinForSlot(slotIndex: number, levelIndex: number): number {
  return DIFFICULTY_WITHIN[(slotIndex + levelIndex) % DIFFICULTY_WITHIN.length]!;
}

export function buildSlotSpecifications(
  language: BankLanguage,
  opts?: { itemsPerCell?: number },
): BlueprintSlot[] {
  const itemsPerCell = opts?.itemsPerCell ?? PILOT_ITEMS_PER_CELL;
  const constructs = factoryConstructsFor(language);
  const slots: BlueprintSlot[] = [];

  for (let li = 0; li < PILOT_LEVELS.length; li += 1) {
    const level = PILOT_LEVELS[li]!;
    for (const skill of PILOT_SKILLS) {
      for (let slotIndex = 0; slotIndex < itemsPerCell; slotIndex += 1) {
        const construct = pickConstruct(constructs, skill, level, slotIndex);
        const itemType = pickItemType(construct, skill);
        const difficultyWithinLevel = withinForSlot(slotIndex, li);
        const slotKey = `${language}|${skill}|${level}|${slotIndex}`;
        const specId = `spec.${slotKey.replace(/\|/g, '.')}`;
        const specification: ItemSpecification = {
          id: specId,
          language,
          targetLevel: level,
          difficultyWithinLevel,
          skill,
          construct: construct.id,
          itemType,
          responseFormat: 'singleChoice',
          optionCount: 4,
          contextDomain: 'daily_life',
          register: 'neutral',
          generationConstraints: {
            avoidWorldKnowledge: true,
            avoidDialectOnlyKey: true,
            requireSingleUnequivocalKey: true,
            maxOptionChars: level === 'A1' || level === 'A2' ? 40 : 80,
          },
        };
        slots.push({ slotKey, language, skill, level, slotIndex, specification, construct });
      }
    }
  }
  return slots;
}

export function buildPilotBlueprints(
  languages: BankLanguage[] = [...BANK_LANGUAGES],
  opts?: { itemsPerCell?: number },
): BlueprintSlot[] {
  return languages.flatMap((lang) => buildSlotSpecifications(lang, opts));
}
