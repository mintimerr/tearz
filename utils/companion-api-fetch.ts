import {
  companionApiRequestHeaders,
  getCompanionChatApiBaseUrl,
  SERVER_UNREACHABLE_HINT,
} from '@/utils/companion-api-config';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** После успешного warm не дёргаем /health перед каждым POST. */
const WARM_TTL_MS = 8 * 60 * 1000;
let lastWarmAt = 0;

export async function pingCompanionApiHealth(timeoutMs = 60_000): Promise<boolean> {
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
export async function warmCompanionApi(maxAttempts = 6): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i += 1) {
    if (await pingCompanionApiHealth(60_000 + i * 5_000)) {
      lastWarmAt = Date.now();
      return true;
    }
    await sleep(2000 + i * 1500);
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
    if (attempt === 0 && Date.now() - lastWarmAt > WARM_TTL_MS) {
      await warmCompanionApi(6);
    } else if (attempt > 0) {
      await warmCompanionApi(5);
      await sleep(1200 * attempt);
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
