/** Уровень из XP — для «вирусного» прогресса в профиле */
export function studyLevelFromXp(xp: number) {
  return Math.max(1, Math.floor(xp / 400) + 1);
}
