import {
  companionApiRequestHeaders,
  getCompanionChatApiBaseUrl,
  SERVER_UNREACHABLE_HINT,
} from '@/utils/companion-api-config';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** После успешного запроса не дёргаем /health перед каждым POST. */
const WARM_TTL_MS = 7 * 60 * 1000;
let lastWarmAt = 0;
let warmInFlight: Promise<boolean> | null = null;

export function touchCompanionApiWarm(): void {
  lastWarmAt = Date.now();
}

export async function pingCompanionApiHealth(timeoutMs = 20_000): Promise<boolean> {
  const base = getCompanionChatApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/health`, {
      method: 'GET',
      headers: companionApiRequestHeaders(),
      signal: controller.signal,
    });
    if (res.ok) touchCompanionApiWarm();
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Разбудить Render (free tier засыпает ~15 мин). Не бросает — возвращает false. */
export async function warmCompanionApi(maxAttempts = 6): Promise<boolean> {
  if (Date.now() - lastWarmAt < WARM_TTL_MS) return true;

  if (warmInFlight) return warmInFlight;

  warmInFlight = (async () => {
    for (let i = 0; i < maxAttempts; i += 1) {
      const timeout = Math.min(18_000 + i * 12_000, 90_000);
      if (await pingCompanionApiHealth(timeout)) {
        return true;
      }
      await sleep(900 + i * 1_400);
    }
    return false;
  })();

  try {
    return await warmInFlight;
  } finally {
    warmInFlight = null;
  }
}

type PostJsonOptions = {
  timeoutMs?: number;
  retries?: number;
  skipWarm?: boolean;
};

export async function postCompanionApiJson(
  path: string,
  body: unknown,
  options: PostJsonOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const retries = Math.max(1, options.retries ?? 4);
  const skipWarm = options.skipWarm ?? false;
  const base = getCompanionChatApiBaseUrl();
  const url = `${base}${path}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (!skipWarm && Date.now() - lastWarmAt > WARM_TTL_MS) {
      if (attempt === 0) {
        await Promise.race([warmCompanionApi(6), sleep(2_500)]);
      } else {
        await warmCompanionApi(3);
        await sleep(800 + attempt * 900);
      }
    } else if (attempt > 0) {
      await sleep(700 * attempt);
    }

    const attemptTimeout = Math.min(timeoutMs + attempt * 15_000, 120_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), attemptTimeout);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: companionApiRequestHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      touchCompanionApiWarm();
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
