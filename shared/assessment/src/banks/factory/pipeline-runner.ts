/**
 * Offline factory pipeline: generate → quality gate → dedupe → checkpoint.
 * NOT a runtime server endpoint.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { runItemQualityPipeline } from '../../items/pipeline.js';
import type { GeneratedItem, ItemQualityReport, QualityReasonCode } from '../../items/types.js';
import { assertAiCalibrationPolicy } from '../../items/lifecycle.js';
import type { BlueprintSlot } from './blueprint.js';
import { generateTemplateCandidate, TEMPLATE_MODEL_ID, TEMPLATE_PROMPT_VERSION } from './template-generator.js';
import { wouldCreateCrossLanguageClone } from './cross-language-audit.js';
import type { BankItemRecord, BankLanguage } from '../types.js';
import { ITEM_QUALITY_VERSION } from '../types.js';
import { predictedDifficultyFromSpec } from '../../scale.js';
import { DEFAULT_ASSESSMENT_CONFIG } from '../../config.js';

export type SlotAttemptReport = {
  slotKey: string;
  language: BankLanguage;
  attempt: number;
  itemId?: string;
  gate: 'PASS' | 'REVISE' | 'REJECT' | 'DUPLICATE' | 'CALIBRATION_BLOCK';
  reasons: string[];
  report?: ItemQualityReport;
};

export type FactoryPipelineOptions = {
  maxAttemptsPerSlot?: number;
  checkpointDir?: string;
  resume?: boolean;
  /** Override candidate generator (production expander). */
  generate?: (slot: BlueprintSlot, attempt: number) => GeneratedItem;
  /** Token/cost telemetry (template path = 0). */
  onTelemetry?: (row: {
    slotKey: string;
    attempt: number;
    model: string;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
  }) => void;
};

export type FactoryPipelineResult = {
  approved: BankItemRecord[];
  attempts: SlotAttemptReport[];
  stats: {
    generated: number;
    pass: number;
    revise: number;
    reject: number;
    duplicate: number;
    deterministicReject: number;
    semanticReject: number;
    adversarialReject: number;
    nonsenseDistractorRejects: number;
    constructMismatchRejects: number;
    naturalnessRejects: number;
    cefrDepthRejects: number;
    crossLanguageCloneRejects: number;
    rejectionReasons: Record<string, number>;
  };
};

function normalizeFinger(item: GeneratedItem): string {
  const opts = item.options.map((o) => o.text.trim().toLowerCase()).sort().join('|');
  return createHash('sha256')
    .update(`${item.language}|${item.stem.trim().toLowerCase()}|${opts}|${item.correctAnswer}`)
    .digest('hex');
}

function toBankRecord(item: GeneratedItem, eligibilityWeight: number, slotKey: string): BankItemRecord {
      const cal = assertAiCalibrationPolicy(item.calibrationStatus, 'ai');
      if (!cal.ok) {
        throw new Error(cal.message ?? 'calibration policy');
      }
  if (item.calibrationStatus !== 'provisional') {
    throw new Error('Only provisional calibration allowed into bank');
  }
  return {
    id: item.id,
    language: item.language as BankLanguage,
    skill: item.specification.skill,
    construct: item.specification.construct,
    itemType: item.specification.itemType,
    responseFormat: item.specification.responseFormat,
    optionCount: item.options.length,
    targetLevel: item.specification.targetLevel,
    difficultyWithinLevel: item.specification.difficultyWithinLevel,
    predictedDifficulty: predictedDifficultyFromSpec(
      item.specification.targetLevel,
      item.specification.difficultyWithinLevel,
      DEFAULT_ASSESSMENT_CONFIG,
    ),
    predictedDiscrimination: DEFAULT_ASSESSMENT_CONFIG.defaultDiscrimination,
    calibrationStatus: 'provisional',
    lifecycleState: 'approved_provisional',
    qualityGate: 'PASS',
    stem: item.stem,
    prompt: item.prompt,
    instruction: item.prompt,
    choices: item.options.map((o) => o.text),
    correctChoice: item.correctAnswer,
    explanation: item.explanation,
    generationModel: item.generationModel || TEMPLATE_MODEL_ID,
    generationPromptVersion: item.generationPromptVersion || TEMPLATE_PROMPT_VERSION,
    itemQualityVersion: ITEM_QUALITY_VERSION,
    createdAt: item.generatedAt,
    slotKey,
  };
}

