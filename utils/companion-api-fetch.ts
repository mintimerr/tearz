import {
  companionApiRequestHeaders,
  getCompanionChatApiBaseUrl,
  SERVER_UNREACHABLE_HINT,
} from '@/utils/companion-api-config';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function pingCompanionApiHealth(timeoutMs = 30_000): Promise<boolean> {
  const base = getCompanionChatApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/health`, {
      headers: companionApiRequestHeaders(),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Разбудить Render перед первым POST (free tier засыпает ~15 мин). */
export async function warmCompanionApi(maxAttempts = 5): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i += 1) {
    if (await pingCompanionApiHealth(35_000)) return true;
    await sleep(1800 + i * 1200);
  }
  return false;
}

type PostJsonOptions = {
  /** Таймаут одной попытки POST. */
  timeoutMs?: number;
  /** Число попыток при сетевой ошибке. */
  retries?: number;
};

export async function postCompanionApiJson(
  path: string,
  body: unknown,
  options: PostJsonOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const retries = Math.max(1, options.retries ?? 3);
  const base = getCompanionChatApiBaseUrl();
  const url = `${base}${path}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (attempt > 0) {
      await warmCompanionApi(4);
      await sleep(900 * attempt);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: companionApiRequestHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
  }

  const timedOut = lastErr instanceof Error && lastErr.name === 'AbortError';
  const detail = timedOut ? ' Сервер не ответил вовремя.' : '';
  throw new Error(`Не удалось подключиться к серверу.${detail} ${SERVER_UNREACHABLE_HINT}`);
}
