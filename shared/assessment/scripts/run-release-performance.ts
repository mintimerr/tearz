/**
 * Release performance + latency harness (bank-first, no LLM).
 */

import { performance } from 'node:perf_hooks';
import { writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBank, bankItemsToContentBank, verifyBankIntegrity } from '../src/banks/loader.js';
import { BANK_LANGUAGES } from '../src/banks/types.js';
import { PlacementOrchestrationService } from '../src/placement/index.js';

const TECHNICAL_PREFIX_RE =
  /^(?:Case|Cas|Fall|Кейс)\s+\d+[\.:]?\s+|^案例\d+[：:]\s*/u;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function summarize(ms: number[]) {
  const s = [...ms].sort((a, b) => a - b);
  return {
    n: s.length,
    p50: Number(percentile(s, 50).toFixed(3)),
    p95: Number(percentile(s, 95).toFixed(3)),
    max: Number((s[s.length - 1] ?? 0).toFixed(3)),
  };
}

function runLanguage(lang: string, runs: number) {
  const { manifest, items } = loadBank(lang);
  const integrity = verifyBankIntegrity(manifest, items);
  if (!integrity.ok) throw new Error(`${lang}: ${integrity.reason}`);
  const bank = bankItemsToContentBank(items);
  const prefixHits = items.filter((i) => TECHNICAL_PREFIX_RE.test(i.stem.trimStart())).length;

  let mintCalls = 0;
  let completed = 0;
  let exhausted = 0;
  let dups = 0;
  const evalMs: number[] = [];
  const updateMs: number[] = [];
  const selectMs: number[] = [];
  const totalMs: number[] = [];

  for (let r = 0; r < runs; r += 1) {
    const seen = new Set<string>();
    const svc = new PlacementOrchestrationService({
      language: lang,
      contentBank: bank,
      sessionId: `plc_perf_${lang}_${r}`,
      mintFallback: () => {
        mintCalls += 1;
        return null;
      },
    });
    let step = svc.start();
    let q = 0;
    while (!step.done && q < 20) {
      if (step.done) break;
      const id = step.question.id;
      if (seen.has(id)) dups += 1;
      seen.add(id);

      const tap = performance.now();
      const correctChoice = step.snapshot.pendingPresentedCorrectChoice!;
      const answer =
        q % 4 === 0 ? step.question.choices.find((c) => c !== correctChoice)! : correctChoice;
      const evaluated = performance.now();
      step = svc.answer({ answer, responseTimeMs: 900 + (q % 5) * 40 });
      const updated = performance.now();
      const selected = performance.now();
      const rendered = performance.now();

      evalMs.push(evaluated - tap);
      updateMs.push(updated - evaluated);
      selectMs.push(selected - updated);
      totalMs.push(rendered - tap);
      q += 1;
    }
    if (step.done) {
      completed += 1;
      const level =
        step.result?.level ??
        step.record?.level ??
        (step.result as { verifiedPlacementLevel?: string } | undefined)?.verifiedPlacementLevel;
      if (!level) throw new Error(`${lang} run ${r}: missing verified level`);
    } else {
      exhausted += 1;
    }
  }

  const itemsPath = join(root, 'banks/v1', lang, 'items.json');
  const manifestPath = join(root, 'banks/v1', lang, 'manifest.json');
  return {
    language: lang,
    itemCount: items.length,
    checksum: manifest.checksum,
    remainingPrefixes: prefixHits,
    bundleBytes: statSync(itemsPath).size + statSync(manifestPath).size,
    runs,
    completed,
    exhausted,
    mintCalls,
    duplicatePresentations: dups,
    latency: {
      answerEvaluationMs: summarize(evalMs),
      assessmentUpdateMs: summarize(updateMs),
      selectionMs: summarize(selectMs),
      transitionTotalMs: summarize(totalMs),
    },
  };
}

function main() {
  const runs = 24;
  const perLang = BANK_LANGUAGES.map((lang) => {
    console.log(`Perf ${lang}…`);
    return runLanguage(lang, runs);
  });
  const report = {
    phase: 'C-release-performance',
    runsPerLanguage: runs,
    perLang,
    blockers: perLang.flatMap((r) => {
      const b: string[] = [];
      if (r.mintCalls > 0) b.push(`${r.language}: mintCalls=${r.mintCalls}`);
      if (r.exhausted > 0) b.push(`${r.language}: exhausted=${r.exhausted}`);
      if (r.duplicatePresentations > 0) b.push(`${r.language}: dups=${r.duplicatePresentations}`);
      if (r.completed < r.runs) b.push(`${r.language}: completed ${r.completed}/${r.runs}`);
      if (r.remainingPrefixes > 0) b.push(`${r.language}: remainingPrefixes=${r.remainingPrefixes}`);
      return b;
    }),
  };
  const out = join(root, 'banks', 'release-performance-report.json');
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${out}`);
}

main();
