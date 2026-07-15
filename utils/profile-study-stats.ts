/** XP за уроки, свайпы, слова и бонусный XP (streak, drill, milestones). */
export function computeStudyXp(
  lessons: number,
  correctSwipes: number,
  vocabularyWords: number,
  bonusXp = 0,
): number {
  return lessons * 50 + correctSwipes * 10 + vocabularyWords * 5 + Math.max(0, bonusXp);
}

export function formatProfileStatNumber(n: number): string {
  return n.toLocaleString('ru-RU');
}
