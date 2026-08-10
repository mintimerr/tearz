#!/usr/bin/env node
/**
 * Create / update tearz-chat-api on Render from render.yaml + server/.env secrets.
 *
 * Prerequisites:
 *   brew install render
 *   render login
 *   (or) export RENDER_API_KEY=rnd_…
 *
 * Usage:
 *   node scripts/deploy-render.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoUrl = 'https://github.com/mintimerr/tearz.git';
const serviceName = 'tearz-chat-api';

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function redact(s) {
  return String(s || '')
    .replace(/sk-[A-Za-z0-9_\-]+/g, 'sk-REDACTED')
    .replace(/re_[A-Za-z0-9_]+/g, 're_REDACTED')
    .replace(/(OPENAI_API_KEY|RESEND_API_KEY|AUTH_FROM_EMAIL)=([^\s]+)/g, '$1=REDACTED');
}

function run(args, { allowFail = false } = {}) {
  const r = spawnSync('render', args, {
    encoding: 'utf8',
    env: process.env,
  });
  if (r.status !== 0 && !allowFail) {
    const safeArgs = args.map((a) =>
      /^(OPENAI_API_KEY|RESEND_API_KEY|AUTH_FROM_EMAIL)=/.test(a)
        ? `${a.split('=')[0]}=REDACTED`
        : a,
    );
    const msg = redact((r.stderr || r.stdout || '').trim() || `exit ${r.status}`);
    throw new Error(`render ${safeArgs.join(' ')} failed:\n${msg}`);
  }
  return r;
}

function parseJson(text) {
  try {
    return JSON.parse(text || 'null');
  } catch {
    return null;
  }
}

const env = loadDotEnv(join(root, 'server/.env'));
for (const key of ['OPENAI_API_KEY', 'RESEND_API_KEY', 'AUTH_FROM_EMAIL']) {
  if (!env[key]) {
    console.error(`Missing ${key} in server/.env`);
    process.exit(1);
  }
}

const who = run(['whoami', '-o', 'json']);
const whoJson = parseJson(who.stdout);
console.log(`Render user: ${whoJson?.email || whoJson?.name || 'ok'}`);

const ws = run(['workspaces', '-o', 'json'], { allowFail: true });
const workspaces = parseJson(ws.stdout);
if (Array.isArray(workspaces) && workspaces.length) {
  const id = workspaces[0].id || workspaces[0].workspace?.id;
  const name = workspaces[0].name || workspaces[0].workspace?.name;
  if (id) {
    run(['workspace', 'set', id, '--confirm', '-o', 'text'], { allowFail: true });
    console.log(`Workspace: ${name || id}`);
  }
}

const list = run(['services', '-o', 'json'], { allowFail: true });
const services = parseJson(list.stdout);
const existing = Array.isArray(services)
  ? services.find((s) => {
      const n = s.name || s.service?.name;
      return n === serviceName;
    })
  : null;

let serviceId =
  existing?.id ||
  existing?.service?.id ||
  existing?.service?.serviceDetails?.id;
let serviceUrl =
  existing?.serviceUrl ||
  existing?.service?.serviceDetails?.url ||
  existing?.dashboardUrl;

if (!serviceId) {
  console.log(`Creating ${serviceName}…`);
  const created = run([
    'services',
    'create',
    '--name',
    serviceName,
    '--type',
    'web_service',
    '--repo',
    repoUrl,
    '--branch',
    'main',
    '--runtime',
    'node',
    '--root-directory',
    'server',
    '--build-command',
    'npm install',
    '--start-command',
    'npm start',
    '--health-check-path',
    '/health',
    '--plan',
    'free',
    '--region',
    'oregon',
    '--env-var',
    'NODE_ENV=production',
    '--env-var',
    `OPENAI_API_KEY=${env.OPENAI_API_KEY}`,
    '--env-var',
    `RESEND_API_KEY=${env.RESEND_API_KEY}`,
    '--env-var',
    `AUTH_FROM_EMAIL=${env.AUTH_FROM_EMAIL}`,
    '--env-var',
    'TEACHER_MODEL=gpt-4.1',
    '--env-var',
    'TEACHER_FAST_MODEL=gpt-4.1-mini',
    '--env-var',
    'COMPANION_MODEL=gpt-4.1',
    '--auto-deploy',
    '--confirm',
    '-o',
    'json',
  ]);
  const body = parseJson(created.stdout);
  serviceId = body?.service?.id || body?.id;
  serviceUrl =
    body?.service?.serviceDetails?.url ||
    body?.serviceUrl ||
    (serviceId ? `https://${serviceName}.onrender.com` : null);
  console.log('Created:', serviceId || created.stdout.slice(0, 400));
} else {
  console.log(`Service exists: ${serviceId}`);
  // Refresh secrets / models
  run(
    [
      'services',
      'update',
      serviceId,
      '--env-var',
      `OPENAI_API_KEY=${env.OPENAI_API_KEY}`,
      '--env-var',
      `RESEND_API_KEY=${env.RESEND_API_KEY}`,
      '--env-var',
      `AUTH_FROM_EMAIL=${env.AUTH_FROM_EMAIL}`,
      '--confirm',
      '-o',
      'text',
    ],
    { allowFail: true },
  );
  run(
    ['deploys', 'create', serviceId, '--wait', '--confirm', '-o', 'text'],
    { allowFail: true },
  );
}

if (!serviceUrl && serviceId) {
  serviceUrl = `https://${serviceName}.onrender.com`;
}

const healthBase = (serviceUrl || '').replace(/\/$/, '');
console.log(`URL: ${healthBase}`);
console.log('Waiting for /health…');

let ok = false;
for (let i = 0; i < 36; i++) {
  try {
    const res = await fetch(`${healthBase}/health`, {
      headers: { 'ngrok-skip-browser-warning': '1' },
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    if (res.ok && /"ok"\s*:\s*true/.test(text)) {
      console.log('Health OK:', text.trim());
      ok = true;
      break;
    }
    console.log(`attempt ${i + 1}: HTTP ${res.status} ${text.slice(0, 80)}`);
  } catch (e) {
    console.log(`attempt ${i + 1}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 10000));
}

if (!ok) {
  console.error(
    'Health check did not pass yet (free tier cold start can take a few minutes).',
  );
  console.error(`Try: npm run check:api -- ${healthBase}`);
  process.exit(2);
}

console.log('\nNext — set EAS production env:');
console.log(
  `npx eas env:create --name EXPO_PUBLIC_COMPANION_CHAT_API_URL --value ${healthBase} --environment production --force --non-interactive`,
);
console.log(
  `npx eas env:create --name EXPO_PUBLIC_PRIVACY_URL --value ${healthBase}/privacy --environment production --force --non-interactive`,
);
console.log(
  `npx eas env:create --name EXPO_PUBLIC_TERMS_URL --value ${healthBase}/terms --environment production --force --non-interactive`,
);
