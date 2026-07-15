#!/usr/bin/env node
/**
 * Автоматизация TestFlight: ngrok → API URL → EAS build → submit.
 *
 * Требуется один раз:
 *   npx eas login          (откроется браузер)
 *   Apple Developer ($99)  (EAS спросит при первой сборке)
 *
 * Запуск:
 *   npm run release:testflight
 *
 * Неинтерактивно (CI):
 *   EXPO_TOKEN=... npm run release:testflight
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API_URL_FILE = path.join(ROOT, 'scripts', '.api-url');
const EAS_BIN = path.join(ROOT, 'node_modules', '.bin', 'eas');

function run(cmd, args, opts = {}) {
  console.log(`\n→ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: ROOT,
    env: { EAS_NO_VCS: '1', ...process.env, ...opts.env },
    ...opts,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function ensureServer() {
  try {
    const res = await fetch('http://127.0.0.1:8787/health');
    if (res.ok) {
      console.log('✓ Backend на :8787');
      return;
    }
  } catch {
    /* start below */
  }
  console.log('Запускаю backend…');
  const child = spawn('npm', ['run', 'server'], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:8787/health');
      if (res.ok) {
        console.log('✓ Backend запущен');
        return;
      }
    } catch {
      /* retry */
    }
  }
  console.error('Не удалось запустить backend на :8787');
  process.exit(1);
}

async function resolveApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_COMPANION_CHAT_API_URL?.trim();
  if (fromEnv && !fromEnv.includes('localhost') && !fromEnv.includes('127.0.0.1') && !fromEnv.includes('192.168.')) {
    console.log(`✓ API URL из env: ${fromEnv}`);
    return fromEnv.replace(/\/$/, '');
  }

  if (fs.existsSync(API_URL_FILE)) {
    const cached = fs.readFileSync(API_URL_FILE, 'utf8').trim();
    if (cached.startsWith('https://')) {
      try {
        const res = await fetch(`${cached}/health`, {
          headers: { 'ngrok-skip-browser-warning': '1' },
        });
        if (res.ok) {
          console.log(`✓ API URL из кэша: ${cached}`);
          return cached;
        }
      } catch {
        /* fall through */
      }
    }
  }

  let tunnels;
  try {
    tunnels = await getJson('http://127.0.0.1:4040/api/tunnels');
  } catch {
    console.log('Запускаю ngrok…');
    spawn('ngrok', ['http', '8787'], { detached: true, stdio: 'ignore' }).unref();
    await new Promise((r) => setTimeout(r, 3000));
    tunnels = await getJson('http://127.0.0.1:4040/api/tunnels');
  }

  const t = (tunnels.tunnels || []).find((x) => x.public_url?.startsWith('https://'));
  if (!t?.public_url) {
    console.error('ngrok не вернул HTTPS URL. Установите: brew install ngrok');
    process.exit(1);
  }
  const url = t.public_url.replace(/\/$/, '');
  fs.mkdirSync(path.dirname(API_URL_FILE), { recursive: true });
  fs.writeFileSync(API_URL_FILE, url);
  console.log(`✓ Публичный API: ${url}`);
  return url;
}

async function ensureEasAuth() {
  const check = spawnSync(EAS_BIN, ['whoami'], { cwd: ROOT, encoding: 'utf8' });
  if (check.status === 0 && check.stdout?.trim()) {
    console.log(`✓ Expo: ${check.stdout.trim()}`);
    return;
  }
  if (process.env.EXPO_TOKEN) {
    console.log('✓ EXPO_TOKEN задан');
    return;
  }
  console.log('\nНужен вход в Expo (откроется браузер, один раз)…');
  run(EAS_BIN, ['login']);
}

async function ensureEasProject() {
  const check = spawnSync(EAS_BIN, ['project:info'], { cwd: ROOT, encoding: 'utf8' });
  if (check.status === 0) return;
  console.log('Привязываю проект к Expo…');
  run(EAS_BIN, ['init', '--non-interactive', '--force']);
}

async function setEasEnv(apiUrl) {
  for (const env of ['production', 'preview']) {
    run(EAS_BIN, [
      'env:create',
      env,
      '--name',
      'EXPO_PUBLIC_COMPANION_CHAT_API_URL',
      '--value',
      apiUrl,
      '--visibility',
      'plaintext',
      '--force',
      '--non-interactive',
    ]);
  }
}

async function main() {
  const skipBuild = process.argv.includes('--no-build');
  const skipSubmit = process.argv.includes('--no-submit');

  console.log('=== Tearz → TestFlight ===\n');
  await ensureServer();
  const apiUrl = await resolveApiUrl();

  const health = await fetch(`${apiUrl}/health`, {
    headers: { 'ngrok-skip-browser-warning': '1' },
  });
  if (!health.ok) {
    console.error('API /health не отвечает через публичный URL');
    process.exit(1);
  }
  console.log('✓ /health OK через HTTPS');

  await ensureEasAuth();
  await ensureEasProject();
  await setEasEnv(apiUrl);

  if (skipBuild) {
    console.log('\nГотово (--no-build). API URL записан в EAS secret.');
    return;
  }

  console.log('\nСборка iOS (EAS cloud, ~15–25 мин)…');
  run(EAS_BIN, ['build', '--platform', 'ios', '--profile', 'testflight', '--non-interactive'], {
    env: { EAS_NO_VCS: '1' },
  });

  if (skipSubmit) {
    console.log('\nСборка завершена (--no-submit).');
    return;
  }

  console.log('\nОтправка в TestFlight…');
  run(EAS_BIN, ['submit', '--platform', 'ios', '--latest', '--non-interactive']);

  console.log('\n✓ Готово! Открой App Store Connect → TestFlight.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
