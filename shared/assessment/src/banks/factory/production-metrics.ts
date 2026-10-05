/**
 * Production bank quality metrics: duplicates, concentration, answer position.
 */

import { createHash } from 'node:crypto';

import type { BankItemRecord } from '../types.js';

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function exactDuplicateRate(items: BankItemRecord[]): number {
  const seen = new Set<string>();
  let dups = 0;
  for (const it of items) {
    const f = createHash('sha256')
      .update(`${norm(it.stem)}|${it.choices.map(norm).sort().join('|')}`)
      .digest('hex');
    if (seen.has(f)) dups += 1;
    else seen.add(f);
  }
  return items.length ? dups / items.length : 0;
}

export function nearDuplicateRate(items: BankItemRecord[]): number {
  // Stem prefix similarity (first 48 normalized chars)
  const prefixes = items.map((it) => norm(it.stem).slice(0, 48));
  let near = 0;
  const seen = new Map<string, number>();
  for (const p of prefixes) {
    const n = (seen.get(p) ?? 0) + 1;
    seen.set(p, n);
    if (n > 1) near += 1;
  }
  return items.length ? near / items.length : 0;
}

export function constructConcentration(items: BankItemRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const it of items) {
    counts[it.construct] = (counts[it.construct] ?? 0) + 1;
  }
  return counts;
}

export function templateFamilyConcentration(items: BankItemRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const it of items) {
    // family ≈ concept before .vN / skill+level bucket
    const fam = it.slotKey?.replace(/\|prod\d+$/, '') ?? `${it.skill}|${it.targetLevel}`;
    counts[fam] = (counts[fam] ?? 0) + 1;
  }
  return counts;
}

export function answerPositionDistribution(items: BankItemRecord[]): number[] {
  const dist = [0, 0, 0, 0];
  for (const it of items) {
    const idx = it.choices.findIndex((c) => c === it.correctChoice);
    if (idx >= 0 && idx < 4) dist[idx] = (dist[idx] ?? 0) + 1;
  }
  return dist;
}

export function maxShare(counts: Record<string, number>, total: number): number {
  if (!total) return 0;
  let m = 0;
  for (const v of Object.values(counts)) m = Math.max(m, v / total);
  return m;
}

export function scanNonsensePass(items: BankItemRecord[]): string[] {
  const hits: string[] = [];
  const needles = [
    /hallo tür/i,
    /извините дверь/i,
    /对不起门/,
    /we meet must/i,
    /starkerlich/i,
    /поднять стул/i,
    /雨点门/,
    /i am a table/i,
    /hello door/i,
  ];
  for (const it of items) {
    const blob = `${it.stem}\n${it.choices.join('\n')}`;
    for (const re of needles) {
      if (re.test(blob)) hits.push(`${it.id}:${re}`);
    }
  }
  return hits;
}
