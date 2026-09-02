/** Человекочитаемая ошибка вместо сырого HTML от прокси/Express. */
export function parseCompanionApiJson(raw: string, status: number): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    if (/cannot\s+(GET|POST|PUT|PATCH|DELETE)\s+\//i.test(trimmed)) {
      throw new Error('Сервер обновляется — подожди минуту и нажми «Повторить».');
    }
    if (/<!doctype html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
      if (status === 404) {
        throw new Error('Эта функция ещё не доступна на сервере. Попробуй через минуту.');
      }
      if (status >= 500) {
        throw new Error('Сервер временно недоступен. Попробуй ещё раз.');
      }
      throw new Error('Не удалось связаться с сервером. Проверь интернет и попробуй снова.');
    }
    throw new Error(trimmed.slice(0, 120) || `HTTP ${status}`);
  }
}

export function companionApiErrorFromJson(json: unknown, status: number): string {
  const err = json as { error?: unknown; message?: unknown };
  if (typeof err.error === 'string' && err.error.trim()) return err.error.trim();
  if (typeof err.message === 'string' && err.message.trim()) return err.message.trim();
  return `Ошибка сервера (${status})`;
}
