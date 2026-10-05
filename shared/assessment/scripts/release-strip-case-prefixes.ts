/**
 * Release audit step 1: strip technical Case/Cas/Fall/Кейс/案例 prefixes,
 * dedupe by stem+choices, re-export banks, freeze manifests.
 * Does NOT generate new items. Does NOT weaken quality gates.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBank, verifyBankIntegrity } from '../src/banks/loader.js';
import { exportApprovedBank } from '../src/banks/factory/export-bank.js';
import {
  BANK_LANGUAGES,
  type BankItemRecord,
  type BankLanguage,
  type BankManifest,
} from '../src/banks/types.js';
import {
  exactDuplicateRate,
  nearDuplicateRate,
  scanNonsensePass,
} from '../src/banks/factory/production-metrics.js';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const banksRoot = join(root, 'banks');
const reportPath = join(banksRoot, 'release-audit-report.json');

/** Technical uniqueness prefixes injected during Phase C combinatorial fill. */
export const TECHNICAL_PREFIX_RE =
  /^(?:Case|Cas|Fall|Кейс)\s+\d+[\.:]?\s+|^案例\d+[：:]\s*/u;

const ARTIFACT_RES: Array<{ name: string; re: RegExp }> = [
  { name: 'technical_case_prefix', re: TECHNICAL_PREFIX_RE },
  { name: 'todo_placeholder', re: /\b(TODO|FIXME|TBD|XXX|INSERT_ANSWER|OPTION_HERE|lorem ipsum)\b/i },
  { name: 'bracket_placeholder', re: /\[(?:blank|answer|option|TODO|INSERT)[^\]]*\]/i },
  { name: 'brace_placeholder', re: /\{(?:answer|option|blank|TODO)\}/i },
  { name: 'debug_marker', re: /\b(DEBUG|TRACE|GEN_ID|SLOT_KEY|conceptKey)\b/ },
  { name: 'metadata_leak', re: /\b(itemQualityVersion|generationPromptVersion|predictedDiscrimination)\b/ },
];

export function stripTechnicalPrefix(stem: string): { cleaned: string; stripped: boolean } {
  const t = stem.trimStart();
  if (!TECHNICAL_PREFIX_RE.test(t)) return { cleaned: stem, stripped: false };
  const cleaned = t.replace(TECHNICAL_PREFIX_RE, '').trimStart();
  return { cleaned, stripped: true };
}

function normStem(s: string): string {
  return s.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function fingerprint(it: Pick<BankItemRecord, 'stem' | 'choices' | 'correctChoice'>): string {
  const opts = [...it.choices].map((c) => c.trim().toLowerCase()).sort().join('|');
  return createHash('sha256')
    .update(`${normStem(it.stem)}|${opts}|${it.correctChoice.trim().toLowerCase()}`)
    .digest('hex');
}

function scanArtifacts(items: BankItemRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { name } of ARTIFACT_RES) counts[name] = 0;
  for (const it of items) {
    const blob = `${it.stem}\n${it.prompt}\n${it.instruction}\n${it.choices.join('\n')}\n${it.explanation}`;
    for (const { name, re } of ARTIFACT_RES) {
      if (re.test(blob) || re.test(it.stem)) counts[name]! += 1;
    }
  }
  return counts;
}

type LangResult = {
  language: BankLanguage;
  before: number;
  prefixesFound: number;
  prefixesStripped: number;
  retiredDuplicates: Array<{ keptId: string; retiredId: string; stem: string }>;
  after: number;
  exactDupRate: number;
  nearDupRate: number;
  nonsense: string[];
  artifactsAfter: Record<string, number>;
  checksum: string;
  gapsVs400: number;
  byCefr: Record<string, number>;
  bySkill: Record<string, number>;
};

