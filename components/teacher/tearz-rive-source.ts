/**
 * Точка подключения Rive-персонажа Tearz.
 *
 * Подключён ассет «Assistant Character» by HaiDo (Rive Community, лицензия CC BY —
 * нужна атрибуция автора). Артборд «Avatar», стейт-машина «State Machine 1»
 * (idle + talk + жесты, риг лица с морганием).
 *
 * ВАЖНО: Rive работает только в dev-build, в Expo Go его нет — там автоматически
 * сработает фоллбэк (Lottie/векторный риг).
 *
 * Локальная копия лежит в assets/rive/tearz.riv (на будущее — если решим
 * бандлить вместо загрузки по URL).
 */
/** Локальный пропатченный .riv (фон убран). Бандлится через Metro (assetExts 'riv'). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const RIVE_MODULE = require('../../assets/rive/tearz.riv');

/** Удалённый источник (необязательно). Если задан — приоритетнее локального. */
export const RIVE_URL: string | null = null;

/** undefined → дефолтный (главный) артборд «Main». */
export const RIVE_ARTBOARD: string | undefined = undefined;
export const RIVE_STATE_MACHINE = 'State Machine 1';

/**
 * Триггеры стейт-машины артборда «Main» (узнаны из файла):
 * - `talk` — персонаж «говорит»/оживляется (реакция на ввод, приветствие);
 * - `idle` — возврат в спокойное состояние.
 * Доступные анимации: «idle face», «talk face», «hello hand», «idle body».
 */
export const RIVE_TRIGGER_TALK = 'talk';
export const RIVE_TRIGGER_IDLE = 'idle';
