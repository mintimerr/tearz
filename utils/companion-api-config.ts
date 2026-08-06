/** Публичный URL бэкенда Tearz (без trailing slash). Задаётся через EXPO_PUBLIC_COMPANION_CHAT_API_URL. */
export function getCompanionChatApiBaseUrl(): string {
  const u = process.env.EXPO_PUBLIC_COMPANION_CHAT_API_URL?.trim();
  if (!u) {
    throw new Error(
      __DEV__
        ? 'Не задан EXPO_PUBLIC_COMPANION_CHAT_API_URL. Добавьте в .env адрес server (см. docs/PUBLIC_RELEASE.md).'
        : 'Сервер недоступен: приложение собрано без адреса API. Обновите сборку.',
    );
  }
  return u.replace(/\/$/, '');
}

/** Заголовки для fetch к API (ngrok free tier требует skip-browser-warning). */
export function companionApiRequestHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extra,
  };
  try {
    const base = process.env.EXPO_PUBLIC_COMPANION_CHAT_API_URL ?? '';
    if (/ngrok/i.test(base)) {
      headers['ngrok-skip-browser-warning'] = '1';
    }
  } catch {
    /* ignore */
  }
  return headers;
}

export const COMPANION_API_URL_MISSING = 'EXPO_PUBLIC_COMPANION_CHAT_API_URL';

export const SERVER_UNREACHABLE_HINT = __DEV__
  ? 'Запустите backend: npm run server — и проверьте EXPO_PUBLIC_COMPANION_CHAT_API_URL в .env (IP Mac в Wi‑Fi).'
  : 'Проверьте подключение к интернету и попробуйте снова.';
