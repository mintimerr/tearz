import { TEACHER_HOME_SUGGESTIONS } from '@/constants/teacher-suggestions';

export type TeacherSessionSuggestion = (typeof TEACHER_HOME_SUGGESTIONS)[number];

let sessionSuggestion: TeacherSessionSuggestion | null = null;

/** Одна подсказка на сессию приложения — меняется при следующем запуске. */
export function getTeacherSessionSuggestion(): TeacherSessionSuggestion {
  if (sessionSuggestion === null) {
    const index = Math.floor(Math.random() * TEACHER_HOME_SUGGESTIONS.length);
    sessionSuggestion = TEACHER_HOME_SUGGESTIONS[index]!;
  }
  return sessionSuggestion;
}
