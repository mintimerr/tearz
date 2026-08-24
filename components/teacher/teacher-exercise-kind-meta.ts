import { Ionicons } from '@expo/vector-icons';

import type { TeacherExerciseKind } from '@/types/companion-chat-api';

export const DRILL_ACCENT = '#5E9CFF';

export const EXERCISE_KIND_META: Record<
  TeacherExerciseKind,
  { labelKey: `teacher.drill.kind.${TeacherExerciseKind}`; icon: keyof typeof Ionicons.glyphMap }
> = {
  drag_word_to_blank: { labelKey: 'teacher.drill.kind.drag_word_to_blank', icon: 'move-outline' },
  type_word_in_blank: { labelKey: 'teacher.drill.kind.type_word_in_blank', icon: 'remove-outline' },
  choose_word_form: { labelKey: 'teacher.drill.kind.choose_word_form', icon: 'git-compare-outline' },
  word_to_image: { labelKey: 'teacher.drill.kind.word_to_image', icon: 'image-outline' },
  sentence_order: { labelKey: 'teacher.drill.kind.sentence_order', icon: 'reorder-four-outline' },
  match_pairs: { labelKey: 'teacher.drill.kind.match_pairs', icon: 'link-outline' },
  voice_recording: { labelKey: 'teacher.drill.kind.voice_recording', icon: 'mic-outline' },
  write_sentences: { labelKey: 'teacher.drill.kind.write_sentences', icon: 'create-outline' },
  read_and_select: { labelKey: 'teacher.drill.kind.read_and_select', icon: 'checkmark-circle-outline' },
  fill_partial_word: { labelKey: 'teacher.drill.kind.fill_partial_word', icon: 'text-outline' },
  identify_main_idea: { labelKey: 'teacher.drill.kind.identify_main_idea', icon: 'bulb-outline' },
  fill_blank: { labelKey: 'teacher.drill.kind.fill_blank', icon: 'remove-outline' },
  multiple_choice: { labelKey: 'teacher.drill.kind.multiple_choice', icon: 'list-outline' },
  free_text: { labelKey: 'teacher.drill.kind.free_text', icon: 'create-outline' },
  choose_translation: { labelKey: 'teacher.drill.kind.choose_translation', icon: 'language-outline' },
  choose_reply: { labelKey: 'teacher.drill.kind.choose_reply', icon: 'chatbubble-ellipses-outline' },
  odd_one_out: { labelKey: 'teacher.drill.kind.odd_one_out', icon: 'filter-outline' },
  spot_error: { labelKey: 'teacher.drill.kind.spot_error', icon: 'alert-circle-outline' },
  what_do_you_say: { labelKey: 'teacher.drill.kind.what_do_you_say', icon: 'people-outline' },
  build_from_meaning: { labelKey: 'teacher.drill.kind.build_from_meaning', icon: 'construct-outline' },
  pick_similar: { labelKey: 'teacher.drill.kind.pick_similar', icon: 'eye-outline' },
  complete_dialogue: { labelKey: 'teacher.drill.kind.complete_dialogue', icon: 'chatbubbles-outline' },
  translate_sentence: { labelKey: 'teacher.drill.kind.translate_sentence', icon: 'swap-horizontal-outline' },
  reverse_translation: { labelKey: 'teacher.drill.kind.reverse_translation', icon: 'return-down-back-outline' },
  select_missing_word: { labelKey: 'teacher.drill.kind.select_missing_word', icon: 'ellipsis-horizontal-outline' },
  true_false: { labelKey: 'teacher.drill.kind.true_false', icon: 'help-circle-outline' },
  type_translation: { labelKey: 'teacher.drill.kind.type_translation', icon: 'keypad-outline' },
  collocation_choice: { labelKey: 'teacher.drill.kind.collocation_choice', icon: 'git-network-outline' },
};
