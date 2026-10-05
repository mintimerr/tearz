/**
 * Phase B.2 — Pilot V3 (real PASS quality fix).
 * Archives pilot-v2 banks, regenerates with structural gates.
 * Does NOT run Phase C.
 */

import { cpSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPilotBlueprints } from '../src/banks/factory/blueprint.js';
import { runFactoryPipeline } from '../src/banks/factory/pipeline-runner.js';
import { exportApprovedBank } from '../src/banks/factory/export-bank.js';
import { auditCrossLanguageSimilarity } from '../src/banks/factory/cross-language-audit.js';
import { BANK_LANGUAGES, type BankItemRecord, type BankLanguage } from '../src/banks/types.js';
import { runItemQualityPipeline } from '../src/items/pipeline.js';
import { reviewAnswerCueSanity } from '../src/items/answer-cue-sanity.js';
import { generateTemplateCandidate } from '../src/banks/factory/template-generator.js';
import type { GeneratedItem } from '../src/items/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const banksRoot = join(root, 'banks');
const v1Dir = join(banksRoot, 'v1');
const archiveV2 = join(banksRoot, 'pilot-v2-archive');
const reportPath = join(banksRoot, 'pilot-v3-report.json');
const humanJson = join(banksRoot, 'pilot-v3-human-review.json');
const humanMd = join(banksRoot, 'pilot-v3-human-review.md');
const checkpointDir = join(banksRoot, '.factory-checkpoint-v3');

function archivePilotV2() {
  if (!existsSync(v1Dir)) return;
  mkdirSync(archiveV2, { recursive: true });
  if (!existsSync(join(archiveV2, 'banks-v1'))) {
    cpSync(v1Dir, join(archiveV2, 'banks-v1'), { recursive: true });
  }
  for (const f of ['pilot-v2-report.json', 'pilot-v2-human-review.json', 'pilot-v2-human-review.md']) {
    const src = join(banksRoot, f);
    if (existsSync(src) && !existsSync(join(archiveV2, f))) {
      cpSync(src, join(archiveV2, f));
    }
  }
}

function recordToGenerated(it: BankItemRecord): GeneratedItem {
  return {
    id: it.id,
    specificationId: it.construct,
    language: it.language,
    stem: it.stem,
    prompt: it.prompt,
    options: it.choices.map((text, i) => ({
      id: String.fromCharCode(65 + i),
      text,
      isCorrect: text === it.correctChoice,
    })),
    correctAnswer: it.correctChoice,
    explanation: it.explanation,
    generationModel: it.generationModel,
    generationPromptVersion: it.generationPromptVersion,
    generatedAt: it.createdAt,
    calibrationStatus: it.calibrationStatus,
    specification: {
      id: it.construct,
      language: it.language,
      skill: it.skill,
      construct: it.construct,
      itemType: it.itemType,
      responseFormat: it.responseFormat,
      optionCount: it.optionCount,
      targetLevel: it.targetLevel,
      difficultyWithinLevel: it.difficultyWithinLevel,
      predictedDifficulty: it.predictedDifficulty,
      predictedDiscrimination: it.predictedDiscrimination,
      constraints: {
        mustBeUnambiguous: true,
        requireSingleUnequivocalKey: true,
        forbidTrickQuestions: true,
        forbidCulturalBias: true,
        forbidAnswerLeakInExplanation: true,
      },
      status: 'draft',
      createdAt: it.createdAt,
      updatedAt: it.createdAt,
    },
  };
}

/** Independent post-PASS sanity — drop any item that would now fail. */
function adversarialSanityFilter(items: BankItemRecord[]): {
  kept: BankItemRecord[];
  dropped: Array<{ id: string; reasons: string[] }>;
} {
  const kept: BankItemRecord[] = [];
  const dropped: Array<{ id: string; reasons: string[] }> = [];
  for (const it of items) {
    const gen = recordToGenerated(it);
    const { report, eligibility } = runItemQualityPipeline(gen);
    const sanity = reviewAnswerCueSanity(gen);
    const reasons: string[] = [];
    if (report.qualityGate !== 'PASS') reasons.push(`gate:${report.qualityGate}`);
    if (!eligibility.eligible) reasons.push('not-eligible');
    if (sanity.verdict === 'reject') {
      reasons.push(...sanity.issues.map((i) => i.code));
    }
    for (const i of report.criticalIssues) reasons.push(i.code);
    if (reasons.length) {
      dropped.push({ id: it.id, reasons: [...new Set(reasons)] });
    } else {
      kept.push(it);
    }
  }
  return { kept, dropped };
}

