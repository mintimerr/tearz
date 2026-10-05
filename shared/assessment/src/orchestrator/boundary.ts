import { CEFR_LEVELS } from '../config.js';
import type { CefrLevel, LevelProbabilities } from '../types.js';
import { cefrRank, statisticalEstimateFromProbs } from '../scale.js';
import type { ActiveBoundary, CefrBoundaryId } from './types.js';

/** Operational CEFR cuts (matches DEFAULT_ASSESSMENT_CONFIG band edges). */
export const CEFR_CUTS: Array<{
  id: CefrBoundaryId;
  lower: CefrLevel;
  upper: CefrLevel;
  cut: number;
}> = [
  { id: 'A1/A2', lower: 'A1', upper: 'A2', cut: -2.0 },
  { id: 'A2/B1', lower: 'A2', upper: 'B1', cut: -1.0 },
  { id: 'B1/B2', lower: 'B1', upper: 'B2', cut: 0.0 },
  { id: 'B2/C1', lower: 'B2', upper: 'C1', cut: 1.0 },
  { id: 'C1/C2', lower: 'C1', upper: 'C2', cut: 2.0 },
];

/**
 * Find CEFR cut with greatest classification uncertainty under the posterior.
 * Not merely top1/top2 — uses mass on each side of each cut.
 */
export function findMostUncertainCefrBoundary(
  grid: readonly number[],
  posterior: readonly number[],
): ActiveBoundary {
  let best: ActiveBoundary | null = null;
  for (const b of CEFR_CUTS) {
    let pBelow = 0;
    for (let i = 0; i < grid.length; i += 1) {
      if (grid[i] < b.cut) pBelow += posterior[i] ?? 0;
    }
    pBelow = Math.max(0, Math.min(1, pBelow));
    const pAbove = 1 - pBelow;
    const uncertainty = pBelow * pAbove;
    const candidate: ActiveBoundary = {
      id: b.id,
      lower: b.lower,
      upper: b.upper,
      cut: b.cut,
      uncertainty,
      pBelow,
      pAbove,
    };
    if (!best || candidate.uncertainty > best.uncertainty) best = candidate;
  }
  return best!;
}

export function primaryAndRunnerUp(probs: LevelProbabilities): {
  primaryLevel: CefrLevel;
  runnerUpLevel: CefrLevel;
  primaryP: number;
  runnerUpP: number;
} {
  const ranked = [...CEFR_LEVELS].sort((a, b) => probs[b] - probs[a]);
  return {
    primaryLevel: ranked[0],
    runnerUpLevel: ranked[1],
    primaryP: probs[ranked[0]],
    runnerUpP: probs[ranked[1]],
  };
}

export function preliminaryRangeFromProbs(probs: LevelProbabilities): {
  low: CefrLevel;
  high: CefrLevel;
} {
  const primary = statisticalEstimateFromProbs(probs);
  // Mass-weighted span of levels with ≥10% or adjacent to primary
  const kept = CEFR_LEVELS.filter(
    (L) => probs[L] >= 0.1 || Math.abs(cefrRank(L) - cefrRank(primary)) <= 1,
  );
  const low = kept.reduce((a, b) => (cefrRank(a) <= cefrRank(b) ? a : b));
  const high = kept.reduce((a, b) => (cefrRank(a) >= cefrRank(b) ? a : b));
  return { low, high };
}

/** Target levels useful for probing a boundary (both sides + cut neighbourhood). */
export function levelsForBoundary(boundary: ActiveBoundary): CefrLevel[] {
  return [boundary.lower, boundary.upper];
}
