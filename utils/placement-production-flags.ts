/**
 * Production placement delivery flags.
 *
 * Phase-1 (now): keep legacy local questions in the app; hard-lock runtime LLM off.
 * Phase-2: flip `contentBankSource` to `v1` after banks are reviewed on device.
 *
 * Never try LLM first then fall back — that recreates the latency problem.
 */

export type PlacementDeliveryMode = 'bank_first' | 'remote_ai_debug';

/** Which question package the client engine loads. */
export type PlacementContentBankSource = 'legacy_local' | 'v1';

export type PlacementProductionFlags = {
  /** Policy when v1 is active: local approved bank only. */
  deliveryMode: PlacementDeliveryMode;
  /**
   * Active content source. Phase-1 stays on the small legacy local bank
   * so shipping recovery/itemId fixes cannot change what users see tomorrow.
   */
  contentBankSource: PlacementContentBankSource;
  /**
   * When false (production default), /api/placement/step must not be used
   * as the source of the next question.
   */
  allowRuntimeLlmGeneration: boolean;
  /**
   * Procedural mint when the active bank runs dry.
   * Keep true while contentBankSource is legacy_local (bank is small).
   * Flip false together with contentBankSource: 'v1'.
   */
  allowProceduralMint: boolean;
  /** Bank package version directory name under shared/assessment/banks/. */
  bankVersion: 'v1';
};

export const DEFAULT_PLACEMENT_PRODUCTION_FLAGS: PlacementProductionFlags = {
  deliveryMode: 'bank_first',
  contentBankSource: 'v1',
  allowRuntimeLlmGeneration: false,
  allowProceduralMint: false,
  bankVersion: 'v1',
};

let overrides: Partial<PlacementProductionFlags> = {};

export function getPlacementProductionFlags(): PlacementProductionFlags {
  return { ...DEFAULT_PLACEMENT_PRODUCTION_FLAGS, ...overrides };
}

/** Test / debug only — never call from production UI paths. */
export function setPlacementProductionFlagsForTests(
  patch: Partial<PlacementProductionFlags> | null,
): void {
  overrides = patch ? { ...patch } : {};
}

export function isBankFirstProduction(): boolean {
  const f = getPlacementProductionFlags();
  return f.deliveryMode === 'bank_first' && !f.allowRuntimeLlmGeneration;
}

export function isV1ContentBankActive(): boolean {
  return getPlacementProductionFlags().contentBankSource === 'v1';
}
