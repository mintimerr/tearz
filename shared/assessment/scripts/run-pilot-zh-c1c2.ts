/**
 * Phase B.3 — Chinese C1/C2 high-level validation micro-pilot.
 * Does NOT weaken quality gates. Does NOT run Phase C.
 */

import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { factoryConstructsFor } from '../src/banks/factory/constructs.js';
import { ZH_HIGH_POOLS } from '../src/banks/factory/pools-zh-high.js';
import type { PoolItem } from '../src/banks/factory/pools-en.js';
import { exportApprovedBank } from '../src/banks/factory/export-bank.js';
import { loadBank } from '../src/banks/loader.js';
import type { BankItemRecord } from '../src/banks/types.js';
import { runItemQualityPipeline } from '../src/items/pipeline.js';
import { generationPromptVersionForLanguage } from '../src/items/prompt-versions.js';
import type { GeneratedItem, ItemSpecification } from '../src/items/types.js';
import type { AssessmentSkill, CefrLevel } from '../src/types.js';
import { cefrRank } from '../src/scale.js';
import { discourseUnits } from '../src/items/deterministic/normalize.js';
import type { ConstructEntry } from '../src/languages/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const banksRoot = join(root, 'banks');
const reportPath = join(banksRoot, 'pilot-zh-c1c2-report.json');
const humanJson = join(banksRoot, 'pilot-zh-c1c2-human-review.json');
const humanMd = join(banksRoot, 'pilot-zh-c1c2-human-review.md');
const outDir = join(banksRoot, 'zh-c1c2-micro');

const SKILLS: AssessmentSkill[] = ['grammar', 'vocabulary', 'reading', 'functional'];
const LEVELS: Array<'C1' | 'C2'> = ['C1', 'C2'];

function pickConstruct(skill: AssessmentSkill, level: CefrLevel, index: number): ConstructEntry {
  const constructs = factoryConstructsFor('zh');
  const rank = cefrRank(level);
  const matching = constructs.filter(
    (c) =>
      c.skill === skill &&
      cefrRank(c.minLevel) <= rank &&
      cefrRank(c.maxLevel) >= rank,
  );
  if (!matching.length) throw new Error(`No ZH construct for ${skill}@${level}`);
  matching.sort(
    (a, b) => Math.abs(cefrRank(a.typicalLevel) - rank) - Math.abs(cefrRank(b.typicalLevel) - rank),
  );
  return matching[index % matching.length]!;
}

function toGenerated(
  skill: AssessmentSkill,
  level: 'C1' | 'C2',
  tpl: PoolItem,
  index: number,
): GeneratedItem {
  const construct = pickConstruct(skill, level, index);
  const itemType =
    skill === 'reading'
      ? 'readingComprehension'
      : skill === 'vocabulary'
        ? 'vocabularyChoice'
        : skill === 'functional'
          ? 'functionalPhrase'
          : 'grammarForm';
  const spec: ItemSpecification = {
    id: `zh-high.${skill}.${level}.${index}`,
    language: 'zh',
    skill,
    construct: construct.id,
    itemType,
    responseFormat: 'singleChoice',
    optionCount: 4,
    targetLevel: level,
    difficultyWithinLevel: 0.25 + (index % 3) * 0.25,
    predictedDifficulty: level === 'C1' ? 1.6 : 2.2,
    predictedDiscrimination: 1.2,
    constraints: {
      mustBeUnambiguous: true,
      requireSingleUnequivocalKey: true,
      forbidTrickQuestions: true,
      forbidCulturalBias: true,
      forbidAnswerLeakInExplanation: true,
    },
    status: 'draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const options = tpl.options.map((text, i) => ({
    id: String.fromCharCode(65 + i),
    text,
    isCorrect: i === tpl.correctIndex,
  }));
  const h = createHash('sha256')
    .update(`${tpl.conceptKey}|${skill}|${level}|v-b3`)
    .digest('hex')
    .slice(0, 16);
  return {
    id: `bank.zh.${skill}.${level}.high.${index}.${h}`,
    specificationId: spec.id!,
    language: 'zh',
    stem: tpl.stem,
    prompt: tpl.prompt,
    options,
    correctAnswer: options[tpl.correctIndex]!.text,
    explanation: tpl.explanation,
    generationModel: 'tearz-offline-template-v3-zh-high',
    generationPromptVersion: generationPromptVersionForLanguage('zh'),
    generatedAt: Date.now(),
    calibrationStatus: 'provisional',
    specification: spec,
  };
}

function toBankRecord(item: GeneratedItem, reportGate: string): BankItemRecord {
  return {
    id: item.id,
    language: 'zh',
    skill: item.specification.skill,
    construct: item.specification.construct,
    itemType: item.specification.itemType,
    responseFormat: item.specification.responseFormat,
    optionCount: 4,
    targetLevel: item.specification.targetLevel,
    difficultyWithinLevel: item.specification.difficultyWithinLevel,
    predictedDifficulty: item.specification.predictedDifficulty,
    predictedDiscrimination: item.specification.predictedDiscrimination,
    calibrationStatus: 'provisional',
    lifecycleState: 'approved_provisional',
    qualityGate: 'PASS',
    stem: item.stem,
    prompt: item.prompt,
    instruction: item.prompt,
    choices: item.options.map((o) => o.text),
    correctChoice: item.correctAnswer,
    explanation: item.explanation,
    generationModel: item.generationModel,
    generationPromptVersion: item.generationPromptVersion,
    itemQualityVersion: 'item-quality-gate-v3-zh-b3',
    createdAt: item.generatedAt,
    slotKey: `zh.${item.specification.skill}.${item.specification.targetLevel}.high`,
    note:
      reportGate === 'PASS'
        ? 'predicted* are engineering priors until empirical calibration'
        : undefined,
  };
}

