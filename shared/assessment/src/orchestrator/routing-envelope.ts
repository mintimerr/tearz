/**
 * Early routing CEFR envelope — prevents pathological Q2 C2 jumps after B1 Q1.
 * Configurable soft-hard constraints with progressive relax when bank is thin.
 */

import { CEFR_LEVELS } from '../config.js';
import type { CefrLevel } from '../types.js';
import { cefrRank } from '../scale.js';
import type { AdaptiveTestState } from './types.js';
import type { OrchestratorConfig } from './config.js';

export type RoutingEnvelope = {
  /** Inclusive allowed CEFR levels after optional relax steps. */
  allowedLevels: CefrLevel[];
  /** How many bands the envelope was relaxed (0 = strict). */
  relaxSteps: number;
  reason: string;
};

function levelsBetween(low: CefrLevel, high: CefrLevel): CefrLevel[] {
  const a = cefrRank(low);
  const b = cefrRank(high);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return CEFR_LEVELS.filter((L) => {
    const r = cefrRank(L);
    return r >= lo && r <= hi;
  });
}

function shiftLevel(level: CefrLevel, delta: number): CefrLevel {
  const idx = Math.max(0, Math.min(CEFR_LEVELS.length - 1, CEFR_LEVELS.indexOf(level) + delta));
  return CEFR_LEVELS[idx];
}

/**
 * Build strict routing envelope for Q2/Q3 from answer trajectory.
 * Q1 and Q4+ return null (no envelope).
 */
export function computeRoutingEnvelope(
  orch: AdaptiveTestState,
  questionNumber: number,
  _config: OrchestratorConfig,
): RoutingEnvelope | null {
  if (questionNumber <= 1 || questionNumber >= 4) return null;

  const scored = orch.presentedItems.filter((p) => p.isScored && p.responseCorrect !== null);
  const q1 = scored[0];
  const q2 = scored[1];

  // Anchor trajectory around first item target (expected B1) or its actual level.
  const anchorLevel: CefrLevel = q1?.item.targetLevel ?? 'B1';

  if (questionNumber === 2) {
    const correct = q1?.responseCorrect === true;
    if (correct) {
      // After correct B1: prefer B2 / B2+ neighbourhood — NOT C2.
      const low = anchorLevel;
      const high = shiftLevel(anchorLevel, 1); // B1 → B2
      return {
        allowedLevels: levelsBetween(low, high),
        relaxSteps: 0,
        reason: 'Q2_AFTER_CORRECT_NEIGHBOR_UP',
      };
    }
    // After wrong B1: A2 / A2–B1 boundary — not extreme A1 unless relaxed.
    const low = shiftLevel(anchorLevel, -1); // B1 → A2
    const high = anchorLevel;
    return {
      allowedLevels: levelsBetween(low, high),
      relaxSteps: 0,
      reason: 'Q2_AFTER_WRONG_NEIGHBOR_DOWN',
    };
  }

  if (questionNumber === 3) {
    const c1 = q1?.responseCorrect === true;
    const c2 = q2?.responseCorrect === true;
    if (c1 && c2) {
      // B1 correct → B2-ish correct → may open C1 (one more band), still not forced C2.
      const low = anchorLevel;
      const high = shiftLevel(anchorLevel, 2); // B1 → C1
      return {
        allowedLevels: levelsBetween(low, high),
        relaxSteps: 0,
        reason: 'Q3_STRONG_OPEN_PLUS_TWO',
      };
    }
    if (c1 && !c2) {
      // Correct then miss: stay around B1–B2
      return {
        allowedLevels: levelsBetween(anchorLevel, shiftLevel(anchorLevel, 1)),
        relaxSteps: 0,
        reason: 'Q3_CORRECT_THEN_MISS',
      };
    }
    if (!c1 && c2) {
      // Wrong then recover: A2–B1–B2
      return {
        allowedLevels: levelsBetween(shiftLevel(anchorLevel, -1), shiftLevel(anchorLevel, 1)),
        relaxSteps: 0,
        reason: 'Q3_WRONG_THEN_RECOVER',
      };
    }
    // Two wrongs: A1–A2–B1 (allow A1 now)
    return {
      allowedLevels: levelsBetween(shiftLevel(anchorLevel, -2), anchorLevel),
      relaxSteps: 0,
      reason: 'Q3_TWO_WRONGS',
    };
  }

  return null;
}

/** Expand envelope by one CEFR band on each side (clamped). */
export function relaxEnvelope(envelope: RoutingEnvelope): RoutingEnvelope {
  const ranks = envelope.allowedLevels.map(cefrRank);
  const lo = Math.max(1, Math.min(...ranks) - 1);
  const hi = Math.min(CEFR_LEVELS.length, Math.max(...ranks) + 1);
  const allowedLevels = CEFR_LEVELS.filter((L) => {
    const r = cefrRank(L);
    return r >= lo && r <= hi;
  });
  return {
    allowedLevels,
    relaxSteps: envelope.relaxSteps + 1,
    reason: `${envelope.reason}_RELAX${envelope.relaxSteps + 1}`,
  };
}

export function levelAllowed(level: CefrLevel, envelope: RoutingEnvelope | null): boolean {
  if (!envelope) return true;
  return envelope.allowedLevels.includes(level);
}
