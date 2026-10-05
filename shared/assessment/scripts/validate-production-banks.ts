/**
 * Build-time / release bank integrity gate.
 * Fails closed if any production v1 bank is invalid.
 *
 *   npx tsx scripts/validate-production-banks.ts
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBank, verifyBankIntegrity } from '../src/banks/loader.js';
import { validateBankManifestAndItems } from '../src/banks/validate-invariants.js';
import { BANK_LANGUAGES } from '../src/banks/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function main() {
  let totalItems = 0;
  const perLang: Record<string, number> = {};
  const allIssues: Array<{ lang: string; code: string; itemId?: string; message: string }> = [];

  for (const lang of BANK_LANGUAGES) {
    const { manifest, items } = loadBank(lang, 'v1');
    perLang[lang] = items.length;
    totalItems += items.length;
    const integrity = verifyBankIntegrity(manifest, items);
    if (!integrity.ok) {
      allIssues.push({ lang, code: 'INTEGRITY', message: integrity.reason });
    }
    const inv = validateBankManifestAndItems(manifest, items);
    for (const issue of inv.issues) {
      allIssues.push({ lang, code: issue.code, itemId: issue.itemId, message: issue.message });
    }
  }

  const report = {
    ok: allIssues.length === 0 && totalItems === 1123,
    totalItems,
    expectedItems: 1123,
    perLang,
    issueCount: allIssues.length,
    issues: allIssues.slice(0, 50),
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(
    join(root, 'banks', 'bank-invariant-validation.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  if (!report.ok) {
    console.error('PRODUCTION BANK VALIDATION FAILED');
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(`OK: ${totalItems} items across ${BANK_LANGUAGES.join(',')} — invariants PASS`);
}

main();
