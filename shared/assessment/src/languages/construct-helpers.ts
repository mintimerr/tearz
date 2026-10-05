import type { AssessmentSkill, CefrLevel, ItemType } from '../types.js';
import type { ConstructEntry } from './types.js';

export function construct(input: {
  id: string;
  language: string;
  skill: AssessmentSkill;
  minLevel: CefrLevel;
  typicalLevel: CefrLevel;
  maxLevel: CefrLevel;
  prerequisites?: string[];
  allowedItemTypes: ItemType[];
  description: string;
  difficultyNotes?: string;
}): ConstructEntry {
  return {
    id: input.id,
    language: input.language,
    skill: input.skill,
    minLevel: input.minLevel,
    typicalLevel: input.typicalLevel,
    maxLevel: input.maxLevel,
    prerequisites: input.prerequisites ?? [],
    allowedItemTypes: input.allowedItemTypes,
    description: input.description,
    difficultyNotes:
      input.difficultyNotes ??
      'Difficulty also depends on lexical load, context, distractors, and inference demand.',
  };
}

/** Assert registry covers A1–C2 and core skills. */
export function registryCoverageIssues(constructs: ConstructEntry[]): string[] {
  const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const skills: AssessmentSkill[] = ['grammar', 'vocabulary', 'reading', 'functional'];
  const issues: string[] = [];
  for (const L of levels) {
    const hit = constructs.some((c) => c.minLevel <= L && c.maxLevel >= L);
    // compare via rank
    const rank = (x: CefrLevel) => levels.indexOf(x);
    const covers = constructs.some((c) => rank(c.minLevel) <= rank(L) && rank(c.maxLevel) >= rank(L));
    if (!covers) issues.push(`missing coverage for ${L}`);
    void hit;
  }
  for (const s of skills) {
    if (!constructs.some((c) => c.skill === s)) issues.push(`missing skill ${s}`);
    for (const L of levels) {
      const rank = (x: CefrLevel) => levels.indexOf(x);
      const ok = constructs.some(
        (c) => c.skill === s && rank(c.minLevel) <= rank(L) && rank(c.maxLevel) >= rank(L),
      );
      if (!ok) issues.push(`missing ${s}@${L}`);
    }
  }
  return issues;
}
