/**
 * Server-side next-item target from shared orchestrator using CANONICAL history.
 * No synthetic bank correctness replay for scoring.
 *
 * Selection still needs a candidate bank for chooseNext; we rebuild posterior
 * from frozen snapshots first, then ask orchestrator for the next target level.
 */

import {
  replayFromCanonicalHistory,
} from '../../shared/assessment/dist/placement/canonical.js';
import {
  buildOrchestratorBank,
  chooseNext,
  createAdaptiveTestState,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from '../../shared/assessment/dist/orchestrator/index.js';
import { thetaToLegacyAbility100 } from '../../shared/assessment/dist/index.js';

const LEVEL_TO_100 = { A1: 10, A2: 25, B1: 42, B2: 58, C1: 75, C2: 90 };

/**
 * @param {{ canonicalResponses?: any[], language?: string, assessmentSessionId?: string }} input
 */
export function orchestratorNextTarget(input = {}) {
  const responses = Array.isArray(input.canonicalResponses) ? input.canonicalResponses : [];

  // Rebuild assessment state from frozen snapshots (not synthetic correctness replay).
  let assessmentState;
  if (responses.length > 0) {
    const replayed = replayFromCanonicalHistory({
      assessmentSessionId: input.assessmentSessionId || 'server',
      language: input.language || 'english',
      versions: {
        placementVersion: 'tearz-placement-v1',
        assessmentEngineVersion: '1.1.0-provisional',
        orchestratorVersion: 'tearz-orchestrator-v1',
        cefrMapVersion: 'en-cefr-map-provisional-v1',
        itemQualityVersion: 'item-quality-gate-v1',
      },
      responses,
    });
    assessmentState = replayed.state;
  }

  let orch = createAdaptiveTestState();
  if (assessmentState) {
    orch = {
      ...orch,
      assessmentState,
      presentedItems: responses.map((r, i) => ({
        questionNumber: r.questionNumber ?? i + 1,
        phase: 'routing',
        item: {
          id: r.presentedItemSnapshot.itemId,
          language: 'frozen',
          skill: r.presentedItemSnapshot.skill,
          construct: r.presentedItemSnapshot.construct,
          itemType: r.presentedItemSnapshot.itemType,
          responseFormat: r.presentedItemSnapshot.responseFormat,
          optionCount: r.presentedItemSnapshot.optionCount,
          targetLevel: r.presentedItemSnapshot.targetLevel,
          difficultyWithinLevel: r.presentedItemSnapshot.difficultyWithinLevel,
          predictedDifficulty: r.presentedItemSnapshot.effectiveDifficulty,
          predictedDiscrimination: r.presentedItemSnapshot.effectiveDiscrimination,
          guessingProbability: r.presentedItemSnapshot.effectiveGuessingProbability,
          calibrationStatus: r.presentedItemSnapshot.calibrationStatus,
          isScored: r.presentedItemSnapshot.isScored,
          status: 'active',
          source: 'bank',
          createdAt: 0,
        },
        isExperimental: !r.presentedItemSnapshot.isScored,
        isScored: r.presentedItemSnapshot.isScored,
        decision: null,
        responseCorrect: r.correct,
        thetaAfter: null,
        activeBoundaryAfter: null,
      })),
      scoredItemIds: responses
        .filter((r) => r.presentedItemSnapshot.isScored)
        .map((r) => r.presentedItemSnapshot.itemId),
      questionNumber: responses.length + 1,
      skillCounts: {},
      constructCounts: {},
    };
    // Rebuild skillCounts from responses
    for (const r of responses) {
      if (!r.presentedItemSnapshot.isScored) continue;
      const sk = r.presentedItemSnapshot.skill;
      orch.skillCounts[sk] = (orch.skillCounts[sk] ?? 0) + 1;
      const ct = r.presentedItemSnapshot.construct;
      orch.constructCounts[ct] = (orch.constructCounts[ct] ?? 0) + 1;
    }
  }

  if (responses.length >= DEFAULT_ORCHESTRATOR_CONFIG.totalPresentedItems) {
    return {
      done: true,
      ability: thetaToLegacyAbility100(orch.assessmentState.theta),
    };
  }

  // Candidate bank for selection only — already-presented IDs are excluded.
  const presentedIds = new Set(responses.map((r) => r.presentedItemSnapshot.itemId));
  const bank = buildOrchestratorBank({
    perLevelPerSkill: 3,
    includeExperimental: 0,
    calibrationStatus: 'calibrated',
  }).filter((c) => !presentedIds.has(c.item.id));

  const sel = chooseNext(orch, bank, DEFAULT_ORCHESTRATOR_CONFIG);
  const targetLevel = sel?.candidate.item.targetLevel ?? 'B1';
  const within = sel?.candidate.item.difficultyWithinLevel ?? 0.45;
  const base = LEVEL_TO_100[targetLevel] ?? 42;
  const targetDifficulty = Math.max(
    0,
    Math.min(100, Math.round(base + (within - 0.5) * 16)),
  );

  return {
    done: false,
    ability: thetaToLegacyAbility100(orch.assessmentState.theta),
    targetLevel,
    targetDifficulty,
    skill: sel?.candidate.item.skill ?? 'grammar',
    predictedDifficulty: sel?.candidate.item.predictedDifficulty ?? 0,
    questionNumber: responses.length + 1,
  };
}

/** @deprecated Use orchestratorNextTarget with canonicalResponses. */
export function abilityFromHistory() {
  throw new Error('abilityFromHistory removed — use finalizeFromCanonicalHistory / orchestratorNextTarget');
}
