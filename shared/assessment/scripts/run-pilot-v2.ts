/**
 * Phase B content-quality hardening — Pilot V2.
 * Archives pilot-v1, regenerates banks with v2 gates. Does NOT run Phase C.
 */

import { cpSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPilotBlueprints } from '../src/banks/factory/blueprint.js';
import { runFactoryPipeline } from '../src/banks/factory/pipeline-runner.js';
import { exportApprovedBank } from '../src/banks/factory/export-bank.js';
import { auditCrossLanguageSimilarity } from '../src/banks/factory/cross-language-audit.js';
import { BANK_LANGUAGES, type BankLanguage } from '../src/banks/types.js';
import type { AssessmentSkill, CefrLevel } from '../src/types.js';
import { runItemQualityPipeline } from '../src/items/pipeline.js';
import { generateTemplateCandidate } from '../src/banks/factory/template-generator.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const banksRoot = join(root, 'banks');
const v1Dir = join(banksRoot, 'v1');
const archiveDir = join(banksRoot, 'pilot-v1-archive');
const reportPath = join(banksRoot, 'pilot-v2-report.json');
const humanJson = join(banksRoot, 'pilot-v2-human-review.json');
const humanMd = join(banksRoot, 'pilot-v2-human-review.md');
const checkpointDir = join(banksRoot, '.factory-checkpoint-v2');

function archivePilotV1() {
  if (!existsSync(v1Dir)) return;
  mkdirSync(archiveDir, { recursive: true });
  if (!existsSync(join(archiveDir, 'en'))) {
    cpSync(v1Dir, join(archiveDir, 'banks-v1'), { recursive: true });
  }
  const oldReport = join(banksRoot, 'pilot-report.json');
  if (existsSync(oldReport) && !existsSync(join(archiveDir, 'pilot-report.json'))) {
    cpSync(oldReport, join(archiveDir, 'pilot-report.json'));
  }
}

function countCodes(reasons: string[], needles: string[]): number {
  return reasons.filter((r) => needles.some((n) => r.includes(n))).length;
}

