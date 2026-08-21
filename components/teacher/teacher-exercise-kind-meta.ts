import { Ionicons } from '@expo/vector-icons';

import type { TeacherExerciseKind } from '@/types/companion-chat-api';

export const DRILL_ACCENT = '#5E9CFF';

export const EXERCISE_KIND_META: Record<
  TeacherExerciseKind,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  drag_word_to_blank: { label: 'Перенос', icon: 'move-outline' },
  type_word_in_blank: { label: 'Пропуск', icon: 'remove-outline' },
  choose_word_form: { label: 'Форма', icon: 'git-compare-outline' },
  word_to_image: { label: 'Картинки', icon: 'image-outline' },
  sentence_order: { label: 'Порядок', icon: 'reorder-four-outline' },
  match_pairs: { label: 'Пары', icon: 'link-outline' },
  voice_recording: { label: 'Голос', icon: 'mic-outline' },
  write_sentences: { label: 'Письмо', icon: 'create-outline' },
  read_and_select: { label: 'Слово', icon: 'checkmark-circle-outline' },
  fill_partial_word: { label: 'Буквы', icon: 'text-outline' },
  identify_main_idea: { label: 'Мысль', icon: 'bulb-outline' },
  fill_blank: { label: 'Пропуск', icon: 'remove-outline' },
  multiple_choice: { label: 'Выбор', icon: 'list-outline' },
  free_text: { label: 'Текст', icon: 'create-outline' },
  choose_translation: { label: 'Перевод', icon: 'language-outline' },
  choose_reply: { label: 'Ответ', icon: 'chatbubble-ellipses-outline' },
  odd_one_out: { label: 'Лишнее', icon: 'filter-outline' },
  spot_error: { label: 'Ошибка', icon: 'alert-circle-outline' },
  what_do_you_say: { label: 'Ситуация', icon: 'people-outline' },
  build_from_meaning: { label: 'Сборка', icon: 'construct-outline' },
  pick_similar: { label: 'Похожие', icon: 'eye-outline' },
  complete_dialogue: { label: 'Диалог', icon: 'chatbubbles-outline' },
};
