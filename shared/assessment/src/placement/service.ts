/**
 * Placement orchestration service — production wiring entrypoint.
 *
 * Flow:
 *   UI → this service → Adaptive Test Orchestrator → eligible bank / fallback
 *     → (optional Quality Gate on generated) → response → Assessment Engine
 *     → next selection → … → AssessmentResult → PlacementRecord
 *
 * LLM must NOT determine CEFR or next level. Source of truth = posterior.
 */

import type { AssessmentConfig } from '../config.js';
import { DEFAULT_ASSESSMENT_CONFIG } from '../config.js';
import { thetaToLegacyAbility100 } from '../scale.js';
import type { OrchestratorConfig } from '../orchestrator/config.js';
import { DEFAULT_ORCHESTRATOR_CONFIG } from '../orchestrator/config.js';
import {
  applyOrchestratorAnswer,
  chooseNext,
  commitSelection,
  createAdaptiveTestState,
  finalizeAdaptiveTest,
} from '../orchestrator/state.js';
import type { AdaptiveTestState, OrchestratorCandidate } from '../orchestrator/types.js';
import type { AssessmentResult, ScoringResponse } from '../types.js';
import type { PlacementAnalyticsEvent, PlacementAnalyticsSink } from './analytics.js';
import {
  freezePresentedItemSnapshot,
  type CanonicalResponse,
} from './canonical.js';
import {
  type PlacementContentItem,
  toOrchestratorCandidate,
} from './content-bank.js';
import {
  placementApiResultFromAssessment,
  placementRecordFromAssessment,
  type PlacementRecordV1,
} from './record.js';
import {
  createSessionId,
  emptySnapshot,
  type PlacementSessionSnapshot,
  serializeSnapshot,
  deserializeSnapshot,
} from './session.js';
import { PLACEMENT_STACK_VERSIONS } from './versions.js';

function sid(snap: { sessionId: string; assessmentSessionId?: string }) {
  return snap.assessmentSessionId ?? snap.sessionId;
}

export type PlacementPublicQuestion = {
  id: string;
  kind: string;
  instruction: string;
  prompt: string;
  choices: string[];
  difficulty: number;
  section: string;
};

export type PlacementStepContinue = {
  done: false;
  correct?: boolean | null;
  ability: number;
  questionIndex: number;
  totalQuestions: number;
  question: PlacementPublicQuestion;
  answerKey: string;
  sessionId: string;
  snapshot: PlacementSessionSnapshot;
  /** Dev-only shadow comparison; never user-facing dual result. */
  shadow?: { legacyLevel?: string | null; newLevelHint?: string | null; theta?: number; confidence?: number };
};

export type PlacementStepDone = {
  done: true;
  ability: number;
  correct?: boolean | null;
  result: ReturnType<typeof placementApiResultFromAssessment>;
  record: PlacementRecordV1;
  sessionId: string;
  snapshot: PlacementSessionSnapshot;
  shadow?: { legacyLevel?: string | null; newLevel?: string; theta: number; confidence: number };
};

export type PlacementStepResult = PlacementStepContinue | PlacementStepDone;

export type PlacementServiceOptions = {
  language: string;
  contentBank: PlacementContentItem[];
  assessmentConfig?: AssessmentConfig;
  orchestratorConfig?: OrchestratorConfig;
  analytics?: PlacementAnalyticsSink;
  sessionId?: string;
  /** Optional: mint fallback content when bank lacks ideal item after envelope relax. */
  mintFallback?: (hint: {
    targetLevel: string;
    skill: string;
    difficultyWithinLevel: number;
    questionNumber: number;
  }) => PlacementContentItem | null;
  /** Dev-only: compute legacy CEFR for shadow compare (must not affect user result). */
  shadowLegacyFinalize?: (args: {
    answers: Array<{ correct: boolean; difficulty100: number }>;
  }) => string | null;
  encodeAnswerKey?: (id: string, correctChoice: string) => string;
};