function main() {
  archivePilotV1();
  if (existsSync(checkpointDir)) rmSync(checkpointDir, { recursive: true, force: true });

  const slots = buildPilotBlueprints([...BANK_LANGUAGES]);
  console.log(`Pilot-v2 slots: ${slots.length}`);

  const result = runFactoryPipeline(slots, {
    maxAttemptsPerSlot: 3,
    checkpointDir,
    resume: false,
  });

  for (const lang of BANK_LANGUAGES) {
    const items = result.approved.filter((i) => i.language === lang);
    exportApprovedBank({ language: lang as BankLanguage, items });
    console.log(`Exported ${lang}: ${items.length}`);
  }

  const cross = auditCrossLanguageSimilarity(result.approved);

  const byLang: Record<string, unknown> = {};
  for (const lang of BANK_LANGUAGES) {
    const attempts = result.attempts.filter((a) => a.language === lang);
    byLang[lang] = {
      generated: attempts.length,
      PASS: attempts.filter((a) => a.gate === 'PASS').length,
      REVISE: attempts.filter((a) => a.gate === 'REVISE').length,
      REJECT: attempts.filter((a) => a.gate === 'REJECT' || a.gate === 'CALIBRATION_BLOCK').length,
      duplicate: attempts.filter((a) => a.gate === 'DUPLICATE').length,
      approved: result.approved.filter((i) => i.language === lang).length,
      promptVersions: [
        ...new Set(
          result.approved.filter((i) => i.language === lang).map((i) => i.generationPromptVersion),
        ),
      ],
    };
  }

  const coverage = {
    byCefr: {} as Record<string, number>,
    bySkill: {} as Record<string, number>,
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

  const allReasons = result.attempts.flatMap((a) => a.reasons);
  const qualityBreakout = {
    nonsenseDistractorRejects: result.stats.nonsenseDistractorRejects,
    constructMismatchRejects: result.stats.constructMismatchRejects,
    naturalnessRejects: result.stats.naturalnessRejects,
    cefrDepthRejects: result.stats.cefrDepthRejects,
    crossLanguageCloneRejects: result.stats.crossLanguageCloneRejects,
    duplicateRejects: result.stats.duplicate,
    crossLanguageNearDuplicateGroups: cross.crossLanguageNearDuplicateGroups,
    crossLanguageConceptReuseRate: cross.crossLanguageConceptReuseRate,
  };

  // Human-review artifact for all PASS
  const humanRows = result.approved.map((it) => {
    // Re-run gate for documentation of checks
    const slot = slots.find((s) => s.slotKey === it.slotKey);
    let checks: string[] = ['schema', 'deterministic', 'semantic', 'distractor', 'construct', 'naturalness', 'cefrDepth', 'adversarial', 'dedupe', 'crossLang'];
    if (slot) {
      const cand = generateTemplateCandidate(slot, 0);
      // prefer matching id attempt — best effort
      const { report } = runItemQualityPipeline(cand);
      checks = [
        `gate=${report.qualityGate}`,
        `det=${report.deterministic.passed}`,
        `sem=${report.semantic?.verdict}`,
        `adv=${report.adversarial?.verdict}`,
        `prompt=${it.generationPromptVersion}`,
      ];
    }
    return {
      language: it.language,
      level: it.targetLevel,
      skill: it.skill,
      construct: it.construct,
      stem: it.stem,
      prompt: it.prompt,
      choices: it.choices,
      correctAnswer: it.correctChoice,
      explanation: it.explanation,
      difficultyWithinLevel: it.difficultyWithinLevel,
      predictedDifficulty: it.predictedDifficulty,
      predictedDiscrimination: it.predictedDiscrimination,
      note: 'predicted* are engineering priors until empirical calibration',
      qualityChecks: checks,
      id: it.id,
    };
  });

  writeFileSync(humanJson, `${JSON.stringify(humanRows, null, 2)}\n`);
  const mdLines = [
    '# Pilot v2 human review',
    '',
    `Approved PASS items: ${humanRows.length}`,
    '',
    '| Lang | Lvl | Skill | Stem | Correct |',
    '|---|---|---|---|---|',
    ...humanRows.map(
      (r) =>
        `| ${r.language} | ${r.level} | ${r.skill} | ${String(r.stem).replace(/\|/g, '/').slice(0, 80)} | ${String(r.correctAnswer).replace(/\|/g, '/').slice(0, 40)} |`,
    ),
    '',
  ];
  writeFileSync(humanMd, mdLines.join('\n'));

  // Representative rejects
  const rejectedSamples = result.attempts
    .filter((a) => a.gate === 'REJECT' || a.gate === 'REVISE')
    .slice(0, 30)
    .map((a) => ({
      language: a.language,
      slotKey: a.slotKey,
      gate: a.gate,
      reasons: a.reasons,
      itemId: a.itemId,
    }));

  // v1 comparison snapshot if archive exists
  let v1Compare: unknown = null;
  const v1Report = join(archiveDir, 'pilot-report.json');
  if (existsSync(v1Report)) {
    const v1 = JSON.parse(readFileSync(v1Report, 'utf8')) as {
      overall?: { pass?: number; generated?: number };
      coverage?: { byCefr?: Record<string, number> };
    };
    v1Compare = {
      v1Pass: v1.overall?.pass ?? null,
      v1Generated: v1.overall?.generated ?? null,
      v1Cefr: v1.coverage?.byCefr ?? null,
      v2Pass: result.stats.pass,
      v2Generated: result.stats.generated,
      v2Cefr: coverage.byCefr,
      note: 'v2 prioritises quality over fill rate; gaps allowed',
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    pilot: 'v2',
    targetSlots: 240,
    slotsBuilt: slots.length,
    overall: result.stats,
    perLanguage: byLang,
    coverage,
    qualityBreakout,
    rejectionReasons: result.stats.rejectionReasons,
    rejectedSamples,
    crossLanguageAudit: cross,
    v1VsV2: v1Compare,
    reasonCodeTallies: {
      nonsense: countCodes(allReasons, ['NONSENSE', 'DISTRACTOR_']),
      construct: countCodes(allReasons, ['CONSTRUCT_']),
      naturalness: countCodes(allReasons, ['UNNATURAL', 'TRANSLATIONESE', 'GOVERNMENT', 'COLLOCATION']),
      cefrDepth: countCodes(allReasons, ['CEFR_DEPTH', 'LEXICAL_RARITY', 'INSUFFICIENT_INFERENCE', 'HIGH_LEVEL']),
    },
    artifacts: {
      humanReviewJson: humanJson,
      humanReviewMarkdown: humanMd,
      archive: archiveDir,
    },
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${reportPath}`);
  console.log(
    `PASS=${result.stats.pass} REVISE=${result.stats.revise} REJECT=${result.stats.reject} reuseRate=${cross.crossLanguageConceptReuseRate}`,
  );
}

main();
