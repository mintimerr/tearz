import type { TeacherVocabWordCard } from '@/types/companion-chat-api';

export function normalizeTeacherVocabExamples(raw: unknown): TeacherVocabWordCard[] {
  if (!raw || typeof raw !== 'object') return [];
  const wordsRaw = (raw as { words?: unknown }).words;
  if (!Array.isArray(wordsRaw)) return [];

  const out: TeacherVocabWordCard[] = [];
  for (const w of wordsRaw.slice(0, 8)) {
    if (!w || typeof w !== 'object') continue;
    const word = typeof (w as { word?: unknown }).word === 'string' ? (w as { word: string }).word.trim() : '';
    const gloss = typeof (w as { gloss?: unknown }).gloss === 'string' ? (w as { gloss: string }).gloss.trim() : '';
    if (!word || !gloss) continue;

    const pinyinRaw = (w as { pinyin?: unknown }).pinyin;
    const pinyin = typeof pinyinRaw === 'string' && pinyinRaw.trim() ? pinyinRaw.trim() : undefined;

    const sentencesRaw = (w as { sentences?: unknown }).sentences;
    const sentences = [];
    if (Array.isArray(sentencesRaw)) {
      for (const s of sentencesRaw.slice(0, 5)) {
        if (!s || typeof s !== 'object') continue;
        const l2 = typeof (s as { l2?: unknown }).l2 === 'string' ? (s as { l2: string }).l2.trim() : '';
        const translation =
          typeof (s as { translation?: unknown }).translation === 'string'
            ? (s as { translation: string }).translation.trim()
            : '';
        if (!l2 || !translation) continue;
        const sp = (s as { pinyin?: unknown }).pinyin;
        const note = (s as { note?: unknown }).note;
        sentences.push({
          l2,
          pinyin: typeof sp === 'string' && sp.trim() ? sp.trim() : undefined,
          translation,
          note: typeof note === 'string' && note.trim() ? note.trim() : undefined,
        });
      }
    }
    if (sentences.length === 0) continue;
    out.push({ word, pinyin, gloss, sentences });
  }
  return out;
}

export function countVocabExampleItems(words: TeacherVocabWordCard[]): number {
  return words.reduce((sum, w) => sum + w.sentences.length, 0);
}
