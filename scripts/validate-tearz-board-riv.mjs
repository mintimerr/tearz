#!/usr/bin/env node
/**
 * Проверяет tearz-board.riv: имена state machine, triggers, inputs.
 * Запуск: node scripts/validate-tearz-board-riv.mjs [path/to/file.riv]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const EXPECT_SM = 'BoardMachine';
const EXPECT_TRIGGERS_ALL = ['stroke', 'erase', 'look', 'focus', 'idle'];
const EXPECT_TRIGGERS_PHASE1 = ['stroke', 'idle'];
const EXPECT_INPUTS = ['gazeX', 'gazeY'];

const phase = (process.argv.includes('--phase=1') && 1)
  || (process.argv.includes('--phase=2') && 2)
  || 3;

const EXPECT_TRIGGERS =
  phase === 1 ? EXPECT_TRIGGERS_PHASE1
  : phase === 2 ? ['stroke', 'erase', 'look', 'focus', 'idle']
  : EXPECT_TRIGGERS_ALL;

const RIV =
  process.argv.find((a) => a.endsWith('.riv')) ?? path.join(ROOT, 'assets/rive/tearz-board.riv');

if (!fs.existsSync(RIV)) {
  console.error('Нет файла:', RIV);
  process.exit(1);
}

const buf = fs.readFileSync(RIV);
const text = buf.toString('latin1');

function findAll(needle) {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  return (text.match(re) ?? []).length;
}

console.log('Файл:', RIV);
console.log('Фаза:', phase, phase === 1 ? '(Day 1 MVP)' : phase === 2 ? '(Day 2)' : '(Day 3 full)');
console.log('Размер:', (buf.length / 1024).toFixed(1), 'KB\n');

const hasBoardMachine = text.includes(EXPECT_SM);
const legacySM = text.includes('State Machine 1');

console.log(hasBoardMachine ? '✓' : '✗', `State machine «${EXPECT_SM}»`);
if (!hasBoardMachine && legacySM) {
  console.log('  ⚠ Сейчас заглушка «State Machine 1» — см. scripts/rive-board-workshop.md');
}

console.log('\nТриггеры:');
for (const t of EXPECT_TRIGGERS) {
  const n = findAll(t);
  console.log(n > 0 ? '✓' : '✗', t, n > 0 ? '' : '(не найден в .riv)');
}

console.log('\nNumber inputs:');
const expectInputs = phase >= 3 ? EXPECT_INPUTS : [];
if (expectInputs.length === 0) {
  console.log('— (фаза', phase, '— gaze не требуется)');
} else {
  for (const i of expectInputs) {
    const n = findAll(i);
    console.log(n > 0 ? '✓' : '✗', i, n > 0 ? '' : '(не найден — gaze будет только в коде)');
  }
}

const ok =
  hasBoardMachine &&
  EXPECT_TRIGGERS.every((t) => text.includes(t)) &&
  (phase < 3 || EXPECT_INPUTS.every((i) => text.includes(i)));

const doneMsg = ok
  ? phase === 1
    ? '\n✅ Day 1 готов → положи tearz-board.riv, RIVE_BOARD_LEGACY_BOOTSTRAP = false'
    : '\n✅ Готов к продакшену → RIVE_BOARD_LEGACY_BOOTSTRAP = false'
  : '\n⏳ Ещё не готов — доделай в Rive Editor (scripts/rive-board-self-build.md)';

console.log(doneMsg);

process.exit(ok ? 0 : 1);
