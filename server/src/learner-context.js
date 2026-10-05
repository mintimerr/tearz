/**
 * Compact learner context formatting for teacher / exercise prompts.
 * Mirrors services/learner-model.ts formatLearnerContextForAI — keep in sync.
 * Must never mention posterior grids / canonical responses / telemetry.
 */

const SKILL_LABELS = {
  grammar: 'grammar',
  vocabulary: 'vocabulary',
  reading: 'reading',
  functional: 'functional communication',
  listening: 'listening',
  writing: 'writing',
  speaking: 'speaking',
};

function skillLine(skill, evidence) {
  const label = SKILL_LABELS[skill] ?? skill;
  if (evidence?.levelEstimate) return `- ${label}: ${evidence.levelEstimate}`;
  if (typeof evidence?.evidenceCount === 'number' && evidence.evidenceCount > 0) {
    return `- ${label}: limited evidence (${evidence.evidenceCount} items)`;
  }
  return `- ${label}: limited evidence`;
}

/**
 * @param {object|null|undefined} ctx — CompactLearnerContext from client
 * @param {string|null|undefined} fallbackLevel — legacy learnerLevel string
 */
export function formatLearnerContextForAI(ctx, fallbackLevel) {
  const overallLevel =
    (ctx && typeof ctx.overallLevel === 'string' && ctx.overallLevel.trim()) ||
    (typeof fallbackLevel === 'string' && fallbackLevel.trim()) ||
    '';
  if (!overallLevel) return '';

  const confidenceLabel =
    ctx && typeof ctx.confidenceLabel === 'string' && ctx.confidenceLabel.trim()
      ? ctx.confidenceLabel.trim()
      : null;
  const confidence =
    ctx && typeof ctx.confidence === 'number' && Number.isFinite(ctx.confidence)
      ? ctx.confidence
      : null;
  const confText =
    confidenceLabel ||
    (confidence != null
      ? confidence >= 0.7
        ? 'high'
        : confidence >= 0.4
          ? 'medium'
          : 'low'
      : null);

  const lines = [
    'LEARNER MODEL (silent context)',
    '',
    `Starting overall level: ${String(overallLevel).slice(0, 8).replace(/"/g, '')}`,
  ];
  if (confText) lines.push(`Placement confidence: ${confText}`);

  const skillProfile = ctx && ctx.skillProfile && typeof ctx.skillProfile === 'object' ? ctx.skillProfile : null;
  if (skillProfile && Object.keys(skillProfile).length > 0) {
    lines.push('', 'Skill evidence:');
    for (const [skill, evidence] of Object.entries(skillProfile)) {
      lines.push(skillLine(skill, evidence));
    }
  }

  const goal = ctx && ctx.goal && typeof ctx.goal.title === 'string' ? ctx.goal : null;
  if (goal?.title?.trim()) {
    lines.push('', 'Current goal:');
    const title = goal.title.trim().slice(0, 240).replace(/"/g, "'");
    const date =
      typeof goal.targetDate === 'string' && goal.targetDate.trim()
        ? goal.targetDate.trim().slice(0, 32)
        : '';
    lines.push(date ? `${title} by ${date}.` : `${title}.`);
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

/** Short difficulty hint for exercise generation prompts. */
export function formatExerciseLearnerHint(ctx, fallbackLevel) {
  const level =
    (ctx && typeof ctx.overallLevel === 'string' && ctx.overallLevel.trim()) ||
    (typeof fallbackLevel === 'string' && fallbackLevel.trim()) ||
    '';
  if (!level) return '';

  const lines = [
    `\n\nLEARNER STARTING LEVEL (silent): ${String(level).slice(0, 8).replace(/"/g, '')}.`,
    'Generate exercises at this CEFR band (or slightly below/above based on the explanation).',
    'Do NOT default to beginner/A1 material for an intermediate or advanced learner.',
  ];

  const skills = ctx && ctx.skillProfile && typeof ctx.skillProfile === 'object' ? ctx.skillProfile : null;
  if (skills) {
    const withLevel = Object.entries(skills)
      .filter(([, e]) => e && typeof e === 'object' && e.levelEstimate)
      .slice(0, 4)
      .map(([s, e]) => `${SKILL_LABELS[s] ?? s}=${e.levelEstimate}`);
    if (withLevel.length) {
      lines.push(`Skill hints: ${withLevel.join(', ')}.`);
    }
  }
  return lines.join(' ');
}
