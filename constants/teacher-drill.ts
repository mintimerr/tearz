/** Заданий в одной тренировке по объяснению (UI, промпты, сервер). */
export const DRILL_TASK_COUNT = 10;

/** @deprecated use DRILL_TASK_COUNT */
export const MINI_DRILL_TASK_COUNT = DRILL_TASK_COUNT;

/** @deprecated Plus full workout merged into DRILL_TASK_COUNT */
export const FULL_WORKOUT_TASK_COUNT = DRILL_TASK_COUNT;

/** Сколько разных объяснений в уроке можно открыть тренировку. */
export const MINI_DRILL_MAX_LESSONS = 9999;

/** Сколько раз можно обновить набор для одного объяснения (после первого прохода). */
export const MINI_DRILL_MAX_REFRESHES = 2;
