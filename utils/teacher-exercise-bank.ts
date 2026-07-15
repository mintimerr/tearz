import type { TeacherExerciseKind } from '@/types/companion-chat-api';
import { MINI_DRILL_TASK_COUNT } from '@/constants/teacher-drill';

/** @deprecated use MINI_DRILL_TASK_COUNT */
export const MINI_DRILL_SIZE = MINI_DRILL_TASK_COUNT;

/** Полный банк типов (ProgressMe + DET), от лёгкого к сложному. */
export const EXERCISE_BANK: ReadonlyArray<{ kind: TeacherExerciseKind; difficulty: number }> = [
  { kind: 'read_and_select', difficulty: 1 },
  { kind: 'drag_word_to_blank', difficulty: 2 },
  { kind: 'fill_partial_word', difficulty: 3 },
  { kind: 'type_word_in_blank', difficulty: 4 },
  { kind: 'identify_main_idea', difficulty: 5 },
  { kind: 'choose_word_form', difficulty: 6 },
  { kind: 'word_to_image', difficulty: 7 },
  { kind: 'sentence_order', difficulty: 8 },
  { kind: 'match_pairs', difficulty: 9 },
  { kind: 'voice_recording', difficulty: 10 },
  { kind: 'write_sentences', difficulty: 11 },
] as const;

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 5 случайных типов из банка, отсортированных по сложности (для mini-drill). */
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
  if (kind === 'fill_blank' || kind === 'multiple_choice') return 4;
  if (kind === 'free_text') return 11;
  return 5;
}
