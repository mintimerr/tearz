/**
 * Safe recovery for corrupted / incompatible placement session snapshots.
 * Clears only placement session state — never unrelated user data.
 */

import type { PlacementSessionSnapshot } from './session.js';
import { deserializeSnapshot } from './session.js';

export type SessionRecoveryResult =
  | { ok: true; snapshot: PlacementSessionSnapshot }
  | { ok: false; reason: string; clearSession: true };

const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

/**
 * Validate a restored snapshot against the live content bank.
 * Fail closed → clearSession so UI can restart placement safely.
 */
export function recoverPlacementSession(
  raw: string | null | undefined,
  opts: {
    language: string;
    knownItemIds: Set<string>;
    bankVersion?: string;
    maxQuestions?: number;
  },
): SessionRecoveryResult {
  if (raw == null || String(raw).trim() === '') {
    return { ok: false, reason: 'empty_session', clearSession: true };
  }

  let parsed: PlacementSessionSnapshot | null = null;
  try {
    parsed = deserializeSnapshot(raw);
  } catch {
    return { ok: false, reason: 'invalid_json', clearSession: true };
  }
  if (!parsed) {
    return { ok: false, reason: 'deserialize_failed', clearSession: true };
  }

  if (!parsed.assessmentSessionId && !parsed.sessionId) {
    return { ok: false, reason: 'missing_session_id', clearSession: true };
  }
  if (!parsed.adaptiveState?.assessmentState) {
    return { ok: false, reason: 'missing_adaptive_state', clearSession: true };
  }
  if (!Array.isArray(parsed.canonicalResponses)) {
    return { ok: false, reason: 'missing_canonical', clearSession: true };
  }
  if (!Array.isArray(parsed.presentedItemIds)) {
    return { ok: false, reason: 'missing_presented_ids', clearSession: true };
  }

  const maxQ = opts.maxQuestions ?? 15;
  if (
    !Number.isFinite(parsed.questionNumber) ||
    parsed.questionNumber < 1 ||
    parsed.questionNumber > maxQ + 1
  ) {
    return { ok: false, reason: 'impossible_question_number', clearSession: true };
  }

  // History length must not exceed presented ids / max questions
  if (parsed.canonicalResponses.length > maxQ) {
    return { ok: false, reason: 'canonical_overflow', clearSession: true };
  }
  if (parsed.canonicalResponses.length > parsed.presentedItemIds.length) {
    return { ok: false, reason: 'canonical_ahead_of_presented', clearSession: true };
  }

  // Duplicate questionNumbers
  const qn = new Set<number>();
  for (const r of parsed.canonicalResponses) {
    if (!Number.isFinite(r.questionNumber) || qn.has(r.questionNumber)) {
      return { ok: false, reason: 'duplicate_or_bad_question_number', clearSession: true };
    }
    qn.add(r.questionNumber);
    const snap = r.presentedItemSnapshot;
    if (!snap?.itemId || !Number.isFinite(snap.effectiveDifficulty)) {
      return { ok: false, reason: 'incomplete_presented_snapshot', clearSession: true };
    }
    if (!CEFR.has(snap.targetLevel)) {
      return { ok: false, reason: 'invalid_cefr_in_history', clearSession: true };
    }
    if (
      !Number.isFinite(snap.effectiveDiscrimination) ||
      !Number.isFinite(snap.effectiveGuessingProbability)
    ) {
      return { ok: false, reason: 'nonfinite_irt_in_history', clearSession: true };
    }
  }

  // Pending item must still exist in bank (retired / version mismatch)
  if (parsed.pendingItemId && !opts.knownItemIds.has(parsed.pendingItemId)) {
    return { ok: false, reason: 'pending_item_missing_from_bank', clearSession: true };
  }
  for (const id of parsed.presentedItemIds) {
    if (!opts.knownItemIds.has(id)) {
      return { ok: false, reason: 'presented_item_missing_from_bank', clearSession: true };
    }
  }

  const theta = parsed.adaptiveState.assessmentState.theta;
  if (!Number.isFinite(theta)) {
    return { ok: false, reason: 'malformed_posterior_theta', clearSession: true };
  }

  // Active session with pending but no frozen presentation → unsafe
  if (
    parsed.status === 'active' &&
    parsed.pendingItemId &&
    (!parsed.pendingItemSnapshot ||
      parsed.pendingItemSnapshot.itemId !== parsed.pendingItemId ||
      !Number.isFinite(parsed.pendingItemSnapshot.effectiveDifficulty))
  ) {
    return { ok: false, reason: 'incomplete_pending_presentation', clearSession: true };
  }

  // Completed / abandoned / failed — do not resume mid-flow
  if (parsed.status !== 'active') {
    return { ok: false, reason: `status_${parsed.status}`, clearSession: true };
  }

  return { ok: true, snapshot: parsed };
}
