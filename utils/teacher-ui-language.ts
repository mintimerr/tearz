import type { NativeLanguage } from '@/contexts/auth-context';

/** Язык UI / объяснений учителя (не L2 урока). */
export type TeacherUiLanguage = 'ru' | 'en' | 'zh';

export function teacherUiLanguageFromLocale(locale: NativeLanguage | string | null | undefined): TeacherUiLanguage {
  if (locale === 'en' || locale === 'zh') return locale;
  return 'ru';
}

export function teacherPhotoFallbackMessage(ui: TeacherUiLanguage): string {
  if (ui === 'zh') return '学生发来了一张照片。';
  if (ui === 'en') return 'The learner sent a photo.';
  return 'Ученик отправил фото.';
}
