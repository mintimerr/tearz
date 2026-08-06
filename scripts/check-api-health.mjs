#!/usr/bin/env node
/**
 * Проверка прод-API перед сборкой / сабмитом.
 *
 *   EXPO_PUBLIC_COMPANION_CHAT_API_URL=https://… npm run check:api
 *   npm run check:api -- https://tearz-chat-api.onrender.com
 */

const argUrl = process.argv[2]?.trim();
const envUrl = process.env.EXPO_PUBLIC_COMPANION_CHAT_API_URL?.trim();
const base = (argUrl || envUrl || '').replace(/\/$/, '');

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

try {
  const res = await fetch(healthUrl, {
    headers: { Accept: 'application/json' },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!res.ok) {
    console.error(`FAIL ${healthUrl} → HTTP ${res.status}`, body);
    process.exit(1);
  }

  console.log(`OK ${healthUrl}`, typeof body === 'object' ? body : String(body).slice(0, 120));
} catch (e) {
  console.error(`FAIL ${healthUrl}:`, e instanceof Error ? e.message : e);
  process.exit(1);
}
