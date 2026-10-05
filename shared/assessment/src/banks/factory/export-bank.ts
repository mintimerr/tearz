/**
 * Export approved_provisional items into versioned bank directories.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AssessmentSkill, CefrLevel } from '../../types.js';
import {
  bankDir,
  canonicalItemsJson,
  computeItemsChecksum,
} from '../loader.js';
import type { BankItemRecord, BankLanguage, BankManifest, BankVersion } from '../types.js';
import { ITEM_QUALITY_VERSION } from '../types.js';

export type ExportBankOptions = {
  language: BankLanguage;
  items: BankItemRecord[];
  version?: BankVersion;
};

export function buildManifest(language: BankLanguage, items: BankItemRecord[], version: BankVersion = 'v1'): BankManifest {
  const countsByLevel: Partial<Record<CefrLevel, number>> = {};
  const countsBySkill: Partial<Record<AssessmentSkill, number>> = {};
  for (const it of items) {
    countsByLevel[it.targetLevel] = (countsByLevel[it.targetLevel] ?? 0) + 1;
    countsBySkill[it.skill] = (countsBySkill[it.skill] ?? 0) + 1;
  }
  const checksum = computeItemsChecksum(canonicalItemsJson(items));
  return {
    bankVersion: version,
    language,
    itemQualityVersion: ITEM_QUALITY_VERSION,
    itemCount: items.length,
    countsByLevel,
    countsBySkill,
    checksum,
  };
}

export function exportApprovedBank(opts: ExportBankOptions): { dir: string; manifest: BankManifest } {
  const version = opts.version ?? 'v1';
  // Reject any non-approved / calibrated smuggling
  const items = opts.items.filter((it) => {
    if (it.qualityGate !== 'PASS') return false;
    if (it.lifecycleState !== 'approved_provisional') return false;
    if (it.calibrationStatus !== 'provisional') return false;
    return true;
  });
  for (const it of items) {
    if (
      (it.calibrationStatus as string) === 'calibrated' ||
      (it.calibrationStatus as string) === 'anchor'
    ) {
      throw new Error(`Refusing to export calibrated/anchor item ${it.id}`);
    }
  }

  const dir = bankDir(opts.language, version);
  mkdirSync(dir, { recursive: true });
  const manifest = buildManifest(opts.language, items, version);
  writeFileSync(join(dir, 'items.json'), canonicalItemsJson(items), 'utf8');
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { dir, manifest };
}