function main() {
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const attempts: Array<{
    level: string;
    skill: string;
    conceptKey: string;
    gate: string;
    reasons: string[];
    stemUnits: number;
  }> = [];
  const approved: BankItemRecord[] = [];
  const humanRows: unknown[] = [];

  const rejectCounts: Record<string, number> = {};
  const byLevelSkill: Record<string, { gen: number; pass: number; revise: number; reject: number }> =
    {};

  for (const level of LEVELS) {
    for (const skill of SKILLS) {
      const key = `${level}:${skill}`;
      byLevelSkill[key] = { gen: 0, pass: 0, revise: 0, reject: 0 };
      const pool = ZH_HIGH_POOLS[skill][level] ?? [];
      pool.forEach((tpl, index) => {
        const item = toGenerated(skill, level, tpl, index);
        byLevelSkill[key]!.gen += 1;
        const { report, eligibility } = runItemQualityPipeline(item);
        const reasons = [
          ...report.criticalIssues.map((i) => `crit:${i.code}`),
          ...report.warnings.map((i) => `warn:${i.code}`),
        ];
        attempts.push({
          level,
          skill,
          conceptKey: tpl.conceptKey,
          gate: report.qualityGate,
          reasons,
          stemUnits: discourseUnits(item.stem, 'zh'),
        });
        if (report.qualityGate === 'PASS') byLevelSkill[key]!.pass += 1;
        else if (report.qualityGate === 'REVISE') byLevelSkill[key]!.revise += 1;
        else byLevelSkill[key]!.reject += 1;

        for (const r of reasons) {
          const code = r.replace(/^(crit|warn):/, '');
          rejectCounts[code] = (rejectCounts[code] ?? 0) + (report.qualityGate === 'PASS' ? 0 : 1);
        }

        if (report.qualityGate === 'PASS' && eligibility.eligible) {
          const rec = toBankRecord(item, report.qualityGate);
          approved.push(rec);
          humanRows.push({
            language: 'zh',
            level,
            skill,
            construct: item.specification.construct,
            conceptKey: tpl.conceptKey,
            stem: item.stem,
            prompt: item.prompt,
            choices: item.options.map((o) => o.text),
            correctAnswer: item.correctAnswer,
            explanation: item.explanation,
            difficultyWithinLevel: item.specification.difficultyWithinLevel,
            predictedDifficulty: item.specification.predictedDifficulty,
            predictedDiscrimination: item.specification.predictedDiscrimination,
            note: 'predicted* are priors only — not calibrated',
            stemDiscourseUnits: discourseUnits(item.stem, 'zh'),
            qualityGate: report.qualityGate,
            criticalIssues: report.criticalIssues,
            warnings: report.warnings,
            eligibility,
            id: item.id,
          });
        }
      });
    }
  }

  // Merge into v1/zh bank: keep non-C1/C2, replace C1/C2 with micro-pilot PASS
  let kept: BankItemRecord[] = [];
  try {
    const existing = loadBank('zh');
    kept = existing.items.filter((i) => i.targetLevel !== 'C1' && i.targetLevel !== 'C2');
  } catch {
    kept = [];
  }
  const merged = [...kept, ...approved];
  exportApprovedBank({ language: 'zh', items: merged });

  writeFileSync(humanJson, `${JSON.stringify(humanRows, null, 2)}\n`);
  const c1 = approved.filter((a) => a.targetLevel === 'C1');
  const c2 = approved.filter((a) => a.targetLevel === 'C2');
  writeFileSync(
    humanMd,
    [
      '# Chinese C1/C2 micro-pilot (Phase B.3) human review',
      '',
      `C1 PASS: ${c1.length}`,
      `C2 PASS: ${c2.length}`,
      `Total: ${approved.length}`,
      '',
      ...humanRows.flatMap((r: any) => [
        `## ${r.level} / ${r.skill} / ${r.construct}`,
        '',
        `**Stem:** ${r.stem}`,
        '',
        `**Choices:**`,
        ...r.choices.map((c: string, i: number) => `- ${i === r.choices.indexOf(r.correctAnswer) ? '✓ ' : ''}${c}`),
        '',
        `**Answer:** ${r.correctAnswer}`,
        '',
        `**Explanation:** ${r.explanation}`,
        '',
        `**Units:** ${r.stemDiscourseUnits} · **diffWithin:** ${r.difficultyWithinLevel}`,
        '',
        '---',
        '',
      ]),
    ].join('\n'),
  );

  const report = {
    phase: 'B.3-zh-c1c2-micro',
    generated: attempts.length,
    approvedPass: approved.length,
    c1Pass: c1.length,
    c2Pass: c2.length,
    byLevelSkill,
    rejectCodeCounts: rejectCounts,
    rejectedOrRevised: attempts.filter((a) => a.gate !== 'PASS'),
    gateWeakened: false,
    acceptance: {
      targetC1: 12,
      targetC2: 12,
      minAcceptableC1: 8,
      minAcceptableC2: 8,
      c1Ok: c1.length >= 8,
      c2Ok: c2.length >= 8,
    },
    note: 'Quality > coverage. discourseUnits fixes CJK length bias; thresholds not lowered for English.',
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outDir, 'items.json'), `${JSON.stringify(approved, null, 2)}\n`);

  console.log(
    `B.3 ZH C1/C2 micro-pilot: generated=${attempts.length} C1_PASS=${c1.length} C2_PASS=${c2.length}`,
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Human review: ${humanMd}`);
  if (c1.length < 8 || c2.length < 8) {
    console.log('WARNING: below soft acceptance floor (8/8); inspect rejects — gate not weakened.');
  }
}

main();