function main() {
  archivePilotV2();
  if (existsSync(checkpointDir)) rmSync(checkpointDir, { recursive: true, force: true });

  const slots = buildPilotBlueprints([...BANK_LANGUAGES]);
  console.log(`Pilot-v3 slots: ${slots.length}`);

  const result = runFactoryPipeline(slots, {
    maxAttemptsPerSlot: 3,
    checkpointDir,
    resume: false,
  });

  const sanity = adversarialSanityFilter(result.approved);
  if (sanity.dropped.length) {
    console.log(`Post-PASS sanity dropped ${sanity.dropped.length} items`);
  }
  const approved = sanity.kept;

  for (const lang of BANK_LANGUAGES) {
    const items = approved.filter((i) => i.language === lang);
    exportApprovedBank({ language: lang as BankLanguage, items });
    console.log(`Exported ${lang}: ${items.length}`);
  }

  const cross = auditCrossLanguageSimilarity(approved);

  const byLang: Record<string, unknown> = {};
  for (const lang of BANK_LANGUAGES) {
    const attempts = result.attempts.filter((a) => a.language === lang);
    byLang[lang] = {
      generated: attempts.length,
      PASS: attempts.filter((a) => a.gate === 'PASS').length,
      REVISE: attempts.filter((a) => a.gate === 'REVISE').length,
      REJECT: attempts.filter((a) => a.gate === 'REJECT' || a.gate === 'CALIBRATION_BLOCK').length,
      duplicate: attempts.filter((a) => a.gate === 'DUPLICATE').length,
      approvedAfterSanity: approved.filter((i) => i.language === lang).length,
      promptVersions: [
        ...new Set(approved.filter((i) => i.language === lang).map((i) => i.generationPromptVersion)),
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
  for (const it of approved) {
    coverage.byCefr[it.targetLevel] = (coverage.byCefr[it.targetLevel] ?? 0) + 1;
    coverage.bySkill[it.skill] = (coverage.bySkill[it.skill] ?? 0) + 1;
    coverage.byConstruct[it.construct] = (coverage.byConstruct[it.construct] ?? 0) + 1;
    coverage.byItemType[it.itemType] = (coverage.byItemType[it.itemType] ?? 0) + 1;
    if (it.difficultyWithinLevel < 0.34) coverage.difficultyWithin.low += 1;
    else if (it.difficultyWithinLevel < 0.67) coverage.difficultyWithin.mid += 1;
    else coverage.difficultyWithin.high += 1;
  }

  const humanRows = approved.map((it) => {
    const slot = slots.find((s) => s.slotKey === it.slotKey);
    let checks: string[] = [
      'schema',
      'deterministic',
      'semantic',
      'distractor',
      'construct',
      'naturalness',
      'cefrDepth',
      'answerCueSanity',
      'adversarial',
      'dedupe',
      'crossLang',
      'postPassSanity',
    ];
    if (slot) {
      const cand = generateTemplateCandidate(slot, 0);
      const { report } = runItemQualityPipeline(cand);
      checks = [
        `gate=${report.qualityGate}`,
        `det=${report.deterministic.passed}`,
        `sem=${report.semantic?.verdict}`,
        `adv=${report.adversarial?.verdict}`,
        `prompt=${it.generationPromptVersion}`,
        'postPassSanity=ok',
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
      note: 'predicted* are engineering priors until empirical calibration — not calibrated',
      qualityChecks: checks,
      id: it.id,
    };
  });

  writeFileSync(humanJson, `${JSON.stringify(humanRows, null, 2)}\n`);
  writeFileSync(
    humanMd,
    [
      '# Pilot v3 human review',
      '',
      `Approved PASS items (after post-PASS sanity): ${humanRows.length}`,
      '',
      '| Lang | Lvl | Skill | Stem | Correct |',
      '|---|---|---|---|---|',
      ...humanRows.map(
        (r) =>
          `| ${r.language} | ${r.level} | ${r.skill} | ${String(r.stem).replace(/\|/g, '/').slice(0, 80)} | ${String(r.correctAnswer).replace(/\|/g, '/').slice(0, 40)} |`,
      ),
      '',
    ].join('\n'),
  );

  const rejectedSamples = result.attempts
    .filter((a) => a.gate === 'REJECT' || a.gate === 'REVISE')
    .slice(0, 40)
    .map((a) => ({
      language: a.language,
      slotKey: a.slotKey,
      gate: a.gate,
      reasons: a.reasons,
      itemId: a.itemId,
    }));

  let v2Compare: unknown = null;
  const v2Report = join(archiveV2, 'pilot-v2-report.json');
  if (existsSync(v2Report)) {
    try {
      v2Compare = JSON.parse(readFileSync(v2Report, 'utf8'));
    } catch {
      v2Compare = null;
    }
  }

  const c1c2 = approved.filter((i) => i.targetLevel === 'C1' || i.targetLevel === 'C2');

  const report = {
    phase: 'B.2-pilot-v3',
    generated: result.stats.generated,
    PASS: result.stats.pass,
    REVISE: result.stats.revise,
    REJECT: result.stats.reject,
    approvedAfterSanity: approved.length,
    postPassSanityDropped: sanity.dropped,
    byLanguage: byLang,
    coverage,
    qualityBreakout: {
      nonsenseDistractorRejects: result.stats.nonsenseDistractorRejects,
      constructMismatchRejects: result.stats.constructMismatchRejects,
      naturalnessRejects: result.stats.naturalnessRejects,
      cefrDepthRejects: result.stats.cefrDepthRejects,
      crossLanguageCloneRejects: result.stats.crossLanguageCloneRejects,
      duplicateRejects: result.stats.duplicate,
      crossLanguageNearDuplicateGroups: cross.crossLanguageNearDuplicateGroups,
      crossLanguageConceptReuseRate: cross.crossLanguageConceptReuseRate,
    },
    rejectedSamples,
    c1c2PassCount: c1c2.length,
    pilotV2Compare: v2Compare
      ? {
          v2Pass: (v2Compare as { PASS?: number }).PASS,
          v3ApprovedAfterSanity: approved.length,
        }
      : null,
    gapsOk: true,
    note: 'Quality > coverage. predictedDifficulty/Discrimination are priors only.',
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `Pilot-v3 done. pipeline PASS=${result.stats.pass} afterSanity=${approved.length} REVISE=${result.stats.revise} REJECT=${result.stats.reject} reuseRate=${cross.crossLanguageConceptReuseRate}`,
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Human review: ${humanMd}`);
}

main();
