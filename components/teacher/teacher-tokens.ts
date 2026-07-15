/** Tearz Teacher — спокойная тёмная палитра приложения */

import { APP_THEME } from '@/constants/theme';

export const TEACHER_BG = APP_THEME.color.bg;
export const TEACHER_BG_ELEVATED = APP_THEME.color.elevated;

export const TEACHER_CARD = APP_THEME.color.surface;
export const TEACHER_CARD_BORDER = APP_THEME.color.border;
export const TEACHER_GLASS = APP_THEME.color.glass;
export const TEACHER_GLASS_BORDER = APP_THEME.color.borderStrong;

/** Tearz violet — primary actions */
export const TEACHER_ACCENT = APP_THEME.color.accent;
export const TEACHER_ACCENT_SOFT = APP_THEME.color.accentSoft;

/** Прогресс / streak — приглушённый sage вместо кислотного зелёного */
export const TEACHER_LIME = APP_THEME.color.success;
export const TEACHER_LIME_SOFT = APP_THEME.color.successSoft;

export const TEACHER_MUTED = APP_THEME.color.muted;
export const TEACHER_MUTED_SOFT = APP_THEME.color.mutedSoft;
export const TEACHER_TITLE = APP_THEME.color.text;
export const TEACHER_TAB_BAR_CORE = APP_THEME.tabBar.core;

export const TEACHER_RADIUS = {
  sm: APP_THEME.radius.sm,
  md: APP_THEME.radius.lg,
  lg: APP_THEME.radius.xl,
  xl: APP_THEME.radius.xxl,
  pill: APP_THEME.radius.pill,
} as const;

export const TEACHER_TYPE = APP_THEME.type;

/** Apple-style accents for lesson row icons (same palette as vocabulary folders) */
export const TEACHER_LESSON_COLORS = [
  '#0A84FF',
  '#30D158',
  '#FF9F0A',
  '#BF5AF2',
  '#FF453A',
  '#64D2FF',
] as const;

export const TEACHER_LESSON_CONTINUE_COLOR = '#30D158';
export const TEACHER_LESSON_NEW_COLOR = '#0A84FF';

export function teacherLessonColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TEACHER_LESSON_COLORS[h % TEACHER_LESSON_COLORS.length];
}
