/**
 * Engineering validation: synthetic 15-question sessions on production bank.
 * Not evidence of CEFR accuracy.
 */

import { PlacementOrchestrationService } from '../../placement/index.js';
import { bankItemsToContentBank } from '../loader.js';
import type { BankItemRecord, BankLanguage } from '../types.js';

export type SimulationProfile = 'always_first' | 'always_last' | 'alternate' | 'randomish';

export type LanguageSimulationResult = {
  language: BankLanguage;
  runs: number;
  completed: number;
  exhausted: number;
  mintCalls: number;
  duplicatePresentations: number;
  avgUniqueItems: number;
  exposure: Record<string, number>;
};

function answerFor(
  profile: SimulationProfile,
  step: { question: { choices: string[] } },
  qIndex: number,
  seed: number,
): string {
  const choices = step.question.choices;
  if (profile === 'always_first') return choices[0]!;
  if (profile === 'always_last') return choices[choices.length - 1]!;
  if (profile === 'alternate') return choices[qIndex % choices.length]!;
  return choices[(seed + qIndex * 7) % choices.length]!;
}

export function simulateLanguageBank(
  language: BankLanguage,
  items: BankItemRecord[],
  opts?: { runsPerProfile?: number },
): LanguageSimulationResult {
  const runsPerProfile = opts?.runsPerProfile ?? 8;
  const profiles: SimulationProfile[] = ['always_first', 'always_last', 'alternate', 'randomish'];
  const contentBank = bankItemsToContentBank(items);
  let completed = 0;
  let exhausted = 0;
  let mintCalls = 0;
  let duplicatePresentations = 0;
  let uniqueSum = 0;
  let runs = 0;
  const exposure: Record<string, number> = {};

  for (const profile of profiles) {
    for (let r = 0; r < runsPerProfile; r += 1) {
      runs += 1;
      let localMint = 0;
      const svc = new PlacementOrchestrationService({
        language,
        contentBank,
        mintFallback: () => {
          localMint += 1;
          mintCalls += 1;
          return null;
        },
      });
      let step = svc.start();
      const seen = new Set<string>();
      let q = 0;
      let dup = 0;
      while (!step.done && q < 20) {
        if (seen.has(step.question.id)) dup += 1;
        seen.add(step.question.id);
        exposure[step.question.id] = (exposure[step.question.id] ?? 0) + 1;
        const ans = answerFor(profile, step, q, r + profile.length);
        step = svc.answer({ answer: ans });
        q += 1;
      }
      duplicatePresentations += dup;
      uniqueSum += seen.size;
      if (step.done) completed += 1;
      else exhausted += 1;
      if (localMint > 0 && !step.done) {
        /* counted */
      }
    }
  }

  return {
    language,
    runs,
    completed,
    exhausted,
    mintCalls,
    duplicatePresentations,
    avgUniqueItems: runs ? uniqueSum / runs : 0,
    exposure,
  };
}
