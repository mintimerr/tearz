/**
 * Node/offline bank loader (fs). React Native must use load.ts instead.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  BankItemRecord,
  BankLanguage,
  BankManifest,
  BankVersion,
} from './types.js';
import { BANK_LANGUAGES, BANK_VERSIONS } from './types.js';
import { bankItemsToContentBank } from './to-content.js';

export { bankItemsToContentBank } from './to-content.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Package-root banks/ directory (shared/assessment/banks). */
export function banksRootDir(): string {
  return join(__dirname, '..', '..', 'banks');
}

export function bankDir(language: BankLanguage, version: BankVersion = 'v1'): string {
  return join(banksRootDir(), version, language);
}

export function computeItemsChecksum(itemsJsonCanonical: string): string {
  const hex = createHash('sha256').update(itemsJsonCanonical, 'utf8').digest('hex');
  return `sha256:${hex}`;
}

/** Stable canonical JSON for checksum. */
export function canonicalItemsJson(items: BankItemRecord[]): string {
  return `${JSON.stringify(items, null, 2)}\n`;
}

export function verifyBankIntegrity(
  manifest: BankManifest,
  items: BankItemRecord[],
): { ok: true } | { ok: false; reason: string } {
  if (manifest.itemCount !== items.length) {
    return {
      ok: false,
      reason: `itemCount mismatch: manifest=${manifest.itemCount} items=${items.length}`,
    };
  }
  const checksum = computeItemsChecksum(canonicalItemsJson(items));
  if (items.length === 0 && (manifest.checksum === 'empty' || manifest.checksum === 'sha256:empty')) {
    return { ok: true };
  }
  if (manifest.checksum !== checksum) {
    return {
      ok: false,
      reason: `checksum mismatch: expected ${manifest.checksum}, got ${checksum}`,
    };
  }
  for (const item of items) {
    if (
      item.calibrationStatus === ('calibrated' as string) ||
      item.calibrationStatus === ('anchor' as string)
    ) {
      return { ok: false, reason: `forbidden calibrationStatus on ${item.id}` };
    }
    if (item.lifecycleState !== 'approved_provisional') {
      return { ok: false, reason: `expected approved_provisional on ${item.id}` };
    }
    if (item.qualityGate !== 'PASS') {
      return { ok: false, reason: `expected PASS on ${item.id}` };
    }
  }
  return { ok: true };
}

function assertLanguage(language: string): BankLanguage {
  const lang = language.trim().toLowerCase() as BankLanguage;
  if (!(BANK_LANGUAGES as readonly string[]).includes(lang)) {
    throw new Error(`Unsupported bank language: ${language}`);
  }
  return lang;
}

function assertVersion(version: string): BankVersion {
  if (!(BANK_VERSIONS as readonly string[]).includes(version)) {
    throw new Error(`Unsupported bank version: ${version}`);
  }
  return version as BankVersion;
}

export function loadBank(
  language: string,
  version: BankVersion | string = 'v1',
): { manifest: BankManifest; items: BankItemRecord[] } {
  const lang = assertLanguage(language);
  const ver = assertVersion(version);
  const dir = bankDir(lang, ver);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as BankManifest;
  const items = JSON.parse(readFileSync(join(dir, 'items.json'), 'utf8')) as BankItemRecord[];
  const check = verifyBankIntegrity(manifest, items);
  if (!check.ok) {
    throw new Error(`Bank integrity check failed for ${lang}/${ver}: ${check.reason}`);
  }
  return { manifest, items };
}

export function listBundledBankLanguages(version: BankVersion = 'v1'): BankLanguage[] {
  return BANK_LANGUAGES.filter((lang) => {
    try {
      loadBank(lang, version);
      return true;
    } catch {
      return false;
    }
  });
}
