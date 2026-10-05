/** Заданий в одной тренировке по объяснению (UI, промпты, сервер). */
export const DRILL_TASK_COUNT = 10;

/** @deprecated use DRILL_TASK_COUNT */
export const MINI_DRILL_TASK_COUNT = DRILL_TASK_COUNT;

/** @deprecated Plus full workout merged into DRILL_TASK_COUNT */
export const FULL_WORKOUT_TASK_COUNT = DRILL_TASK_COUNT;

/**
 * Временно без лимитов на тренировки (пока тестируем).
 * Вернуть конечные числа, когда снова понадобится квота.
 */
export const MINI_DRILL_LIMITS_DISABLED = true;

/** Сколько разных объяснений в уроке можно открыть тренировку. */
export const MINI_DRILL_MAX_LESSONS = MINI_DRILL_LIMITS_DISABLED ? 999_999 : 3;

/** Сколько раз можно обновить набор для одного объяснения (после первого прохода). */
export const MINI_DRILL_MAX_REFRESHES = MINI_DRILL_LIMITS_DISABLED ? 999_999 : 2;
