/**
 * Phase C — Production item bank build (batched, fail-closed).
 * Does NOT calibrate items. Does NOT weaken quality gates.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  cpSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BANK_LANGUAGES, type BankItemRecord, type BankLanguage } from '../src/banks/types.js';
import { loadBank } from '../src/banks/loader.js';
import { exportApprovedBank } from '../src/banks/factory/export-bank.js';
import { runFactoryPipeline } from '../src/banks/factory/pipeline-runner.js';
import { generateProductionCandidate } from '../src/banks/factory/production-expander.js';
import {
  buildGapSlots,
  buildLanguageInventory,
  summarizeGaps,
} from '../src/banks/factory/production-inventory.js';
import {
  PRODUCTION_APPROVED_PER_LANG_PER_CYCLE,
  PRODUCTION_MAX_ATTEMPTS_PER_SLOT,
  PRODUCTION_MAX_CYCLES,
} from '../src/banks/factory/production-targets.js';
import {
  answerPositionDistribution,
  constructConcentration,
  exactDuplicateRate,
  maxShare,
  nearDuplicateRate,
  scanNonsensePass,
  templateFamilyConcentration,
} from '../src/banks/factory/production-metrics.js';
import { simulateLanguageBank } from '../src/banks/factory/production-simulation.js';
import { runItemQualityPipeline } from '../src/items/pipeline.js';
import type { GeneratedItem } from '../src/items/types.js';
import { auditCrossLanguageSimilarity } from '../src/banks/factory/cross-language-audit.js';
import type { CefrLevel, AssessmentSkill } from '../src/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const banksRoot = join(root, 'banks');
const checkpointRoot = join(banksRoot, '.production-checkpoint');
const reportPath = join(banksRoot, 'production-phase-c-report.json');
const humanJson = join(banksRoot, 'production-human-review.json');
const humanMd = join(banksRoot, 'production-human-review.md');

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
    calibrationStatus: 'provisional',
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

function revalidateItems(items: BankItemRecord[]): {
  kept: BankItemRecord[];
  dropped: Array<{ id: string; gate: string }>;
} {
  const kept: BankItemRecord[] = [];
  const dropped: Array<{ id: string; gate: string }> = [];
  for (const it of items) {
    const { report, eligibility } = runItemQualityPipeline(recordToGenerated(it));
    if (report.qualityGate === 'PASS' && eligibility.eligible) {
      kept.push({ ...it, qualityGate: 'PASS', lifecycleState: 'approved_provisional', calibrationStatus: 'provisional' });
    } else {
      dropped.push({ id: it.id, gate: report.qualityGate });
    }
  }
  return { kept, dropped };
}

function loadOrEmpty(lang: BankLanguage): BankItemRecord[] {
  try {
    return loadBank(lang).items;
  } catch {
    return [];
  }
}

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
    for (let s = 0; s < skills.length && picked < n; s++) {
      const hit = pool.find(
        (i) => i.skill === skills[s] && !out.some((o) => o.id === i.id),
      );
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

function stopCheck(allLangItems: BankItemRecord[]): string | null {
  const nonsense = scanNonsensePass(allLangItems);
  if (nonsense.length) return `nonsense PASS detected: ${nonsense.slice(0, 5).join('; ')}`;
  const cross = auditCrossLanguageSimilarity(allLangItems);
  if (cross.crossLanguageConceptReuseRate > 0.25) {
    return `cross-language concept reuse too high: ${cross.crossLanguageConceptReuseRate}`;
  }
  for (const lang of BANK_LANGUAGES) {
    const items = allLangItems.filter((i) => i.language === lang);
    if (!items.length) continue;
    const conc = maxShare(constructConcentration(items), items.length);
    if (conc > 0.45) return `${lang} construct concentration ${conc.toFixed(2)} > 0.45`;
    const fam = maxShare(templateFamilyConcentration(items), items.length);
    if (fam > 0.5) return `${lang} template family concentration ${fam.toFixed(2)} > 0.5`;
    const near = nearDuplicateRate(items);
    if (near > 0.35) return `${lang} nearDuplicateRate ${near.toFixed(2)} > 0.35`;
  }
  return null;
}

function main() {
  mkdirSync(checkpointRoot, { recursive: true });
  const statePath = join(checkpointRoot, 'state.json');

  // Archive current v1 once
  const archive = join(banksRoot, 'pre-phase-c-archive');
  if (!existsSync(archive)) {
    mkdirSync(archive, { recursive: true });
    if (existsSync(join(banksRoot, 'v1'))) {
      cpSync(join(banksRoot, 'v1'), join(archive, 'v1'), { recursive: true });
    }
  }

  const banks: Record<BankLanguage, BankItemRecord[]> = {
    en: [],
    fr: [],
    zh: [],
    de: [],
    ru: [],
  };
  const revalidateDropped: Record<string, number> = {};

  console.log('Revalidating existing PASS items through current gate…');
  for (const lang of BANK_LANGUAGES) {
    const raw = loadOrEmpty(lang);
    const { kept, dropped } = revalidateItems(raw);
    banks[lang] = kept;
    revalidateDropped[lang] = dropped.length;
    exportApprovedBank({ language: lang, items: kept });
    console.log(`  ${lang}: kept ${kept.length}/${raw.length} (dropped ${dropped.length})`);
  }

  const cycleStats: unknown[] = [];
  let stopReason: string | null = null;

  for (let cycle = 1; cycle <= PRODUCTION_MAX_CYCLES; cycle += 1) {
    console.log(`\n=== Production cycle ${cycle}/${PRODUCTION_MAX_CYCLES} ===`);
    const cycleDir = join(checkpointRoot, `cycle-${cycle}`);
    mkdirSync(cycleDir, { recursive: true });
    const cycleDelta: BankItemRecord[] = [];
    const perLang: Record<string, unknown> = {};

    for (const lang of BANK_LANGUAGES) {
      const inv = buildLanguageInventory(lang, banks[lang]);
      if (inv.totalRemaining <= 0) {
        perLang[lang] = { skipped: true, reason: 'target met', inventory: inv };
        continue;
      }
      const slots = buildGapSlots(lang, banks[lang], PRODUCTION_APPROVED_PER_LANG_PER_CYCLE);
      console.log(`  ${lang}: gaps remain ${inv.totalRemaining}; slots this cycle ${slots.length}`);
      console.log(summarizeGaps(inv).split('\n').slice(0, 6).join('\n'));

      const result = runFactoryPipeline(slots, {
        maxAttemptsPerSlot: PRODUCTION_MAX_ATTEMPTS_PER_SLOT,
        checkpointDir: join(cycleDir, lang),
        resume: false,
        generate: generateProductionCandidate,
      });

      // Merge new approved (dedupe by id/stem); respect per-cell remaining
      const existingIds = new Set(banks[lang].map((i) => i.id));
      const existingStems = new Set(banks[lang].map((i) => i.stem.trim().toLowerCase()));
      const cellRemain = new Map<string, number>();
      for (const c of buildLanguageInventory(lang, banks[lang]).cells) {
        cellRemain.set(`${c.level}|${c.skill}`, c.remaining);
      }
      let added = 0;
      for (const it of result.approved) {
        if (existingIds.has(it.id)) continue;
        if (existingStems.has(it.stem.trim().toLowerCase())) continue;
        const ck = `${it.targetLevel}|${it.skill}`;
        const rem = cellRemain.get(ck) ?? 0;
        if (rem <= 0) continue;
        banks[lang].push(it);
        existingIds.add(it.id);
        existingStems.add(it.stem.trim().toLowerCase());
        cellRemain.set(ck, rem - 1);
        cycleDelta.push(it);
        added += 1;
      }
      exportApprovedBank({ language: lang, items: banks[lang] });
      perLang[lang] = {
        slots: slots.length,
        generated: result.stats.generated,
        pass: result.stats.pass,
        revise: result.stats.revise,
        reject: result.stats.reject,
        duplicate: result.stats.duplicate,
        added,
        inventoryAfter: buildLanguageInventory(lang, banks[lang]),
        rejectionReasons: result.stats.rejectionReasons,
      };
      console.log(
        `  ${lang}: +${added} approved (gen=${result.stats.generated} pass=${result.stats.pass} reject=${result.stats.reject}) → ${banks[lang].length}`,
      );
    }

    writeFileSync(join(cycleDir, 'delta.json'), `${JSON.stringify(cycleDelta, null, 2)}\n`);
    writeFileSync(join(cycleDir, 'stats.json'), `${JSON.stringify(perLang, null, 2)}\n`);
    cycleStats.push({ cycle, perLang, deltaCount: cycleDelta.length });

    const all = BANK_LANGUAGES.flatMap((l) => banks[l]);
    stopReason = stopCheck(all);
    if (stopReason) {
      console.log(`STOP: ${stopReason}`);
      break;
    }

    const remaining = BANK_LANGUAGES.reduce(
      (n, l) => n + buildLanguageInventory(l, banks[l]).totalRemaining,
      0,
    );
    writeFileSync(
      statePath,
      `${JSON.stringify({ cycle, remaining, counts: Object.fromEntries(BANK_LANGUAGES.map((l) => [l, banks[l].length])) }, null, 2)}\n`,
    );
    if (remaining === 0) {
      console.log('All language targets filled (or zero remaining).');
      break;
    }
    // Stuck detection: no additions
    if (cycleDelta.length === 0) {
      stopReason = 'no new approved items in cycle — gaps remain but generation exhausted quality';
      console.log(`STOP: ${stopReason}`);
      break;
    }
  }

  // Final metrics + simulation
  console.log('\n=== Final validation ===');
  const finalInventories: Record<string, unknown> = {};
  const metrics: Record<string, unknown> = {};
  const simulations: Record<string, unknown> = {};
  const gaps: Record<string, unknown> = {};

  for (const lang of BANK_LANGUAGES) {
    const inv = buildLanguageInventory(lang, banks[lang]);
    finalInventories[lang] = inv;
    gaps[lang] = inv.cells.filter((c) => c.remaining > 0);
    const items = banks[lang];
    metrics[lang] = {
      exactDuplicateRate: exactDuplicateRate(items),
      nearDuplicateRate: nearDuplicateRate(items),
      answerPositionDistribution: answerPositionDistribution(items),
      constructMaxShare: maxShare(constructConcentration(items), items.length),
      templateFamilyMaxShare: maxShare(templateFamilyConcentration(items), items.length),
      constructConcentration: constructConcentration(items),
      difficulty: inv.difficulty,
    };
    console.log(`Simulating ${lang}…`);
    const sim = simulateLanguageBank(lang, items, { runsPerProfile: 6 });
    simulations[lang] = {
      ...sim,
      exposureTop: Object.entries(sim.exposure)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      exposure: undefined,
    };
    console.log(
      `  ${lang}: completed=${sim.completed}/${sim.runs} mint=${sim.mintCalls} dups=${sim.duplicatePresentations}`,
    );
  }

  const allItems = BANK_LANGUAGES.flatMap((l) => banks[l]);
  const cross = auditCrossLanguageSimilarity(allItems);

  // Human review stratified sample
  const reviewRows: unknown[] = [];
  for (const lang of BANK_LANGUAGES) {
    for (const it of stratifiedSample(banks[lang])) {
      reviewRows.push({
        language: lang,
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
    }
  }
  writeFileSync(humanJson, `${JSON.stringify(reviewRows, null, 2)}\n`);
  writeFileSync(
    humanMd,
    [
      '# Production human-review stratified sample',
      '',
      `Items: ${reviewRows.length} (30/lang × 5)`,
      '',
      ...reviewRows.map((r: any) => {
        return [
          `## ${r.language} ${r.level} ${r.skill}`,
          '',
          `Construct: \`${r.construct}\``,
          '',
          r.stem,
          '',
          r.choices.map((c: string, i: number) => `${i + 1}. ${c}${c === r.correctAnswer ? ' ✓' : ''}`).join('\n'),
          '',
          `Answer: **${r.correctAnswer}** — ${r.explanation}`,
          '',
          '---',
          '',
        ].join('\n');
      }),
    ].join('\n'),
  );

  const report = {
    phase: 'C-production-bank',
    stopReason,
    revalidateDropped,
    cycleStats,
    finalInventories,
    gaps,
    metrics,
    simulations,
    crossLanguage: {
      nearDuplicateGroups: cross.crossLanguageNearDuplicateGroups.length,
      conceptReuseRate: cross.crossLanguageConceptReuseRate,
    },
    totals: Object.fromEntries(BANK_LANGUAGES.map((l) => [l, banks[l].length])),
    grandTotal: allItems.length,
    humanReviewPath: humanMd,
    note: 'Items remain approved_provisional. No empirical calibration. predictedDiscrimination is a prior.',
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nPhase C report: ${reportPath}`);
  console.log(`Human review: ${humanMd}`);
  console.log(`Totals: ${JSON.stringify(report.totals)} grand=${allItems.length}`);
  if (stopReason) console.log(`Stopped early: ${stopReason}`);
}

main();
