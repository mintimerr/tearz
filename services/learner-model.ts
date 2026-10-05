import { cefrBandForTheta } from '@tearz/assessment';

import type { TeacherGoal } from '@/hooks/use-teacher-goal';
import type {
  CefrLevel,
  CompactLearnerContext,
  LearnerActivitySignal,
  LearnerModel,
  LearnerSkillEvidence,
  LearnerSkillProfile,
} from '@/types/learner-model';
import type { PlacementRecord } from '@/types/placement-api';

const CEFR_LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Minimum scored attempts before exposing a skill CEFR band. */
const MIN_EVIDENCE_FOR_LEVEL = 2;

const SKILL_LABELS: Record<string, string> = {
  grammar: 'grammar',
  vocabulary: 'vocabulary',
  reading: 'reading',
  functional: 'functional communication',
  listening: 'listening',
  writing: 'writing',
  speaking: 'speaking',
};

export function isCefrLevel(value: unknown): value is CefrLevel {
  return typeof value === 'string' && (CEFR_LEVELS as readonly string[]).includes(value);
}

function normalizeCefrLevel(value: unknown, fallback: CefrLevel = 'A1'): CefrLevel {
  if (typeof value !== 'string') return fallback;
  const upper = value.trim().toUpperCase();
  return isCefrLevel(upper) ? upper : fallback;
}

