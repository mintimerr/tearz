export const NUMBERED_SENTENCE_START = '1. ';

/** Стартовое значение и авто-нумерация при Enter (2., 3., …). */
export function normalizeNumberedSentenceInput(prev: string, next: string): string {
  if (!next) return NUMBERED_SENTENCE_START;
  if (next.trim() === '') return NUMBERED_SENTENCE_START;

  if (next.length > prev.length && next.endsWith('\n')) {
    const nextIndex = next.split('\n').length;
    return `${next}${nextIndex}. `;
  }

  return next;
}
