/** Публичный URL бэкенда Tearz (без trailing slash). Задаётся через EXPO_PUBLIC_COMPANION_CHAT_API_URL. */
const PRODUCTION_API_FALLBACK = 'https://tearz-chat-api.onrender.com';

export function getCompanionChatApiBaseUrl(): string {
  const u = process.env.EXPO_PUBLIC_COMPANION_CHAT_API_URL?.trim();
  if (u) return u.replace(/\/$/, '');

  // Web-демо на том же хосте, что и API (Render)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  if (!__DEV__) {
    return PRODUCTION_API_FALLBACK;
  }

  throw new Error(
    'Не задан EXPO_PUBLIC_COMPANION_CHAT_API_URL. Добавьте в .env адрес server (см. docs/PUBLIC_RELEASE.md).',
  );
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
