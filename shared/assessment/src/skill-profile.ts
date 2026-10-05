import type { AnswerRecord, AssessmentSkill, SkillEvidence } from './types.js';

const CORE_SKILLS: AssessmentSkill[] = ['grammar', 'vocabulary', 'reading', 'functional'];

export function emptySkillEvidence(): SkillEvidence {
  return {
    attempts: 0,
    correct: 0,
    estimatedTheta: null,
    evidenceStrength: 0,
  };
}

export function updateSkillEvidence(
  profile: Partial<Record<AssessmentSkill, SkillEvidence>>,
  answer: AnswerRecord,
): Partial<Record<AssessmentSkill, SkillEvidence>> {
  if (!answer.isScored) return profile;
  const prev = profile[answer.skill] ?? emptySkillEvidence();
  const attempts = prev.attempts + 1;
  const correct = prev.correct + (answer.correct && !answer.timedOut ? 1 : 0);
  // Running mean of EAP after each scored attempt for this skill.
  const prevTheta = prev.estimatedTheta ?? answer.thetaAfter;
  const estimatedTheta = prevTheta + (answer.thetaAfter - prevTheta) / attempts;
  const evidenceStrength = Math.min(
    1,
    attempts / 4 + answer.posteriorInformationGain * 0.5,
  );
  return {
    ...profile,
    [answer.skill]: {
      attempts,
      correct,
      estimatedTheta,
      evidenceStrength,
    },
  };
}

export function skillCoverageScore(
  profile: Partial<Record<AssessmentSkill, SkillEvidence>>,
): number {
  let covered = 0;
  for (const s of CORE_SKILLS) {
    if ((profile[s]?.attempts ?? 0) > 0) covered += 1;
  }
  return covered / CORE_SKILLS.length;
}
