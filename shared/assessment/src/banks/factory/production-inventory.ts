/**
 * Slot-aware production inventory: required vs approved remaining gaps.
 */

import type { AssessmentSkill, CefrLevel } from '../../types.js';
import type { BankItemRecord, BankLanguage } from '../types.js';
import {
  PRODUCTION_SKILL_CEFR_TARGETS,
  PRODUCTION_CEFR_TARGETS,
  cellKey,
  difficultyBand,
} from './production-targets.js';
import { buildSlotSpecifications, type BlueprintSlot } from './blueprint.js';
import { PILOT_LEVELS, PILOT_SKILLS } from './blueprint.js';

export type CellInventory = {
  level: CefrLevel;
  skill: AssessmentSkill;
  required: number;
  approved: number;
  remaining: number;
};

export type LanguageInventory = {
  language: BankLanguage;
  totalApproved: number;
  totalRequired: number;
  totalRemaining: number;
  byCefr: Record<CefrLevel, { required: number; approved: number; remaining: number }>;
  bySkill: Record<AssessmentSkill, { required: number; approved: number; remaining: number }>;
  cells: CellInventory[];
  difficulty: { low: number; mid: number; high: number };
};

export function buildLanguageInventory(
  language: BankLanguage,
  items: BankItemRecord[],
): LanguageInventory {
  const cells: CellInventory[] = [];
  const byCefr = {} as LanguageInventory['byCefr'];
  const bySkill = {} as LanguageInventory['bySkill'];
  const difficulty = { low: 0, mid: 0, high: 0 };

  for (const level of PILOT_LEVELS) {
    byCefr[level] = {
      required: PRODUCTION_CEFR_TARGETS[level],
      approved: 0,
      remaining: PRODUCTION_CEFR_TARGETS[level],
    };
  }
  for (const skill of PILOT_SKILLS) {
    bySkill[skill] = { required: 0, approved: 0, remaining: 0 };
  }

  for (const level of PILOT_LEVELS) {
    for (const skill of PILOT_SKILLS) {
      const required = PRODUCTION_SKILL_CEFR_TARGETS[level][skill];
      bySkill[skill]!.required += required;
      cells.push({ level, skill, required, approved: 0, remaining: required });
    }
  }

  for (const it of items) {
    if (it.language !== language) continue;
    if (it.qualityGate !== 'PASS') continue;
    byCefr[it.targetLevel]!.approved += 1;
    bySkill[it.skill]!.approved += 1;
    const cell = cells.find((c) => c.level === it.targetLevel && c.skill === it.skill);
    if (cell) cell.approved += 1;
    difficulty[difficultyBand(it.difficultyWithinLevel)] += 1;
  }

  for (const level of PILOT_LEVELS) {
    byCefr[level]!.remaining = Math.max(0, byCefr[level]!.required - byCefr[level]!.approved);
  }
  for (const skill of PILOT_SKILLS) {
    bySkill[skill]!.remaining = Math.max(0, bySkill[skill]!.required - bySkill[skill]!.approved);
  }
  for (const cell of cells) {
    cell.remaining = Math.max(0, cell.required - cell.approved);
  }

  const totalApproved = items.filter((i) => i.language === language && i.qualityGate === 'PASS').length;
  const totalRequired = 400;
  return {
    language,
    totalApproved,
    totalRequired,
    totalRemaining: Math.max(0, totalRequired - totalApproved),
    byCefr,
    bySkill,
    cells,
    difficulty,
  };
}

/**
 * Build production slots only for remaining gaps, prioritized by remaining count.
 * Caps to maxSlots (e.g. batch size).
 */
export function buildGapSlots(
  language: BankLanguage,
  items: BankItemRecord[],
  maxSlots: number,
): BlueprintSlot[] {
  const inv = buildLanguageInventory(language, items);
  const gaps = inv.cells
    .filter((c) => c.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining || a.level.localeCompare(b.level));

  const slots: BlueprintSlot[] = [];
  // Use existing approved count as starting slotIndex offset so IDs stay unique
  const usedKeys = new Set(items.map((i) => i.slotKey).filter(Boolean));

  for (const gap of gaps) {
    if (slots.length >= maxSlots) break;
    const need = Math.min(gap.remaining, maxSlots - slots.length);
    // Build a pool of specs for this cell larger than need
    const cellSlots = buildSlotSpecifications(language, { itemsPerCell: Math.max(gap.approved + need + 8, need + 8) }).filter(
      (s) => s.level === gap.level && s.skill === gap.skill,
    );
    // Start after highest existing prod index for this cell (not merely approved count)
    const prefix = `${language}|${gap.skill}|${gap.level}|prod`;
    let nextIndex = 0;
    for (const key of usedKeys) {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        const n = Number(key.slice(prefix.length));
        if (Number.isFinite(n) && n >= nextIndex) nextIndex = n + 1;
      }
    }
    // Also keep nextIndex at least at approved count for readability
    nextIndex = Math.max(nextIndex, gap.approved);
    let added = 0;
    let guard = 0;
    while (added < need && guard < need + 200) {
      guard += 1;
      const prodIndex = nextIndex;
      const slotKey = `${language}|${gap.skill}|${gap.level}|prod${prodIndex}`;
      if (usedKeys.has(slotKey)) {
        nextIndex += 1;
        continue;
      }
      const s = cellSlots[added % Math.max(1, cellSlots.length)] ?? cellSlots[0];
      if (!s) break;
      usedKeys.add(slotKey);
      slots.push({
        ...s,
        slotKey,
        slotIndex: prodIndex,
        specification: {
          ...s.specification,
          id: `spec.${slotKey.replace(/\|/g, '.')}`,
          difficultyWithinLevel: [0.25, 0.55, 0.8][prodIndex % 3]!,
        },
      });
      nextIndex += 1;
      added += 1;
    }
  }
  return slots;
}

export function summarizeGaps(inv: LanguageInventory): string {
  const lines = [`${inv.language}: ${inv.totalApproved}/${inv.totalRequired} (remain ${inv.totalRemaining})`];
  for (const c of inv.cells.filter((x) => x.remaining > 0).slice(0, 12)) {
    lines.push(`  ${cellKey(c.level, c.skill)} ${c.approved}/${c.required}`);
  }
  return lines.join('\n');
}
