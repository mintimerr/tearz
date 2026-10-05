/**
 * Convert approved bank records → PlacementContentItem (RN-safe, no node:fs).
 */

import { reliabilityForItem } from '../config.js';
import { createItemFromSpec } from '../item-factory.js';
import type { PlacementContentItem } from '../placement/content-bank.js';
import type { BankItemRecord } from './types.js';

function difficulty100FromWithin(
  level: BankItemRecord['targetLevel'],
  within: number,
): number {
  const bands: Record<string, [number, number]> = {
    A1: [0, 16],
    A2: [17, 33],
    B1: [34, 50],
    B2: [51, 67],
    C1: [68, 84],
    C2: [85, 100],
  };
  const [lo, hi] = bands[level] ?? [0, 100];
  const w = Math.max(0, Math.min(1, within));
  return Math.round(lo + w * (hi - lo));
}

/** Map bank itemType → UI PlacementQuestionKind strings the app already renders. */
function uiKindFromBankType(itemType: string): string {
  switch (itemType) {
    case 'grammarForm':
      return 'grammar_form';
    case 'errorCorrection':
      return 'error_correction';
    case 'fillBlank':
    case 'sentenceCompletion':
      return 'select_missing_word';
    case 'vocabularyChoice':
    case 'readingComprehension':
    case 'functionalPhrase':
    default:
      return 'multiple_choice';
  }
}

/**
 * PASS + provisional → eligible with reliability weight (~0.55).
 * Does NOT apply aiItemScoringPolicy=never_score (runtime AI drafts only).
 */
export function bankItemsToContentBank(items: BankItemRecord[]): PlacementContentItem[] {
  const out: PlacementContentItem[] = [];
  for (const rec of items) {
    if (rec.qualityGate !== 'PASS') continue;
    if (rec.calibrationStatus !== 'provisional') continue;
    if (rec.lifecycleState !== 'approved_provisional') continue;
    if (!rec.choices?.includes(rec.correctChoice)) continue;

    const evidenceWeight = reliabilityForItem('provisional');
    const item = createItemFromSpec({
      id: rec.id,
      language: rec.language,
      skill: rec.skill,
      construct: rec.construct,
      itemType: rec.itemType,
      responseFormat: rec.responseFormat,
      optionCount: rec.optionCount,
      targetLevel: rec.targetLevel,
      difficultyWithinLevel: rec.difficultyWithinLevel,
      calibrationStatus: 'provisional',
      source: 'bank',
      isScored: true,
    });

    item.predictedDifficulty = rec.predictedDifficulty;
    item.predictedDiscrimination = rec.predictedDiscrimination;

    const stem = (rec.stem || rec.prompt || '').trim();
    if (!stem || rec.choices.length < 2) continue;

    out.push({
      item,
      payload: {
        id: rec.id,
        kind: uiKindFromBankType(rec.itemType),
        instruction: rec.instruction || rec.prompt || 'Choose the answer',
        prompt: stem,
        choices: [...rec.choices],
        correctChoice: rec.correctChoice,
        difficulty100: difficulty100FromWithin(rec.targetLevel, rec.difficultyWithinLevel),
        section: rec.skill,
      },
      eligible: true,
      qualityGate: 'PASS',
      evidenceWeight,
    });
  }
  return out;
}
