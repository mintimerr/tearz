import {
  companionApiRequestHeaders,
  getCompanionChatApiBaseUrl,
  SERVER_UNREACHABLE_HINT,
} from '@/utils/companion-api-config';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** После успешного запроса не дёргаем /health перед каждым POST. */
const WARM_TTL_MS = 7 * 60 * 1000;
/** Render free cold start часто 30–60+ с — короткий ping всегда «ложный отказ». */
const DEFAULT_WARM_PING_CAP_MS = 45_000;
/** Сколько ждать warm перед первым POST (раньше 2.5 с — слишком рано для cold start). */
const FIRST_WARM_WAIT_MS = 25_000;
/** Потолок одного POST (teacher-chat = intent + ответ модели). */
const MAX_ATTEMPT_TIMEOUT_MS = 180_000;

let lastWarmAt = 0;
let warmInFlight: Promise<boolean> | null = null;

export function touchCompanionApiWarm(): void {
  lastWarmAt = Date.now();
}

/** Сбросить warm-кэш после таймаута/обрыва — иначе ретраи пропускают /health. */
export function invalidateCompanionApiWarm(): void {
  lastWarmAt = 0;
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

type WarmOptions = {
  /** Cap each /health attempt (dead TLS used to hang forever). */
  pingTimeoutMs?: number;
  /** Игнорировать WARM_TTL и реально пинговать (после сетевого сбоя). */
  force?: boolean;
};

/** Разбудить Render (free tier засыпает ~15 мин). Не бросает — возвращает false. */
export async function warmCompanionApi(
  maxAttempts = 6,
  options: WarmOptions = {},
): Promise<boolean> {
  if (!options.force && Date.now() - lastWarmAt < WARM_TTL_MS) return true;

  if (warmInFlight) return warmInFlight;

  const pingCap = options.pingTimeoutMs ?? DEFAULT_WARM_PING_CAP_MS;

  warmInFlight = (async () => {
    for (let i = 0; i < maxAttempts; i += 1) {
      // Cold start: first pings need room to wait for the dyno, not fail at 6–12s.
      const timeout = Math.min(12_000 + i * 8_000, pingCap);
      if (await pingCompanionApiHealth(timeout)) {
        return true;
      }
      await sleep(600 + i * 700);
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
  signal?: AbortSignal;
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
    if (options.signal?.aborted) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    }
    const warmStale = Date.now() - lastWarmAt > WARM_TTL_MS;
    if (!skipWarm && (warmStale || attempt > 0)) {
      if (attempt === 0) {
        // Даём cold start время подняться, но не блокируем UI на весь warm-цикл.
        await Promise.race([
          warmCompanionApi(6, { force: warmStale }),
          sleep(FIRST_WARM_WAIT_MS),
        ]);
      } else {
        await warmCompanionApi(4, { force: true });
        await sleep(800 + attempt * 900);
      }
    } else if (attempt > 0) {
      await sleep(700 * attempt);
    }

    const attemptTimeout = Math.min(timeoutMs + attempt * 20_000, MAX_ATTEMPT_TIMEOUT_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), attemptTimeout);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onExternalAbort, { once: true });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: companionApiRequestHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onExternalAbort);
      touchCompanionApiWarm();
      return res;
    } catch (e) {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onExternalAbort);
      lastErr = e;
      // Таймаут/обрыв: не считаем API «тёплым» — следующий attempt разбудит Render.
      invalidateCompanionApiWarm();
      if (options.signal?.aborted) throw e;
    }
  }

  const timedOut = lastErr instanceof Error && lastErr.name === 'AbortError';
  const detail = timedOut ? ' Сервер не ответил вовремя.' : '';
  throw new Error(`Не удалось подключиться к серверу.${detail} ${SERVER_UNREACHABLE_HINT}`);
}
