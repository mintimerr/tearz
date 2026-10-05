import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type { PlacementHistoryItem } from '@/types/placement-api';

import { mintUniquePlacementQuestion } from '@/utils/placement-unique-factory';
import type { LocalPlacementQuestion } from '@/utils/placement-local-questions';
import { buildSeenQuestionKeys, normalizePlacementPrompt } from '@/utils/placement-seen';

const SECTIONS = ['grammar', 'comprehension', 'phrases', 'structure', 'dialogue'] as const;

type AdaptivePickOptions = {
  lang: CompanionChatApiLanguage;
  questionIndex: number;
  history: PlacementHistoryItem[];
  targetDifficulty: number;
  allowWeak?: boolean;
  seenIds?: string[];
  seenPrompts?: string[];
  seenContentKeys?: string[];
  sessionSalt?: number;
  userEntropy?: number;
};

/**
 * Every placement item is freshly minted — never pulled from a shared static bank.
 * Surface text varies by userEntropy + sessionSalt so installs never share sequences.
 */
export function pickAdaptiveQuestion(options: AdaptivePickOptions): LocalPlacementQuestion {
  const {
    lang,
    questionIndex,
    history,
    targetDifficulty,
    seenIds,
    seenPrompts,
    seenContentKeys,
    sessionSalt = Date.now(),
    userEntropy = 0,
  } = options;
  const seen = buildSeenQuestionKeys(history);
  for (const id of seenIds ?? []) seen.ids.add(id);
  for (const prompt of seenPrompts ?? []) seen.prompts.add(normalizePlacementPrompt(prompt));
  for (const key of seenContentKeys ?? []) seen.contents.add(key);

  const section = SECTIONS[questionIndex % SECTIONS.length];

  return mintUniquePlacementQuestion({
    lang,
    section,
    targetDifficulty,
    sessionSalt,
    userEntropy: userEntropy || ((sessionSalt ^ 0x9e3779b9) >>> 0),
    seenIds: [...seen.ids],
    seenPrompts: [...seen.prompts],
    seenContentKeys: [...seen.contents],
    attemptOffset: questionIndex * 17,
  });
}

export function abilityBandLabel(ability: number): string {
  if (ability < 15) return 'A1';
  if (ability < 28) return 'A2';
  if (ability < 42) return 'B1';
  if (ability < 58) return 'B2';
  if (ability < 75) return 'C1';
  return 'C2';
}