function classifyReject(report: ItemQualityReport): {
  deterministic: boolean;
  semantic: boolean;
  adversarial: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let deterministic = false;
  let semantic = false;
  let adversarial = false;
  for (const c of report.deterministic.checks) {
    if (c.severity === 'fail') {
      deterministic = true;
      reasons.push(`det:${c.code}`);
    }
  }
  if (report.semantic?.verdict === 'reject') {
    semantic = true;
    for (const i of report.semantic.issues) reasons.push(`sem:${i.code}`);
  }
  if (report.adversarial?.verdict === 'reject' || report.adversarial?.broken) {
    adversarial = true;
    for (const i of report.adversarial.issues) reasons.push(`adv:${i.code}`);
  }
  for (const i of report.criticalIssues) {
    reasons.push(`crit:${i.code}`);
  }
  if (reasons.length === 0) reasons.push(`gate:${report.qualityGate}`);
  return { deterministic, semantic, adversarial, reasons };
}

export function runFactoryPipeline(
  slots: BlueprintSlot[],
  opts: FactoryPipelineOptions = {},
): FactoryPipelineResult {
  const maxAttempts = opts.maxAttemptsPerSlot ?? 4;
  const seen = new Set<string>();
  const approved: BankItemRecord[] = [];
  const attempts: SlotAttemptReport[] = [];
  const rejectionReasons: Record<string, number> = {};
  let generated = 0;
  let pass = 0;
  let revise = 0;
  let reject = 0;
  let duplicate = 0;
  let deterministicReject = 0;
  let semanticReject = 0;
  let adversarialReject = 0;
  let nonsenseDistractorRejects = 0;
  let constructMismatchRejects = 0;
  let naturalnessRejects = 0;
  let cefrDepthRejects = 0;
  let crossLanguageCloneRejects = 0;

  const checkpointPath = opts.checkpointDir
    ? join(opts.checkpointDir, 'factory-checkpoint.json')
    : null;

  if (checkpointPath && opts.resume && existsSync(checkpointPath)) {
    try {
      const prev = JSON.parse(readFileSync(checkpointPath, 'utf8')) as {
        approved: BankItemRecord[];
      };
      for (const a of prev.approved ?? []) {
        approved.push(a);
        seen.add(a.id);
      }
    } catch {
      /* ignore corrupt checkpoint */
    }
  }

  const approvedSlotKeys = new Set(approved.map((a) => a.slotKey).filter(Boolean));

  for (const slot of slots) {
    if (approvedSlotKeys.has(slot.slotKey)) continue;

    let filled = false;
    for (let attempt = 0; attempt < maxAttempts && !filled; attempt += 1) {
      const item = (opts.generate ?? generateTemplateCandidate)(slot, attempt);
      generated += 1;
      opts.onTelemetry?.({
        slotKey: slot.slotKey,
        attempt,
        model: TEMPLATE_MODEL_ID,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
      });

      const cal = assertAiCalibrationPolicy(item.calibrationStatus, 'ai');
      if (!cal.ok) {
        attempts.push({
          slotKey: slot.slotKey,
          language: slot.language,
          attempt,
          itemId: item.id,
          gate: 'CALIBRATION_BLOCK',
          reasons: [cal.message ?? 'calibration'],
        });
        reject += 1;
        continue;
      }

      const finger = normalizeFinger(item);
      if (seen.has(finger) || seen.has(item.id)) {
        duplicate += 1;
        attempts.push({
          slotKey: slot.slotKey,
          language: slot.language,
          attempt,
          itemId: item.id,
          gate: 'DUPLICATE',
          reasons: ['DUPLICATE_ITEM'],
        });
        rejectionReasons.DUPLICATE_ITEM = (rejectionReasons.DUPLICATE_ITEM ?? 0) + 1;
        continue;
      }

      const { report, eligibility } = runItemQualityPipeline(item);
      // REVISE never enters production bank
      if (report.qualityGate === 'PASS' && eligibility.eligible) {
        if (
          wouldCreateCrossLanguageClone(
            { language: slot.language, stem: item.stem, prompt: item.prompt },
            approved,
          )
        ) {
          crossLanguageCloneRejects += 1;
          reject += 1;
          rejectionReasons.CROSS_LANGUAGE_NEAR_DUPLICATE =
            (rejectionReasons.CROSS_LANGUAGE_NEAR_DUPLICATE ?? 0) + 1;
          attempts.push({
            slotKey: slot.slotKey,
            language: slot.language,
            attempt,
            itemId: item.id,
            gate: 'REJECT',
            reasons: ['CROSS_LANGUAGE_NEAR_DUPLICATE'],
            report,
          });
          continue;
        }
        const rec = toBankRecord(item, eligibility.evidenceWeight, slot.slotKey);
        void eligibility;
        approved.push(rec);
        seen.add(finger);
        seen.add(item.id);
        approvedSlotKeys.add(slot.slotKey);
        pass += 1;
        filled = true;
        attempts.push({
          slotKey: slot.slotKey,
          language: slot.language,
          attempt,
          itemId: item.id,
          gate: 'PASS',
          reasons: [],
          report,
        });
      } else if (report.qualityGate === 'REVISE') {
        revise += 1;
        const cls = classifyReject(report);
        for (const r of cls.reasons) rejectionReasons[r] = (rejectionReasons[r] ?? 0) + 1;
        attempts.push({
          slotKey: slot.slotKey,
          language: slot.language,
          attempt,
          itemId: item.id,
          gate: 'REVISE',
          reasons: cls.reasons,
          report,
        });
      } else {
        reject += 1;
        const cls = classifyReject(report);
        if (cls.deterministic) deterministicReject += 1;
        if (cls.semantic) semanticReject += 1;
        if (cls.adversarial) adversarialReject += 1;
        for (const r of cls.reasons) {
          rejectionReasons[r] = (rejectionReasons[r] ?? 0) + 1;
          if (r.includes('NONSENSE_DISTRACTOR') || r.includes('DISTRACTOR_')) {
            nonsenseDistractorRejects += 1;
          }
          if (r.includes('CONSTRUCT_')) constructMismatchRejects += 1;
          if (
            r.includes('UNNATURAL') ||
            r.includes('TRANSLATIONESE') ||
            r.includes('GOVERNMENT') ||
            r.includes('COLLOCATION')
          ) {
            naturalnessRejects += 1;
          }
          if (
            r.includes('CEFR_DEPTH') ||
            r.includes('LEXICAL_RARITY') ||
            r.includes('INSUFFICIENT_INFERENCE') ||
            r.includes('HIGH_LEVEL_ITEM')
          ) {
            cefrDepthRejects += 1;
          }
        }
        attempts.push({
          slotKey: slot.slotKey,
          language: slot.language,
          attempt,
          itemId: item.id,
          gate: 'REJECT',
          reasons: cls.reasons,
          report,
        });
      }
    }
  }

  if (checkpointPath) {
    mkdirSync(dirname(checkpointPath), { recursive: true });
    writeFileSync(
      checkpointPath,
      JSON.stringify({ approved, updatedAt: Date.now() }, null, 2),
      'utf8',
    );
  }

  return {
    approved,
    attempts,
    stats: {
      generated,
      pass,
      revise,
      reject,
      duplicate,
      deterministicReject,
      semanticReject,
      adversarialReject,
      nonsenseDistractorRejects,
      constructMismatchRejects,
      naturalnessRejects,
      cefrDepthRejects,
      crossLanguageCloneRejects,
      rejectionReasons,
    },
  };
}

// silence unused import warning helper for QualityReasonCode in future
export type { QualityReasonCode };
