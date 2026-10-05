import type { TeacherExerciseItem } from '@/types/companion-chat-api';
import { extractPairsFromTeacherText } from '@/utils/learner-lexicon';
import { extractTeacherExamples } from '@/utils/teacher-message-examples';
import { splitVocabPair } from '@/utils/teacher-message-sections';

type Pair = { word: string; gloss: string };

function shuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = Math.abs(seed) || 1;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j]!;
    arr[j] = tmp!;
  }
  return arr;
}

function makeFakeWord(word: string): string {
  const chars = [...word];
  if (chars.length >= 2) {
    return `${chars[chars.length - 1]}${chars.slice(0, -1).join('')}`;
  }
  return `${word}某`;
}

function collectPairs(text: string): Pair[] {
  const out: Pair[] = [];
  const seen = new Set<string>();
  const push = (word: string, gloss: string) => {
    const w = word.trim();
    const g = gloss.trim().split(/[;；]/)[0]?.trim() ?? '';
    if (w.length < 1 || g.length < 2 || w.length > 40 || g.length > 48) return;
    if (w.toLowerCase() === g.toLowerCase()) return;
    const key = `${w.toLowerCase()}|${g.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ word: w, gloss: g });
  };

  for (const group of extractTeacherExamples(text, 'drill-fallback')) {
    for (const item of group.items) {
      if (item.subtext) {
        push(item.text, item.subtext);
        continue;
      }
      const split = splitVocabPair(item.text);
      if (split) push(split.word, split.gloss);
    }
  }
  for (const pair of extractPairsFromTeacherText(text)) {
    push(pair.front, pair.back);
  }
  return out.slice(0, 8);
}

/**
 * Когда сервер не собрал полный набор («Exercise set too short»),
 * собираем тренировку из слов этого же урока.
 */
export function buildFallbackExercises(explanation: string): TeacherExerciseItem[] | null {
  const pairs = collectPairs(explanation);
  if (pairs.length < 2) return null;

  const exercises: TeacherExerciseItem[] = [];
  const empty = [] as TeacherExerciseItem['segments'];

  const matched = pairs.slice(0, Math.min(4, pairs.length));
  exercises.push({
    id: 'fb-match',
    kind: 'match_pairs',
    instruction: 'Соедини слово и перевод',
    segments: empty,
    pairs: matched.map((p, i) => ({ id: `p${i + 1}`, left: p.word, right: p.gloss })),
    checkText: matched.map((p) => p.word).join(' · '),
  });

  pairs.slice(0, 4).forEach((pair, i) => {
    const glosses = pairs.map((p) => p.gloss);
    const unique = [...new Set(glosses)];
    const choices = shuffle(unique, i + 11).slice(0, 4);
    if (!choices.includes(pair.gloss)) choices[0] = pair.gloss;
    exercises.push({
      id: `fb-tr-${i}`,
      kind: 'choose_translation',
      instruction: 'Выбери перевод',
      segments: empty,
      checkText: pair.word,
      choices: shuffle(choices, i + 29),
      correctChoice: pair.gloss,
    });
  });

  exercises.push({
    id: 'fb-real',
    kind: 'read_and_select',
    segments: empty,
    checkText: pairs[0]!.word,
    selectWord: pairs[0]!.word,
    selectIsReal: true,
  });

  const fake = makeFakeWord(pairs[0]!.word);
  if (fake !== pairs[0]!.word && !pairs.some((p) => p.word === fake)) {
    exercises.push({
      id: 'fb-fake',
      kind: 'read_and_select',
      segments: empty,
      checkText: fake,
      selectWord: fake,
      selectIsReal: false,
    });
  }

  exercises.push({
    id: 'fb-type',
    kind: 'type_translation',
    instruction: 'Напиши это на изучаемом языке',
    segments: [{ type: 'text', value: pairs[0]!.gloss }],
    checkText: pairs[0]!.gloss,
    correctChoice: pairs[0]!.word,
  });

  return exercises.length >= 3 ? exercises.slice(0, 10) : null;
}
