/**
 * Regenerate stratified human-review sample from current banks.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBank } from '../src/banks/loader.js';
import { BANK_LANGUAGES, type BankItemRecord } from '../src/banks/types.js';
import type { AssessmentSkill, CefrLevel } from '../src/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function stratifiedSample(items: BankItemRecord[]): BankItemRecord[] {
  const want: Array<[CefrLevel, number]> = [
    ['A1', 3],
    ['A2', 3],
    ['B1', 3],
    ['B2', 5],
    ['C1', 8],
    ['C2', 8],
  ];
  const out: BankItemRecord[] = [];
  const skills: AssessmentSkill[] = ['grammar', 'vocabulary', 'reading', 'functional'];
  for (const [level, n] of want) {
    const pool = items.filter((i) => i.targetLevel === level);
    let picked = 0;
    for (const sk of skills) {
      if (picked >= n) break;
      const hit = pool.find((i) => i.skill === sk && !out.some((o) => o.id === i.id));
      if (hit) {
        out.push(hit);
        picked += 1;
      }
    }
    for (const it of pool) {
      if (picked >= n) break;
      if (!out.some((o) => o.id === it.id)) {
        out.push(it);
        picked += 1;
      }
    }
  }
  return out;
}

const rows: unknown[] = [];
const md: string[] = [
  '# Production human-review stratified sample (post-prefix-strip)',
  '',
  'Items after technical Case/Cas/Fall/Кейс/案例 prefix removal.',
  '',
];

for (const lang of BANK_LANGUAGES) {
  const sample = stratifiedSample(loadBank(lang).items);
  for (const it of sample) {
    rows.push({
      language: it.language,
      level: it.targetLevel,
      skill: it.skill,
      construct: it.construct,
      itemType: it.itemType,
      stem: it.stem,
      prompt: it.prompt,
      choices: it.choices,
      correctAnswer: it.correctChoice,
      explanation: it.explanation,
      difficultyWithinLevel: it.difficultyWithinLevel,
      predictedDifficulty: it.predictedDifficulty,
      predictedDiscrimination: it.predictedDiscrimination,
      generationPromptVersion: it.generationPromptVersion,
      id: it.id,
      note: 'predicted* are engineering priors — not calibrated',
    });
    md.push(`## ${lang} ${it.targetLevel} ${it.skill}`, '');
    md.push(`Construct: \`${it.construct}\``, '', it.stem, '');
    it.choices.forEach((c, i) => {
      md.push(`${i + 1}. ${c}${c === it.correctChoice ? ' ✓' : ''}`);
    });
    md.push('', `Answer: **${it.correctChoice}** — ${it.explanation}`, '', '---', '');
  }
}

writeFileSync(join(root, 'banks/production-human-review.json'), `${JSON.stringify(rows, null, 2)}\n`);
writeFileSync(join(root, 'banks/production-human-review.md'), `${md.join('\n')}\n`);
console.log('review rows', rows.length);