function processLanguage(lang: BankLanguage): LangResult {
  const { items: raw } = loadBank(lang);
  let prefixesFound = 0;
  let prefixesStripped = 0;
  const cleaned: BankItemRecord[] = raw.map((it) => {
    const { cleaned: stem, stripped } = stripTechnicalPrefix(it.stem);
    if (TECHNICAL_PREFIX_RE.test(it.stem.trimStart()) || stripped) prefixesFound += 1;
    if (stripped) prefixesStripped += 1;
    // Also strip from prompt if it copied stem
    let prompt = it.prompt;
    const p = stripTechnicalPrefix(prompt);
    if (p.stripped) prompt = p.cleaned;
    return { ...it, stem, prompt };
  });

  // Dedupe: keep first occurrence (stable by original order), retire rest
  const seen = new Map<string, string>();
  const kept: BankItemRecord[] = [];
  const retired: LangResult['retiredDuplicates'] = [];
  for (const it of cleaned) {
    const fp = fingerprint(it);
    const prev = seen.get(fp);
    if (prev) {
      retired.push({ keptId: prev, retiredId: it.id, stem: it.stem.slice(0, 80) });
      continue;
    }
    seen.set(fp, it.id);
    kept.push(it);
  }

  const { manifest } = exportApprovedBank({ language: lang, items: kept });
  const integrity = verifyBankIntegrity(manifest, kept);
  if (!integrity.ok) throw new Error(`${lang} integrity: ${integrity.reason}`);

  const byCefr: Record<string, number> = {};
  const bySkill: Record<string, number> = {};
  for (const it of kept) {
    byCefr[it.targetLevel] = (byCefr[it.targetLevel] ?? 0) + 1;
    bySkill[it.skill] = (bySkill[it.skill] ?? 0) + 1;
  }

  return {
    language: lang,
    before: raw.length,
    prefixesFound,
    prefixesStripped,
    retiredDuplicates: retired,
    after: kept.length,
    exactDupRate: exactDuplicateRate(kept),
    nearDupRate: nearDuplicateRate(kept),
    nonsense: scanNonsensePass(kept),
    artifactsAfter: scanArtifacts(kept),
    checksum: manifest.checksum,
    gapsVs400: Math.max(0, 400 - kept.length),
    byCefr,
    bySkill,
  };
}

function writeFreezeMarker(results: LangResult[]) {
  const freeze = {
    releaseLabel: 'production-dogfood-v1',
    frozenAt: new Date().toISOString(),
    bankVersion: 'v1',
    policy: [
      'Do not silently edit item content',
      'Substantive content change requires new itemVersion / new item id',
      'Rejected/retired items retain historical identity for canonical replay',
      'All items remain approved_provisional — no calibration',
    ],
    languages: Object.fromEntries(
      results.map((r) => [
        r.language,
        { itemCount: r.after, checksum: r.checksum, gapsVs400: r.gapsVs400 },
      ]),
    ),
  };
  writeFileSync(join(banksRoot, 'v1', 'FREEZE.json'), `${JSON.stringify(freeze, null, 2)}\n`);
  return freeze;
}

function main() {
  mkdirSync(join(banksRoot, 'v1'), { recursive: true });
  const perLang: LangResult[] = [];
  for (const lang of BANK_LANGUAGES) {
    console.log(`Processing ${lang}…`);
    const r = processLanguage(lang);
    perLang.push(r);
    console.log(
      `  ${lang}: stripped ${r.prefixesStripped}/${r.prefixesFound} prefixes; retired ${r.retiredDuplicates.length} dups; ${r.before}→${r.after} (gap ${r.gapsVs400})`,
    );
  }

  const freeze = writeFreezeMarker(perLang);
  const report = {
    phase: 'C-release-audit',
    prefixesTotalFound: perLang.reduce((a, r) => a + r.prefixesFound, 0),
    prefixesTotalStripped: perLang.reduce((a, r) => a + r.prefixesStripped, 0),
    retiredTotal: perLang.reduce((a, r) => a + r.retiredDuplicates.length, 0),
    grandTotalAfter: perLang.reduce((a, r) => a + r.after, 0),
    perLang,
    freeze,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${reportPath}`);
  console.log(`Freeze: ${join(banksRoot, 'v1', 'FREEZE.json')}`);
  console.log(`Grand total after: ${report.grandTotalAfter}; retired: ${report.retiredTotal}`);
}

const isDirect =
  typeof process.argv[1] === 'string' &&
  import.meta.url === `file://${process.argv[1]}`;

if (isDirect || process.argv[1]?.endsWith('release-strip-case-prefixes.ts')) {
  main();
}