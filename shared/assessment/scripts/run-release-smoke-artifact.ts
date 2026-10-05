/**
 * Release smoke artifact — sample extreme CEFR×skill items for visual review.
 * Does NOT generate new items.
 *
 *   npx tsx scripts/run-release-smoke-artifact.ts
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBank } from '../src/banks/loader.js';
import { BANK_LANGUAGES, type BankLanguage } from '../src/banks/types.js';
import type { CefrLevel } from '../src/types.js';

const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SKILLS = ['grammar', 'vocabulary', 'reading', 'functional'] as const;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function pickExtreme(
  items: ReturnType<typeof loadBank>['items'],
  level: CefrLevel,
  skill: string,
  high: boolean,
) {
  const pool = items
    .filter((i) => i.targetLevel === level && i.skill === skill)
    .sort((a, b) => a.difficultyWithinLevel - b.difficultyWithinLevel);
  if (!pool.length) return null;
  return high ? pool[pool.length - 1]! : pool[0]!;
}

function main() {
  const artifact: Record<string, unknown> = {
    purpose: 'visual smoke of extreme CEFR×skill items — no generation',
    generatedAt: new Date().toISOString(),
    languages: {} as Record<string, unknown>,
  };

  for (const lang of BANK_LANGUAGES as BankLanguage[]) {
    const { items } = loadBank(lang, 'v1');
    const samples: Array<Record<string, unknown>> = [];
    for (const level of LEVELS) {
      for (const skill of SKILLS) {
        const low = pickExtreme(items, level, skill, false);
        const high = pickExtreme(items, level, skill, true);
        if (low) {
          samples.push({
            tag: `${level}-low-${skill}`,
            id: low.id,
            stem: low.stem.slice(0, 220),
            choices: low.choices,
            correctChoice: low.correctChoice,
          });
        }
        if (high && high.id !== low?.id && (level === 'A1' || level === 'C2')) {
          samples.push({
            tag: `${level}-high-${skill}`,
            id: high.id,
            stem: high.stem.slice(0, 220),
            choices: high.choices,
            correctChoice: high.correctChoice,
          });
        }
      }
    }
    (artifact.languages as Record<string, unknown>)[lang] = {
      itemCount: items.length,
      sampleCount: samples.length,
      samples,
    };
  }

  const out = join(root, 'banks', 'release-smoke-artifact.json');
  writeFileSync(out, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Wrote ${out}`);
}

main();
