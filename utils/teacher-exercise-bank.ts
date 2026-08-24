import type { TeacherExerciseKind } from '@/types/companion-chat-api';
import { DRILL_TASK_COUNT } from '@/constants/teacher-drill';

/** @deprecated use DRILL_TASK_COUNT */
export const MINI_DRILL_SIZE = DRILL_TASK_COUNT;

/** Sync с server/src/index.js EXERCISE_BANK — planner выбирает kinds только отсюда. */
export const EXERCISE_BANK: ReadonlyArray<{
  kind: TeacherExerciseKind;
  difficulty: number;
  bestFor: string;
  source?: string;
}> = [
  { kind: 'choose_translation', difficulty: 1, bestFor: 'новая лексика / перевод слова', source: 'HelloChinese' },
  { kind: 'translate_sentence', difficulty: 2, bestFor: 'UI-предложение → выбрать перевод на L2', source: 'Duolingo' },
  { kind: 'reverse_translation', difficulty: 2, bestFor: 'L2 слово/фраза → выбрать значение на UI', source: 'Memrise' },
  { kind: 'read_and_select', difficulty: 3, bestFor: 'орфография, настоящее vs выдуманное слово', source: 'DET' },
  { kind: 'odd_one_out', difficulty: 4, bestFor: 'семантические группы по теме', source: 'HelloChinese' },
  { kind: 'word_to_image', difficulty: 5, bestFor: 'конкретные существительные', source: 'HelloChinese' },
  { kind: 'match_pairs', difficulty: 6, bestFor: 'пары слов/фраз по теме', source: 'Memrise' },
  { kind: 'true_false', difficulty: 7, bestFor: 'правило или утверждение → верно/неверно', source: 'Busuu' },
  { kind: 'choose_reply', difficulty: 8, bestFor: 'мини-диалог, ответная реплика', source: 'HelloChinese' },
  { kind: 'what_do_you_say', difficulty: 9, bestFor: 'ситуация → уместная фраза', source: 'HelloChinese' },
  { kind: 'select_missing_word', difficulty: 10, bestFor: 'пропуск в предложении → выбрать слово', source: 'Duolingo' },
  { kind: 'collocation_choice', difficulty: 11, bestFor: 'естественное словосочетание / партнёр слова', source: 'Babbel' },
  { kind: 'drag_word_to_blank', difficulty: 12, bestFor: 'грамматика в контексте, collocation', source: 'ProgressMe' },
  { kind: 'complete_dialogue', difficulty: 13, bestFor: 'диалог с пропуском', source: 'HelloChinese' },
  { kind: 'fill_partial_word', difficulty: 14, bestFor: 'дописать форму слова', source: 'HelloChinese' },
  { kind: 'choose_word_form', difficulty: 15, bestFor: 'спряжение, время, согласование', source: 'Babbel' },
  { kind: 'pick_similar', difficulty: 16, bestFor: 'похожие формы / confusables', source: 'HelloChinese' },
  { kind: 'spot_error', difficulty: 17, bestFor: 'типичная ошибка по теме', source: 'HelloChinese' },
  { kind: 'type_word_in_blank', difficulty: 18, bestFor: 'активное вспоминание без wordBank', source: 'ProgressMe' },
  { kind: 'type_translation', difficulty: 19, bestFor: 'UI-фраза → напечатать перевод на L2', source: 'Babbel' },
  { kind: 'identify_main_idea', difficulty: 20, bestFor: 'главная мысль короткого текста', source: 'DET' },
  { kind: 'sentence_order', difficulty: 21, bestFor: 'порядок слов', source: 'Duolingo' },
  { kind: 'build_from_meaning', difficulty: 22, bestFor: 'смысл UI → собрать L2', source: 'HelloChinese' },
  { kind: 'multiple_choice', difficulty: 23, bestFor: 'нюанс, регистр', source: 'Busuu' },
  { kind: 'voice_recording', difficulty: 24, bestFor: 'произнести фразу из запроса', source: 'Babbel' },
  { kind: 'write_sentences', difficulty: 25, bestFor: 'свободная продукция', source: 'Busuu' },
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
  if (kind === 'fill_blank' || kind === 'complete_dialogue') return 12;
  if (kind === 'free_text') return 25;
  return 10;
}
