import type { TeacherExerciseKind } from '@/types/companion-chat-api';

/** Выбор из вариантов (A/B/C/D) — один correctChoice. */
export const CHOICE_EXERCISE_KINDS: ReadonlySet<TeacherExerciseKind> = new Set([
  'multiple_choice',
  'choose_translation',
  'choose_reply',
  'odd_one_out',
  'spot_error',
  'what_do_you_say',
]);

/** Сборка предложения из слов. */
export const ORDER_EXERCISE_KINDS: ReadonlySet<TeacherExerciseKind> = new Set([
  'sentence_order',
  'build_from_meaning',
]);

/** Выбор формы / похожих написаний. */
export const FORM_EXERCISE_KINDS: ReadonlySet<TeacherExerciseKind> = new Set([
  'choose_word_form',
  'pick_similar',
]);

/** Перенос слова в пропуск (в т.ч. диалог). */
export const DRAG_BLANK_EXERCISE_KINDS: ReadonlySet<TeacherExerciseKind> = new Set([
  'drag_word_to_blank',
  'complete_dialogue',
  'fill_blank',
]);

export function isChoiceExerciseKind(kind: TeacherExerciseKind): boolean {
  return CHOICE_EXERCISE_KINDS.has(kind);
}

export function isOrderExerciseKind(kind: TeacherExerciseKind): boolean {
  return ORDER_EXERCISE_KINDS.has(kind);
}

export function isFormExerciseKind(kind: TeacherExerciseKind): boolean {
  return FORM_EXERCISE_KINDS.has(kind);
}

export function isDragBlankExerciseKind(kind: TeacherExerciseKind): boolean {
  return DRAG_BLANK_EXERCISE_KINDS.has(kind);
}