function formatGoalDate(ms: number): string {
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/**
 * Map engine SkillEvidence (or already-normalized learner evidence) → practical profile.
 * Weak evidence → evidenceCount / confidence only (no false CEFR precision).
 */
export function normalizeSkillProfile(raw: unknown): LearnerSkillProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: LearnerSkillProfile = {};
  for (const [skill, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;

    const evidenceCount =
      typeof row.evidenceCount === 'number' && Number.isFinite(row.evidenceCount)
        ? Math.max(0, Math.floor(row.evidenceCount))
        : typeof row.attempts === 'number' && Number.isFinite(row.attempts)
          ? Math.max(0, Math.floor(row.attempts))
          : 0;

    if (evidenceCount <= 0 && row.levelEstimate == null && row.estimatedTheta == null) {
      continue;
    }

    const estimatedTheta =
      typeof row.estimatedTheta === 'number' && Number.isFinite(row.estimatedTheta)
        ? row.estimatedTheta
        : undefined;

    const confidence =
      typeof row.confidence === 'number' && Number.isFinite(row.confidence)
        ? row.confidence
        : typeof row.evidenceStrength === 'number' && Number.isFinite(row.evidenceStrength)
          ? row.evidenceStrength
          : undefined;

    let levelEstimate: CefrLevel | undefined;
    if (isCefrLevel(row.levelEstimate)) {
      levelEstimate = row.levelEstimate;
    } else if (
      evidenceCount >= MIN_EVIDENCE_FOR_LEVEL &&
      estimatedTheta != null &&
      Number.isFinite(estimatedTheta)
    ) {
      levelEstimate = cefrBandForTheta(estimatedTheta);
    }

    const entry: LearnerSkillEvidence = {
      evidenceCount,
      ...(levelEstimate ? { levelEstimate } : {}),
      ...(estimatedTheta != null ? { estimatedTheta } : {}),
      ...(confidence != null ? { confidence } : {}),
    };
    out[skill] = entry;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeLevelProbabilities(
  raw: unknown,
): Partial<Record<CefrLevel, number>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<CefrLevel, number>> = {};
  for (const L of CEFR_LEVELS) {
    const v = (raw as Record<string, unknown>)[L];
    if (typeof v === 'number' && Number.isFinite(v)) out[L] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Deterministic derived LearnerModel.
 * overallLevel ALWAYS = PlacementRecord.level (verifiedPlacementLevel).
 * Never uses statisticalEstimate or legacy score as overallLevel.
 */
export function buildLearnerModel(input: {
  placementRecord: PlacementRecord | null | undefined;
  teacherGoal?: TeacherGoal | null;
}): LearnerModel | null {
  const record = input.placementRecord;
  if (!record?.level || !record.language) return null;

  const overallLevel = normalizeCefrLevel(record.level);

  const goalTitle = input.teacherGoal?.title?.trim();
  const goal =
    goalTitle && goalTitle.length > 0
      ? {
          title: goalTitle,
          ...(typeof input.teacherGoal?.targetDate === 'number' &&
          Number.isFinite(input.teacherGoal.targetDate)
            ? { targetDate: formatGoalDate(input.teacherGoal.targetDate) }
            : {}),
        }
      : undefined;

  const skillProfile = normalizeSkillProfile(record.skillProfile);
  const levelProbabilities = normalizeLevelProbabilities(record.levelProbabilities);

  return {
    overallLevel,
    targetLanguage: record.language,
    placement: {
      ...(typeof record.theta === 'number' && Number.isFinite(record.theta)
        ? { theta: record.theta }
        : {}),
      ...(typeof record.confidence === 'number' && Number.isFinite(record.confidence)
        ? { confidence: record.confidence }
        : {}),
      ...(typeof record.confidenceLabel === 'string' && record.confidenceLabel.trim()
        ? { confidenceLabel: record.confidenceLabel.trim() }
        : {}),
      ...(levelProbabilities ? { levelProbabilities } : {}),
      ...(skillProfile ? { skillProfile } : {}),
      ...(typeof record.assessmentSessionId === 'string' && record.assessmentSessionId.trim()
        ? { assessmentSessionId: record.assessmentSessionId.trim() }
        : typeof record.sessionId === 'string' && record.sessionId.trim()
          ? { assessmentSessionId: record.sessionId.trim() }
          : {}),
    },
    ...(goal ? { goal } : {}),
  };
}

/** Compact payload for teacher / exercise HTTP APIs. */
export function toCompactLearnerContext(model: LearnerModel | null | undefined): CompactLearnerContext | undefined {
  if (!model) return undefined;
  return {
    overallLevel: model.overallLevel,
    targetLanguage: model.targetLanguage,
    ...(model.placement.confidence != null ? { confidence: model.placement.confidence } : {}),
    ...(model.placement.confidenceLabel
      ? { confidenceLabel: model.placement.confidenceLabel }
      : {}),
    ...(model.placement.skillProfile ? { skillProfile: model.placement.skillProfile } : {}),
    ...(model.goal ? { goal: model.goal } : {}),
  };
}

function skillLine(skill: string, evidence: LearnerSkillEvidence): string {
  const label = SKILL_LABELS[skill] ?? skill;
  if (evidence.levelEstimate) {
    return `- ${label}: ${evidence.levelEstimate}`;
  }
  if (evidence.evidenceCount > 0) {
    return `- ${label}: limited evidence (${evidence.evidenceCount} items)`;
  }
  return `- ${label}: limited evidence`;
}

/**
 * Shared AI prompt block for teacher (and companion-teacher flows).
 * Must not include posterior grids, canonical responses, or telemetry.
 */
export function formatLearnerContextForAI(
  model: LearnerModel | CompactLearnerContext | null | undefined,
): string {
  if (!model) return '';

  const overallLevel =
    'overallLevel' in model && model.overallLevel
      ? String(model.overallLevel)
      : '';
  if (!overallLevel) return '';

  const confidenceLabel =
    'placement' in model && model.placement?.confidenceLabel
      ? model.placement.confidenceLabel
      : 'confidenceLabel' in model
        ? model.confidenceLabel
        : undefined;
  const confidence =
    'placement' in model && typeof model.placement?.confidence === 'number'
      ? model.placement.confidence
      : 'confidence' in model && typeof model.confidence === 'number'
        ? model.confidence
        : undefined;

  const confText =
    typeof confidenceLabel === 'string' && confidenceLabel.trim()
      ? confidenceLabel.trim()
      : typeof confidence === 'number'
        ? confidence >= 0.7
          ? 'high'
          : confidence >= 0.4
            ? 'medium'
            : 'low'
        : undefined;

  const skillProfile =
    'placement' in model && model.placement?.skillProfile
      ? model.placement.skillProfile
      : 'skillProfile' in model
        ? model.skillProfile
        : undefined;

  const goal =
    'goal' in model && model.goal?.title?.trim()
      ? model.goal
      : undefined;

  const lines: string[] = [
    'LEARNER MODEL (silent context)',
    '',
    `Starting overall level: ${overallLevel}`,
  ];
  if (confText) {
    lines.push(`Placement confidence: ${confText}`);
  }

  if (skillProfile && Object.keys(skillProfile).length > 0) {
    lines.push('', 'Skill evidence:');
    for (const [skill, evidence] of Object.entries(skillProfile)) {
      lines.push(skillLine(skill, evidence));
    }
  }

  if (goal?.title) {
    lines.push('', 'Current goal:');
    lines.push(
      goal.targetDate ? `${goal.title} by ${goal.targetDate}.` : `${goal.title}.`,
    );
  }

  lines.push(
    '',
    'Use the placement result as the starting difficulty.',
    "Adapt lesson content to the learner's demonstrated strengths, weaknesses and goal.",
    'Do not restart from beginner material unless later performance provides strong evidence that it is necessary.',
    'Do not tell the learner that you are following an internal assessment model.',
    'Do not arbitrarily redefine the stored overall CEFR level.',
    'You may adapt the difficulty of teaching based on observed performance.',
  );

  return lines.join('\n');
}

/**
 * Future continuous adaptation boundary.
 * Placement initializes; later activity may refine the model.
 * No online IRT in this MVP bridge.
 */
export function updateLearnerModelFromActivity(
  model: LearnerModel,
  _activity: LearnerActivitySignal,
): LearnerModel {
  // TODO: continuous adaptation after beta data
  return model;
}

/** Sanity helpers for tests / guards — ensure compact context stays lean. */
export function compactLearnerContextHasForbiddenKeys(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const forbidden = [
    'posterior',
    'thetaGrid',
    'canonicalResponses',
    'answerHistory',
    'presentedItemSnapshot',
    'telemetry',
    'assessmentState',
  ];
  const keys = Object.keys(payload as object);
  const found: string[] = [];
  for (const k of forbidden) {
    if (keys.includes(k)) found.push(k);
  }
  const json = JSON.stringify(payload);
  for (const needle of ['canonicalResponses', 'thetaGrid', 'posterior']) {
    if (json.includes(`"${needle}"`) && !found.includes(needle)) found.push(needle);
  }
  return found;
}
