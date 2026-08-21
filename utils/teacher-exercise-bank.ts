import type { TeacherExerciseKind } from '@/types/companion-chat-api';
import { MINI_DRILL_TASK_COUNT } from '@/constants/teacher-drill';

/** @deprecated use MINI_DRILL_TASK_COUNT */
export const MINI_DRILL_SIZE = MINI_DRILL_TASK_COUNT;

/**
 * Банк типов: ProgressMe / DET + механики в духе HelloChinese.
 * ИИ адаптирует содержание под любой L2 (zh / en / …).
 */
export const EXERCISE_BANK: ReadonlyArray<{ kind: TeacherExerciseKind; difficulty: number }> = [
  { kind: 'choose_translation', difficulty: 1 },
  { kind: 'read_and_select', difficulty: 2 },
  { kind: 'odd_one_out', difficulty: 3 },
  { kind: 'word_to_image', difficulty: 4 },
  { kind: 'match_pairs', difficulty: 5 },
  { kind: 'choose_reply', difficulty: 6 },
  { kind: 'what_do_you_say', difficulty: 7 },
  { kind: 'drag_word_to_blank', difficulty: 8 },
  { kind: 'complete_dialogue', difficulty: 9 },
  { kind: 'fill_partial_word', difficulty: 10 },
  { kind: 'type_word_in_blank', difficulty: 11 },
  { kind: 'pick_similar', difficulty: 12 },
  { kind: 'choose_word_form', difficulty: 13 },
  { kind: 'spot_error', difficulty: 14 },
  { kind: 'identify_main_idea', difficulty: 15 },
  { kind: 'sentence_order', difficulty: 16 },
  { kind: 'build_from_meaning', difficulty: 17 },
  { kind: 'multiple_choice', difficulty: 18 },
  { kind: 'voice_recording', difficulty: 19 },
  { kind: 'write_sentences', difficulty: 20 },
] as const;

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Случайные типы из банка, отсортированные по сложности (для mini-drill). */
export function pickExerciseKindsForSeed(seed: string, count = MINI_DRILL_SIZE): TeacherExerciseKind[] {
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
