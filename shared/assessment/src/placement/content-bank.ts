/**
 * Placement content item: psychometric ItemMeta + UI payload.
 * Orchestrator selects by ItemMeta; UI renders payload without redesign.
 */

import { itemMetaFromLegacyQuestion } from '../legacy-bridge.js';
import { toCandidate } from '../orchestrator/bank.js';
import type { OrchestratorCandidate } from '../orchestrator/types.js';
import type { ItemMeta } from '../types.js';

export type PlacementUiPayload = {
  id: string;
  kind: string;
  instruction: string;
  prompt: string;
  choices: string[];
  /** Correct choice — never sent to client public question; kept server/session-side. */
  correctChoice: string;
  /** Legacy 0–100 difficulty for API compatibility display. */
  difficulty100: number;
  section: string;
};

export type PlacementContentItem = {
  item: ItemMeta;
  payload: PlacementUiPayload;
  eligible: boolean;
  qualityGate: 'PASS' | 'REVISE' | 'REJECT';
  evidenceWeight: number;
};

export type LegacyBankQuestion = {
  id: string;
  kind?: string;
  section?: string;
  /** Bank scale 1–25 OR already 0–100 — caller normalizes to difficulty100. */
  difficulty: number;
  instruction: string;
  prompt: string;
  choices: string[];
  correctChoice: string;
  language?: string;
};

/** bank 1–25 → 0–100 (same formula as client placement-adaptive). */
export function bankDifficultyTo100(bank: number): number {
  const b = Math.max(1, Math.min(25, bank));
  return Math.max(0, Math.min(100, Math.round(((b - 1) / 24) * 100)));
}

export function contentFromLegacyBankQuestion(
  q: LegacyBankQuestion,
  opts?: { difficultyAlready100?: boolean; qualityGate?: 'PASS' | 'REVISE' | 'REJECT' },
): PlacementContentItem | null {
  if (!q.id || !q.prompt || !q.correctChoice || !Array.isArray(q.choices) || q.choices.length < 2) {
    return null;
  }
  if (!q.choices.includes(q.correctChoice)) return null;

  const difficulty100 = opts?.difficultyAlready100
    ? Math.max(0, Math.min(100, Math.round(q.difficulty)))
    : bankDifficultyTo100(q.difficulty);

  const item = itemMetaFromLegacyQuestion(
    {
      id: q.id,
      kind: q.kind,
      section: q.section,
      difficulty: difficulty100,
      choices: q.choices,
      language: q.language,
    },
  );

  const qualityGate = opts?.qualityGate ?? 'PASS';
  return {
    item,
    payload: {
      id: q.id,
      kind: q.kind ?? 'multiple_choice',
      instruction: q.instruction || 'Choose the answer',
      prompt: q.prompt,
      choices: [...q.choices],
      correctChoice: q.correctChoice,
      difficulty100,
      section: q.section ?? 'grammar',
    },
    eligible: qualityGate === 'PASS',
    qualityGate,
    evidenceWeight: qualityGate === 'PASS' ? 1 : 0,
  };
}

export function toOrchestratorCandidate(c: PlacementContentItem): OrchestratorCandidate {
  return toCandidate(c.item, undefined, c.qualityGate);
}

export function buildContentBank(
  questions: LegacyBankQuestion[],
  opts?: { difficultyAlready100?: boolean },
): PlacementContentItem[] {
  const out: PlacementContentItem[] = [];
  for (const q of questions) {
    const c = contentFromLegacyBankQuestion(q, opts);
    if (c) out.push(c);
  }
  return out;
}