function defaultEncodeAnswerKey(id: string, correctChoice: string): string {
  const payload = JSON.stringify({ id, c: correctChoice });
  // base64url without Buffer for RN/browser
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(payload, 'utf8').toString('base64url');
  }
  const b64 = btoa(unescape(encodeURIComponent(payload)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toPublic(c: PlacementContentItem): PlacementPublicQuestion {
  return {
    id: c.payload.id,
    kind: c.payload.kind,
    instruction: c.payload.instruction,
    prompt: c.payload.prompt,
    choices: c.payload.choices,
    difficulty: c.payload.difficulty100,
    section: c.payload.section,
  };
}

export class PlacementOrchestrationService {
  readonly language: string;
  readonly assessmentConfig: AssessmentConfig;
  readonly orchestratorConfig: OrchestratorConfig;
  private contentById = new Map<string, PlacementContentItem>();
  private remaining: PlacementContentItem[];
  private orch: AdaptiveTestState;
  private snapshot: PlacementSessionSnapshot;
  private analytics?: PlacementAnalyticsSink;
  private mintFallback?: PlacementServiceOptions['mintFallback'];
  private shadowLegacyFinalize?: PlacementServiceOptions['shadowLegacyFinalize'];
  private encodeAnswerKey: (id: string, correctChoice: string) => string;
  private lastCorrect: boolean | null = null;

  constructor(opts: PlacementServiceOptions) {
    this.language = opts.language;
    this.assessmentConfig = opts.assessmentConfig ?? DEFAULT_ASSESSMENT_CONFIG;
    this.orchestratorConfig = opts.orchestratorConfig ?? DEFAULT_ORCHESTRATOR_CONFIG;
    this.analytics = opts.analytics;
    this.mintFallback = opts.mintFallback;
    this.shadowLegacyFinalize = opts.shadowLegacyFinalize;
    this.encodeAnswerKey = opts.encodeAnswerKey ?? defaultEncodeAnswerKey;

    for (const c of opts.contentBank) {
      if (c.qualityGate === 'PASS' && c.eligible) {
        this.contentById.set(c.item.id, c);
      }
    }
    this.remaining = [...opts.contentBank].filter((c) => c.qualityGate === 'PASS' && c.eligible);
    this.orch = createAdaptiveTestState(this.assessmentConfig, this.orchestratorConfig);
    this.snapshot = emptySnapshot({
      sessionId: opts.sessionId ?? createSessionId(),
      language: opts.language,
      adaptiveState: this.orch,
      assessmentConfig: this.assessmentConfig,
      orchestratorConfig: this.orchestratorConfig,
    });
  }

  static fromSnapshot(
    snap: PlacementSessionSnapshot,
    opts: Omit<PlacementServiceOptions, 'sessionId'> & { contentBank: PlacementContentItem[] },
  ): PlacementOrchestrationService {
    const svc = new PlacementOrchestrationService({ ...opts, sessionId: snap.sessionId });
    svc.orch = snap.adaptiveState;
    svc.snapshot = { ...snap };
    // Remove already presented from remaining
    const presented = new Set(snap.presentedItemIds);
    svc.remaining = svc.remaining.filter((c) => !presented.has(c.item.id));
    return svc;
  }

  getSessionId(): string {
    return this.snapshot.sessionId;
  }

  getSnapshot(): PlacementSessionSnapshot {
    return {
      ...this.snapshot,
      adaptiveState: this.orch,
      updatedAt: Date.now(),
    };
  }

  serialize(): string {
    return serializeSnapshot(this.getSnapshot());
  }

  private emit(event: PlacementAnalyticsEvent) {
    this.analytics?.(event);
  }

  private candidates(): OrchestratorCandidate[] {
    return this.remaining.map(toOrchestratorCandidate);
  }

  private touchSnapshot(patch: Partial<PlacementSessionSnapshot>) {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      adaptiveState: this.orch,
      updatedAt: Date.now(),
    };
  }

  /** Start or resume: ensure a pending item is presented. */
  presentNext(): PlacementStepResult {
    if (this.orch.presentedItems.length >= this.orchestratorConfig.totalPresentedItems) {
      return this.finalize(null);
    }

    // If already pending unanswered, re-present it (restore).
    const last = this.orch.presentedItems[this.orch.presentedItems.length - 1];
    if (last && last.responseCorrect === null) {
      const content = this.contentById.get(last.item.id);
      if (!content) {
        return this.failGracefully('pending item missing from content bank');
      }
      return this.continueBody(content, null);
    }

    let selection = chooseNext(
      this.orch,
      this.candidates(),
      this.orchestratorConfig,
      this.assessmentConfig,
    );

    if (!selection && this.mintFallback) {
      const hintLevel = this.orch.activeBoundary?.upper ?? 'B1';
      const minted = this.mintFallback({
        targetLevel: hintLevel,
        skill: 'grammar',
        difficultyWithinLevel: 0.45,
        questionNumber: this.orch.presentedItems.length + 1,
      });
      if (minted && minted.qualityGate === 'PASS') {
        this.contentById.set(minted.item.id, minted);
        this.remaining.push(minted);
        this.emit({
          name: 'placement_item_regenerated',
          assessmentSessionId: sid(this.snapshot),
          sessionId: sid(this.snapshot),
          questionNumber: this.orch.presentedItems.length + 1,
          newItemId: minted.item.id,
          reason: 'no_ideal_bank_candidate',
          timestamp: Date.now(),
        });
        this.emit({
          name: 'placement_fallback_used',
          assessmentSessionId: sid(this.snapshot),
          sessionId: sid(this.snapshot),
          questionNumber: this.orch.presentedItems.length + 1,
          reason: 'no_ideal_bank_candidate',
          fallbackItemId: minted.item.id,
          timestamp: Date.now(),
        });
        selection = chooseNext(
          this.orch,
          this.candidates(),
          this.orchestratorConfig,
          this.assessmentConfig,
        );
      }
    }

    if (!selection) {
      return this.failGracefully('no selectable candidate');
    }

    this.orch = commitSelection(this.orch, selection, this.orchestratorConfig);
    const content = this.contentById.get(selection.candidate.item.id);
    if (!content) {
      return this.failGracefully('selected item missing payload');
    }

    // Remove from remaining pool
    this.remaining = this.remaining.filter((c) => c.item.id !== content.item.id);

    this.touchSnapshot({
      presentedItemIds: [...this.snapshot.presentedItemIds, content.item.id],
      selectionHistory: this.orch.selectionHistory,
      pendingItemId: content.item.id,
      pendingItemSnapshot: freezePresentedItemSnapshot(content.item, {
        evidenceWeight: content.evidenceWeight,
        qualityGate: content.qualityGate,
        itemQualityVersion: PLACEMENT_STACK_VERSIONS.itemQualityVersion,
        config: this.assessmentConfig,
      }),
      questionNumber: selection.decision.questionNumber,
      status: 'active',
    });

    const sessionKey = sid(this.snapshot);
    this.emit({
      name: 'placement_item_presented',
      assessmentSessionId: sessionKey,
      sessionId: sessionKey,
      questionNumber: selection.decision.questionNumber,
      itemId: content.item.id,
      skill: content.item.skill,
      construct: content.item.construct,
      targetLevel: content.item.targetLevel,
      predictedDifficulty: content.item.predictedDifficulty,
      calibrationStatus: content.item.calibrationStatus,
      timestamp: Date.now(),
    });

    return this.continueBody(content, this.lastCorrect);
  }

  start(): PlacementStepResult {
    this.lastCorrect = null;
    const sessionKey = sid(this.snapshot);
    this.emit({
      name: 'placement_started',
      assessmentSessionId: sessionKey,
      sessionId: sessionKey,
      language: this.language,
      assessmentEngineVersion: this.snapshot.versions.assessmentEngineVersion,
      orchestratorVersion: this.snapshot.versions.orchestratorVersion,
      placementVersion: this.snapshot.versions.placementVersion,
      timestamp: Date.now(),
    });
    return this.presentNext();
  }

  answer(input: {
    answer?: string;
    timedOut?: boolean;
    responseTimeMs?: number;
    /** If provided, skip choice compare (already scored). */
    correct?: boolean;
  }): PlacementStepResult {
    const last = this.orch.presentedItems[this.orch.presentedItems.length - 1];
    if (!last || last.responseCorrect !== null) {
      return this.failGracefully('no pending item to answer');
    }
    const content = this.contentById.get(last.item.id);
    if (!content) {
      return this.failGracefully('pending content missing');
    }

    const timedOut = input.timedOut === true;
    let correct =
      typeof input.correct === 'boolean'
        ? input.correct
        : false;
    if (!timedOut && typeof input.correct !== 'boolean' && typeof input.answer === 'string') {
      correct =
        normalizeChoice(input.answer) === normalizeChoice(content.payload.correctChoice);
    }
    if (timedOut) correct = false;

    const thetaBefore = this.orch.assessmentState.theta;
    const ts = Date.now();
    const response: ScoringResponse = {
      correct,
      timedOut,
      selectedAnswer: input.answer,
      responseTimeMs: input.responseTimeMs,
      timestamp: ts,
    };

    // Freeze psychometric params at answer time (before any later bank recalibration).
    const presentedSnap =
      this.snapshot.pendingItemSnapshot?.itemId === content.item.id
        ? this.snapshot.pendingItemSnapshot
        : freezePresentedItemSnapshot(content.item, {
            evidenceWeight: content.evidenceWeight,
            qualityGate: content.qualityGate,
            itemQualityVersion: PLACEMENT_STACK_VERSIONS.itemQualityVersion,
            config: this.assessmentConfig,
          });

    this.orch = applyOrchestratorAnswer(
      this.orch,
      response,
      this.assessmentConfig,
      this.orchestratorConfig,
    );
    this.lastCorrect = correct;

    const lastAnswer =
      this.orch.assessmentState.answerHistory[
        this.orch.assessmentState.answerHistory.length - 1
      ];
    const canonical: CanonicalResponse = {
      presentedItemSnapshot: presentedSnap,
      correct,
      timedOut,
      responseWeight: lastAnswer?.responseWeight ?? presentedSnap.evidenceWeight,
      responseTimeMs: input.responseTimeMs,
      timestamp: ts,
      questionNumber: last.questionNumber,
      selectedAnswer: input.answer,
    };

    this.touchSnapshot({
      canonicalResponses: [...(this.snapshot.canonicalResponses ?? []), canonical],
      pendingItemId: null,
      pendingItemSnapshot: null,
      selectionHistory: this.orch.selectionHistory,
    });

    const thetaAfter = this.orch.assessmentState.theta;
    const sessionKey = sid(this.snapshot);
    if (timedOut) {
      this.emit({
        name: 'placement_item_timed_out',
        assessmentSessionId: sessionKey,
        sessionId: sessionKey,
        questionNumber: last.questionNumber,
        itemId: content.item.id,
        timestamp: ts,
      });
    } else {
      this.emit({
        name: 'placement_item_answered',
        assessmentSessionId: sessionKey,
        sessionId: sessionKey,
        questionNumber: last.questionNumber,
        itemId: content.item.id,
        skill: content.item.skill,
        construct: content.item.construct,
        targetLevel: content.item.targetLevel,
        predictedDifficulty: content.item.predictedDifficulty,
        calibrationStatus: content.item.calibrationStatus,
        correct,
        timedOut,
        responseTimeMs: input.responseTimeMs,
        thetaBefore,
        thetaAfter,
        activeBoundary: this.orch.activeBoundary?.id ?? null,
        timestamp: ts,
      });
    }

    if (this.orch.presentedItems.length >= this.orchestratorConfig.totalPresentedItems) {
      return this.finalize(correct);
    }
    return this.presentNext();
  }

  private finalize(lastCorrect: boolean | null): PlacementStepDone | PlacementStepContinue {
    try {
      const result = finalizeAdaptiveTest(this.orch, this.assessmentConfig);
      const apiResult = placementApiResultFromAssessment({ result });
      const sessionKey = sid(this.snapshot);
      const record = placementRecordFromAssessment({
        result,
        language: this.language,
        sessionId: sessionKey,
        versions: this.snapshot.versions,
      });

      let shadow: PlacementStepDone['shadow'];
      if (this.shadowLegacyFinalize) {
        const legacyLevel = this.shadowLegacyFinalize({
          answers: (this.snapshot.canonicalResponses ?? []).map((a) => ({
            correct: a.correct,
            difficulty100: Math.round(
              ((a.presentedItemSnapshot.effectiveDifficulty + 3) / 6) * 100,
            ),
          })),
        });
        shadow = {
          legacyLevel,
          newLevel: result.verifiedPlacementLevel,
          theta: result.theta,
          confidence: result.confidence,
        };
      }

      this.touchSnapshot({ status: 'completed', pendingItemId: null, pendingItemSnapshot: null });
      this.emit({
        name: 'placement_completed',
        assessmentSessionId: sessionKey,
        sessionId: sessionKey,
        verifiedPlacementLevel: result.verifiedPlacementLevel,
        statisticalEstimate: result.statisticalEstimate,
        theta: result.theta,
        thetaCredibleInterval: result.thetaCredibleInterval,
        confidence: result.confidence,
        levelProbabilities: result.levelProbabilities,
        skillProfile: result.skillProfile as Record<string, unknown>,
        versions: this.snapshot.versions,
        questionCount: this.orch.presentedItems.length,
        timestamp: Date.now(),
      });

      return {
        done: true,
        ability: result.legacyAbility100,
        correct: lastCorrect,
        result: apiResult,
        record,
        sessionId: sessionKey,
        snapshot: this.getSnapshot(),
        shadow,
      };
    } catch {
      return this.failGracefully('finalize failed');
    }
  }

  /**
   * Fail gracefully — do not invent a CEFR level.
   * Returns a continue with a bank fallback item when possible; otherwise abandoned snapshot.
   */
  private failGracefully(reason: string): PlacementStepContinue {
    this.touchSnapshot({ status: 'failed' });
    const sessionKey = sid(this.snapshot);
    this.emit({
      name: 'placement_abandoned',
      assessmentSessionId: sessionKey,
      sessionId: sessionKey,
      questionNumber: this.orch.presentedItems.length,
      reason,
      timestamp: Date.now(),
    });
    const fallback = this.remaining[0];
    if (fallback && this.orch.presentedItems.length < this.orchestratorConfig.totalPresentedItems) {
      const selection = chooseNext(
        this.orch,
        [toOrchestratorCandidate(fallback)],
        this.orchestratorConfig,
        this.assessmentConfig,
      );
      if (selection) {
        this.orch = commitSelection(this.orch, selection, this.orchestratorConfig);
        this.remaining = this.remaining.filter((c) => c.item.id !== fallback.item.id);
        this.emit({
          name: 'placement_fallback_used',
          assessmentSessionId: sessionKey,
          sessionId: sessionKey,
          questionNumber: selection.decision.questionNumber,
          reason,
          fallbackItemId: fallback.item.id,
          timestamp: Date.now(),
        });
        this.touchSnapshot({
          status: 'active',
          presentedItemIds: [...this.snapshot.presentedItemIds, fallback.item.id],
          pendingItemId: fallback.item.id,
          pendingItemSnapshot: freezePresentedItemSnapshot(fallback.item, {
            evidenceWeight: fallback.evidenceWeight,
            qualityGate: fallback.qualityGate,
            itemQualityVersion: PLACEMENT_STACK_VERSIONS.itemQualityVersion,
            config: this.assessmentConfig,
          }),
          questionNumber: selection.decision.questionNumber,
        });
        return this.continueBody(fallback, this.lastCorrect);
      }
    }
    throw new PlacementSessionError(reason, this.getSnapshot());
  }

  private continueBody(
    content: PlacementContentItem,
    lastCorrect: boolean | null,
  ): PlacementStepContinue {
    const ability = thetaToLegacyAbility100(
      this.orch.assessmentState.theta,
      this.assessmentConfig,
    );
    const qn = this.orch.presentedItems.length;
    return {
      done: false,
      correct: lastCorrect,
      ability,
      questionIndex: qn,
      totalQuestions: this.orchestratorConfig.totalPresentedItems,
      question: toPublic(content),
      answerKey: this.encodeAnswerKey(content.payload.id, content.payload.correctChoice),
      sessionId: sid(this.snapshot),
      snapshot: this.getSnapshot(),
    };
  }

  /** Deterministic replay from initial bank + answer history. */
  static replay(input: {
    language: string;
    contentBank: PlacementContentItem[];
    answers: Array<{ itemId: string; correct: boolean; timedOut?: boolean }>;
    assessmentConfig?: AssessmentConfig;
    orchestratorConfig?: OrchestratorConfig;
  }): { result: AssessmentResult; record: PlacementRecordV1; presentedIds: string[] } {
    const svc = new PlacementOrchestrationService({
      language: input.language,
      contentBank: input.contentBank,
      assessmentConfig: input.assessmentConfig,
      orchestratorConfig: input.orchestratorConfig,
    });
    let step = svc.start();
    for (const ans of input.answers) {
      if (step.done) break;
      void ans.itemId;
      step = svc.answer({
        correct: ans.correct,
        timedOut: ans.timedOut,
      });
    }
    if (!step.done) {
      const result = finalizeAdaptiveTest(svc.orch, svc.assessmentConfig);
      return {
        result,
        record: placementRecordFromAssessment({
          result,
          language: input.language,
          sessionId: svc.getSessionId(),
        }),
        presentedIds: svc.getSnapshot().presentedItemIds,
      };
    }
    return {
      result: finalizeAdaptiveTest(svc.orch, svc.assessmentConfig),
      record: step.record,
      presentedIds: step.snapshot.presentedItemIds,
    };
  }
}

export class PlacementSessionError extends Error {
  snapshot: PlacementSessionSnapshot;
  constructor(message: string, snapshot: PlacementSessionSnapshot) {
    super(message);
    this.name = 'PlacementSessionError';
    this.snapshot = snapshot;
  }
}

function normalizeChoice(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export { deserializeSnapshot, serializeSnapshot };
