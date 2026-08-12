#!/usr/bin/env node
/**
 * Сборка веб-демо → server/public/app (раздаётся с Render API по той же ссылке).
 *
 *   npm run build:web
 *
 * API URL: EXPO_PUBLIC_COMPANION_CHAT_API_URL или same-origin на проде.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'server/public/app');
const apiUrl =
  process.env.EXPO_PUBLIC_COMPANION_CHAT_API_URL?.trim() ||
  'https://tearz-chat-api.onrender.com';

mkdirSync(dirname(outDir), { recursive: true });
if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

console.log(`[web] export → ${outDir}`);
console.log(`[web] API ${apiUrl}`);

const r = spawnSync(
  'npx',
  ['expo', 'export', '--platform', 'web', '--output-dir', outDir],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PUBLIC_COMPANION_CHAT_API_URL: apiUrl,
      EXPO_PUBLIC_PRIVACY_URL: `${apiUrl}/privacy`,
      EXPO_PUBLIC_TERMS_URL: `${apiUrl}/terms`,
    },
    shell: process.platform === 'win32',
  },
);

if (r.status !== 0) {
  process.exit(r.status || 1);
}

writeFileSync(
  join(outDir, '.web-build.json'),
  JSON.stringify({ builtAt: new Date().toISOString(), apiUrl }, null, 2),
);

console.log(`[web] ready: open ${apiUrl}/ after deploy`);
console.log('[web] local: npm run server  →  http://localhost:8787/');
