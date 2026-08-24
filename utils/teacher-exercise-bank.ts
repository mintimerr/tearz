import type { TeacherExerciseKind } from '@/types/companion-chat-api';
import { DRILL_TASK_COUNT } from '@/constants/teacher-drill';

/** @deprecated use DRILL_TASK_COUNT */
export const MINI_DRILL_SIZE = DRILL_TASK_COUNT;

/** Sync с server/src/index.js EXERCISE_BANK — planner выбирает kinds только отсюда. */
export const EXERCISE_BANK: ReadonlyArray<{
  kind: TeacherExerciseKind;
  difficulty: number;
  bestFor: string;
}> = [
  { kind: 'choose_translation', difficulty: 1, bestFor: 'новая лексика / перевод' },
  { kind: 'read_and_select', difficulty: 2, bestFor: 'орфография, настоящее vs выдуманное слово' },
  { kind: 'odd_one_out', difficulty: 3, bestFor: 'семантические группы по теме' },
  { kind: 'word_to_image', difficulty: 4, bestFor: 'конкретные существительные' },
  { kind: 'match_pairs', difficulty: 5, bestFor: 'пары слов/фраз по теме' },
  { kind: 'choose_reply', difficulty: 6, bestFor: 'мини-диалог, ответная реплика' },
  { kind: 'what_do_you_say', difficulty: 7, bestFor: 'ситуация → уместная фраза' },
  { kind: 'drag_word_to_blank', difficulty: 8, bestFor: 'грамматика в контексте, пропуск' },
  { kind: 'complete_dialogue', difficulty: 9, bestFor: 'диалог с пропуском' },
  { kind: 'fill_partial_word', difficulty: 10, bestFor: 'дописать форму слова' },
  { kind: 'type_word_in_blank', difficulty: 11, bestFor: 'активное вспоминание без wordBank' },
  { kind: 'pick_similar', difficulty: 12, bestFor: 'похожие формы / confusables' },
  { kind: 'choose_word_form', difficulty: 13, bestFor: 'спряжение, время, согласование' },
  { kind: 'spot_error', difficulty: 14, bestFor: 'типичная ошибка по теме' },
  { kind: 'identify_main_idea', difficulty: 15, bestFor: 'главная мысль короткого текста' },
  { kind: 'sentence_order', difficulty: 16, bestFor: 'порядок слов' },
  { kind: 'build_from_meaning', difficulty: 17, bestFor: 'смысл UI → собрать L2' },
  { kind: 'multiple_choice', difficulty: 18, bestFor: 'нюанс, регистр' },
  { kind: 'voice_recording', difficulty: 19, bestFor: 'произнести фразу из запроса' },
  { kind: 'write_sentences', difficulty: 20, bestFor: 'свободная продукция' },
] as const;

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Локальный fallback (основной выбор kinds — на сервере через AI planner). */
export function pickExerciseKindsForSeed(seed: string, count = DRILL_TASK_COUNT): TeacherExerciseKind[] {
  let s = hashSeed(seed || 'default');
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const indices = EXERCISE_BANK.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices
    .slice(0, count)
    .map((i) => EXERCISE_BANK[i]!)
    .sort((a, b) => a.difficulty - b.difficulty)
    .map((x) => x.kind);
}

export function exerciseKindDifficulty(kind: TeacherExerciseKind): number {
  const found = EXERCISE_BANK.find((x) => x.kind === kind);
  if (found) return found.difficulty;
  if (kind === 'fill_blank' || kind === 'complete_dialogue') return 8;
  if (kind === 'free_text') return 20;
  if (
    kind === 'choose_translation' ||
    kind === 'choose_reply' ||
    kind === 'odd_one_out' ||
    kind === 'spot_error' ||
    kind === 'what_do_you_say'
  ) {
    return 6;
  }
  if (kind === 'build_from_meaning') return 17;
  if (kind === 'pick_similar') return 12;
  return 5;
}
