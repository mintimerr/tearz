import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type TeacherHomeSuggestion = {
  id: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  prompt: string;
};

/** Подсказки на главном экране преподавателя — как у ChatGPT: иконка + короткая аннотация. */
export const TEACHER_HOME_SUGGESTIONS: TeacherHomeSuggestion[] = [
  {
    id: 'tenses',
    icon: 'git-compare-outline',
    title: 'Present Simple и Continuous',
    prompt: 'Объясни разницу между Present Simple и Present Continuous',
  },
  {
    id: 'articles',
    icon: 'text-outline',
    title: 'Артикли a и the',
    prompt: 'Как правильно использовать артикли a и the?',
  },
  {
    id: 'check',
    icon: 'checkmark-done-outline',
    title: 'Проверка фразы',
    prompt: 'Проверь мою фразу на ошибки',
  },
  {
    id: 'lesson-plan',
    icon: 'map-outline',
    title: 'План урока',
    prompt: 'Составь план урока по теме путешествий',
  },
  {
    id: 'natural',
    icon: 'chatbubbles-outline',
    title: 'Живой разговор',
    prompt: 'Помоги звучать естественнее в разговоре',
  },
];
