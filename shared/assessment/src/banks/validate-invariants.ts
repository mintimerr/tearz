/**
 * Production bank item invariant validation (build-time / release hardening).
 * Fail closed for invalid production banks.
 */

import type { BankItemRecord, BankManifest } from './types.js';
import { computeItemsChecksum, canonicalItemsJson } from './loader.js';

const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const SKILLS = new Set(['grammar', 'vocabulary', 'reading', 'functional']);
const TECHNICAL_PREFIX_RE =
  /^(?:Case|Cas|Fall|Кейс)\s+\d+[\.:]?\s+|^案例\d+[：:]\s*/u;

export type BankInvariantIssue = {
  itemId?: string;
  code: string;
  message: string;
};

export function validateBankManifestAndItems(
  manifest: BankManifest,
  items: BankItemRecord[],
): { ok: boolean; issues: BankInvariantIssue[] } {
  const issues: BankInvariantIssue[] = [];

  if (manifest.itemCount !== items.length) {
    issues.push({
      code: 'ITEM_COUNT_MISMATCH',
      message: `manifest.itemCount=${manifest.itemCount} items=${items.length}`,
    });
  }
  const checksum = computeItemsChecksum(canonicalItemsJson(items));
  if (manifest.checksum !== checksum) {
    issues.push({
      code: 'CHECKSUM_MISMATCH',
      message: `expected ${manifest.checksum}, got ${checksum}`,
    });
  }

  const ids = new Set<string>();
  for (const it of items) {
    if (!it.id || typeof it.id !== 'string') {
      issues.push({ code: 'MISSING_ID', message: 'item missing id' });
      continue;
    }
    if (ids.has(it.id)) {
      issues.push({ itemId: it.id, code: 'DUPLICATE_ID', message: 'duplicate item id' });
    }
    ids.add(it.id);

    if (it.qualityGate !== 'PASS') {
      issues.push({ itemId: it.id, code: 'QUALITY_GATE', message: String(it.qualityGate) });
    }
    if (it.lifecycleState !== 'approved_provisional') {
      issues.push({ itemId: it.id, code: 'LIFECYCLE', message: String(it.lifecycleState) });
    }
    if (it.calibrationStatus !== 'provisional') {
      issues.push({ itemId: it.id, code: 'CALIBRATION', message: String(it.calibrationStatus) });
    }
    if (!CEFR.has(it.targetLevel)) {
      issues.push({ itemId: it.id, code: 'CEFR', message: String(it.targetLevel) });
    }
    if (!SKILLS.has(it.skill)) {
      issues.push({ itemId: it.id, code: 'SKILL', message: String(it.skill) });
    }
    if (!it.construct || !it.itemType) {
      issues.push({ itemId: it.id, code: 'CONSTRUCT_OR_TYPE', message: 'missing construct/itemType' });
    }
    if (!it.stem?.trim() || !it.prompt?.trim()) {
      issues.push({ itemId: it.id, code: 'EMPTY_TEXT', message: 'empty stem/prompt' });
    }
    if (TECHNICAL_PREFIX_RE.test(it.stem.trimStart())) {
      issues.push({ itemId: it.id, code: 'TECHNICAL_PREFIX', message: 'Case/案例 prefix present' });
    }
    if (!Array.isArray(it.choices) || it.choices.length < 2) {
      issues.push({ itemId: it.id, code: 'CHOICES_COUNT', message: `choices=${it.choices?.length}` });
    } else {
      const trimmed = it.choices.map((c) => c.trim());
      if (trimmed.some((c) => !c)) {
        issues.push({ itemId: it.id, code: 'EMPTY_CHOICE', message: 'empty choice text' });
      }
      if (new Set(trimmed).size !== trimmed.length) {
        issues.push({ itemId: it.id, code: 'DUPLICATE_CHOICES', message: 'duplicate choice text' });
      }
      if (!it.choices.includes(it.correctChoice)) {
        issues.push({ itemId: it.id, code: 'CORRECT_NOT_IN_CHOICES', message: 'correctChoice missing' });
      }
    }
    for (const n of [it.predictedDifficulty, it.predictedDiscrimination, it.difficultyWithinLevel]) {
      if (!Number.isFinite(n)) {
        issues.push({ itemId: it.id, code: 'NONFINITE_META', message: String(n) });
        break;
      }
    }
    if (/\uFFFD/.test(it.stem) || it.choices.some((c) => /\uFFFD/.test(c))) {
      issues.push({ itemId: it.id, code: 'MALFORMED_UNICODE', message: 'replacement char' });
    }
  }

  return { ok: issues.length === 0, issues };
}
