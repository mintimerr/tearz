import {
  TEACHER_HOME_SUGGESTIONS,
  type TeacherHomeSuggestion,
} from '@/constants/teacher-suggestions';
import { getTeacherSessionSuggestion } from '@/utils/teacher-session-suggestion';

/** До четырёх подсказок для hero — одна на сессию + ещё три (сетка 2×2). */
export function getTeacherHeroSuggestions(count = 4): TeacherHomeSuggestion[] {
  const primary = getTeacherSessionSuggestion();
  const rest = TEACHER_HOME_SUGGESTIONS.filter((s) => s.id !== primary.id);
  const out = [primary];
  for (let i = 0; i < rest.length && out.length < count; i += 1) {
    out.push(rest[i]!);
  }
  return out;
}
