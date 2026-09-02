import type { TeacherVocabWordCard } from '@/types/companion-chat-api';

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function appearsInExplanation(sentence: string, explanation: string): boolean {
  const s = normalizeForMatch(sentence);
  const e = normalizeForMatch(explanation);
  if (!s || s.length < 8) return false;
  if (e.includes(s)) return true;
  if (s.length > 24 && e.includes(s.slice(0, Math.min(s.length, 48)))) return true;
  return false;
}

/** Оставляет только предложения, которых нет в тексте ответа учителя. */
export function filterVocabExamplesNotInExplanation(
  words: TeacherVocabWordCard[],
  explanation: string,
): TeacherVocabWordCard[] {
  const source = explanation.trim();
  if (!source) return words;

  const out: TeacherVocabWordCard[] = [];
  for (const card of words) {
    const sentences = card.sentences.filter(
      (s) => !appearsInExplanation(s.l2, source) && !appearsInExplanation(s.translation, source),
    );
    if (sentences.length === 0) continue;
    out.push({ ...card, sentences });
  }
  return out;
}
