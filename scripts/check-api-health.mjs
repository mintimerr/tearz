#!/usr/bin/env node
/**
 * Проверка прод-API перед сборкой / сабмитом.
 * Render free tier: cold start до ~90 с — несколько попыток с паузой.
 *
 *   EXPO_PUBLIC_COMPANION_CHAT_API_URL=https://… npm run check:api
 *   npm run check:api -- https://tearz-chat-api.onrender.com
 */

const argUrl = process.argv[2]?.trim();
const envUrl = process.env.EXPO_PUBLIC_COMPANION_CHAT_API_URL?.trim();
const base = (argUrl || envUrl || '').replace(/\/$/, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!base) {
  console.error(
    'Задайте URL: EXPO_PUBLIC_COMPANION_CHAT_API_URL=https://… npm run check:api\n' +
      'или: npm run check:api -- https://your-api.example.com',
  );
  process.exit(1);
}

if (!/^https:\/\//i.test(base)) {
  console.error(`Публичный релиз требует HTTPS. Сейчас: ${base}`);
  process.exit(1);
}

if (/ngrok/i.test(base)) {
  console.error('ngrok не подходит для публичного релиза. Задеплойте Render/Railway/VPS.');
  process.exit(1);
}

const healthUrl = `${base}/health`;
const MAX_ATTEMPTS = 8;

for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
  const timeoutMs = Math.min(25_000 + attempt * 15_000, 90_000);
  try {
    const res = await fetch(healthUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    if (res.ok) {
      console.log(
        `OK ${healthUrl}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`,
        typeof body === 'object' ? body : String(body).slice(0, 120),
      );
      process.exit(0);
    }

    console.warn(`attempt ${attempt + 1}/${MAX_ATTEMPTS}: HTTP ${res.status}`, body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`attempt ${attempt + 1}/${MAX_ATTEMPTS}: ${msg}`);
  }

  if (attempt < MAX_ATTEMPTS - 1) {
    const delay = 12_000 + attempt * 4_000;
    console.log(`waiting ${Math.round(delay / 1000)}s (cold start)…`);
    await sleep(delay);
  }
}

console.error(`FAIL ${healthUrl}: no response after ${MAX_ATTEMPTS} attempts`);
process.exit(1);
