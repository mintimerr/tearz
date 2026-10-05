/**
 * Phase B pilot: 2 × 6 CEFR × 4 skills × 5 languages = 240 target slots.
 * Offline only — writes approved banks + pilot-report.json then exits.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPilotBlueprints } from '../src/banks/factory/blueprint.js';
import { runFactoryPipeline } from '../src/banks/factory/pipeline-runner.js';
import { exportApprovedBank } from '../src/banks/factory/export-bank.js';
import { BANK_LANGUAGES, type BankLanguage } from '../src/banks/types.js';
import type { AssessmentSkill, CefrLevel } from '../src/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = join(root, 'banks', 'pilot-report.json');
const checkpointDir = join(root, 'banks', '.factory-checkpoint');

function main() {
  const slots = buildPilotBlueprints([...BANK_LANGUAGES]);
  console.log(`Pilot slots: ${slots.length} (expected 240)`);

  const result = runFactoryPipeline(slots, {
    maxAttemptsPerSlot: 4,
    checkpointDir,
    resume: true,
  });

  const byLang: Record<
    string,
    {
      generated: number;
      PASS: number;
      REVISE: number;
      REJECT: number;
      duplicate: number;
      deterministicReject: number;
      semanticReject: number;
      adversarialReject: number;
      approvedIds: string[];
    }
  > = {};

  for (const lang of BANK_LANGUAGES) {
    byLang[lang] = {
      generated: 0,
      PASS: 0,
      REVISE: 0,
      REJECT: 0,
      duplicate: 0,
      deterministicReject: 0,
      semanticReject: 0,
      adversarialReject: 0,
      approvedIds: [],
    };
  }

  for (const a of result.attempts) {
    const bucket = byLang[a.language]!;
    bucket.generated += 1;
    if (a.gate === 'PASS') bucket.PASS += 1;
    else if (a.gate === 'REVISE') bucket.REVISE += 1;
    else if (a.gate === 'DUPLICATE') bucket.duplicate += 1;
    else bucket.REJECT += 1;
    if (a.reasons.some((r) => r.startsWith('det:'))) bucket.deterministicReject += 1;
    if (a.reasons.some((r) => r.startsWith('sem:'))) bucket.semanticReject += 1;
    if (a.reasons.some((r) => r.startsWith('adv:'))) bucket.adversarialReject += 1;
  }

  for (const lang of BANK_LANGUAGES) {
    const items = result.approved.filter((i) => i.language === lang);
    byLang[lang]!.approvedIds = items.map((i) => i.id);
    exportApprovedBank({ language: lang as BankLanguage, items });
    console.log(`Exported ${lang}: ${items.length} items`);
  }

  const coverage = {
    byCefr: {} as Record<CefrLevel, number>,
    bySkill: {} as Record<AssessmentSkill, number>,
    byConstruct: {} as Record<string, number>,
    byItemType: {} as Record<string, number>,
    difficultyWithin: { low: 0, mid: 0, high: 0 },
  };

  for (const it of result.approved) {
    coverage.byCefr[it.targetLevel] = (coverage.byCefr[it.targetLevel] ?? 0) + 1;
    coverage.bySkill[it.skill] = (coverage.bySkill[it.skill] ?? 0) + 1;
    coverage.byConstruct[it.construct] = (coverage.byConstruct[it.construct] ?? 0) + 1;
    coverage.byItemType[it.itemType] = (coverage.byItemType[it.itemType] ?? 0) + 1;
    if (it.difficultyWithinLevel < 0.34) coverage.difficultyWithin.low += 1;
    else if (it.difficultyWithinLevel < 0.67) coverage.difficultyWithin.mid += 1;
    else coverage.difficultyWithin.high += 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    targetSlots: 240,
    slotsBuilt: slots.length,
    overall: result.stats,
    perLanguage: byLang,
    coverage,
    rejectionReasons: result.stats.rejectionReasons,
    samplePassByLanguage: Object.fromEntries(
      BANK_LANGUAGES.map((lang) => [
        lang,
        result.approved
          .filter((i) => i.language === lang)
          .slice(0, 5)
          .map((i) => ({
            id: i.id,
            level: i.targetLevel,
            skill: i.skill,
            stem: i.stem,
            choices: i.choices,
            correctChoice: i.correctChoice,
          })),
      ]),
    ),
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${reportPath}`);
  console.log(
    `PASS=${result.stats.pass} REVISE=${result.stats.revise} REJECT=${result.stats.reject} DUP=${result.stats.duplicate}`,
  );
}

main();
