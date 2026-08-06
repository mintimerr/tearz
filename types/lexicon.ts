/** Пара для мини-игры и прогресса: слово ↔ перевод. */
export type LexiconPair = {
  id: string;
  front: string;
  back: string;
  pinyin?: string;
  source: 'vocab' | 'folder' | 'teacher' | 'seed';
};

export const LEXICON_HARVEST_MAX = 400;
export const PLUS_DAY_COIN_COST = 150;
export const PLUS_DAY_MS = 24 * 60 * 60 * 1000;
