/**
 * Construct fidelity — item must measure the declared construct, not an incidental neighbour.
 */

import { PROMPT_VERSIONS } from './prompt-versions.js';
import type { GeneratedItem, ReviewIssue, ReviewVerdict } from './types.js';
import { getLanguagePack } from '../languages/index.js';
import { normalizeText } from './deterministic/normalize.js';

export type ConstructFidelityResult = {
  promptVersion: string;
  verdict: ReviewVerdict;
  issues: ReviewIssue[];
};

/** Heuristic keyword sets per construct id fragment → expected answer cues. */
const CONSTRUCT_CUES: Array<{ idIncludes: string[]; answerOrStem: RegExp; skill?: string }> = [
  {
    idIncludes: ['relative', 'relatives'],
    answerOrStem: /\b(who|which|that|whom|whose|dont|qui|que|où|dessen|deren|который|которая|которое|которые)\b/i,
  },
  {
    idIncludes: ['conditional', 'conditionals', 'konjunktiv'],
    answerOrStem: /\b(if|would|were|had|si |würde|wenn|если|бы|要是|如果)\b/i,
  },
  {
    idIncludes: ['subjonctif'],
    answerOrStem: /\b(que |soit|partes|aille|fasse|il faut)\b/i,
  },
  {
    idIncludes: ['passe_compose', 'perfekt', 'present_perfect'],
    answerOrStem: /\b(have|has|had|suis |sommes |bin .*ge|sind .*ge|уже|писал|написал|了|过)\b/i,
  },
  {
    idIncludes: ['futur', 'future'],
    answerOrStem: /\b(will|going to|vais |vas |wird|werde|буду|会|要)\b/i,
  },
  {
    idIncludes: ['passive', 'passiv', 'bei'],
    answerOrStem: /\b(was |were |been |wurde|worden|被|был[аои]? )\b/i,
  },
  {
    idIncludes: ['ba_bei', 'ba_'],
    answerOrStem: /把|被/,
  },
];

function packConstruct(item: GeneratedItem) {
  const pack = getLanguagePack(item.language);
  return pack?.getConstruct(item.specification.construct);
}

/**
 * Detects clear mismatches like relatives_conditional keyed by futur proche "vais".
 */
export function reviewConstructFidelity(item: GeneratedItem): ConstructFidelityResult {
  const issues: ReviewIssue[] = [];
  const constructId = item.specification.construct;
  const answer = normalizeText(item.correctAnswer);
  const blob = `${item.stem} ${item.correctAnswer} ${item.explanation}`;

  const entry = packConstruct(item);
  const looksLikeRegistryId = /^[a-z]{2}\./.test(constructId);
  if (!entry && looksLikeRegistryId) {
    issues.push({
      code: 'CONSTRUCT_MISMATCH',
      severity: 'warning',
      message: `Unknown construct ${constructId}`,
      dimension: 'constructValidity',
    });
  }

  if (entry && entry.skill !== item.specification.skill) {
    issues.push({
      code: 'WRONG_SKILL_CLASSIFICATION',
      severity: 'critical',
      message: `Spec skill ${item.specification.skill} ≠ construct skill ${entry.skill}`,
      dimension: 'constructValidity',
    });
  }

  // Specific known mismatch: relatives/conditional construct answered with futur proche only
  if (/relative|conditional/i.test(constructId)) {
    const isFuturProcheOnly =
      /^(vais|vas|va|allons|allez|vont)$/i.test(item.correctAnswer.trim()) ||
      /\bfutur proche\b/i.test(item.explanation);
    const hasRelativeOrConditionalCue =
      /\b(qui|que|dont|où|si |would|if )\b/i.test(blob) ||
      CONSTRUCT_CUES.find((c) => c.idIncludes.some((x) => constructId.includes(x)))?.answerOrStem.test(
        blob,
      );
    if (isFuturProcheOnly && !/\b(si |condicional|condition)\b/i.test(blob)) {
      issues.push({
        code: 'CONSTRUCT_MISMATCH',
        severity: 'critical',
        message: `Construct ${constructId} but key is futur proche (${item.correctAnswer})`,
        dimension: 'constructValidity',
      });
    } else if (!hasRelativeOrConditionalCue && /relative/i.test(constructId)) {
      issues.push({
        code: 'CONSTRUCT_ONLY_INCIDENTAL',
        severity: 'critical',
        message: `Relative construct declared but answer/stem lack relative markers`,
        dimension: 'constructValidity',
      });
    }
  }

  // Generic: if construct id mentions a family and answer clearly belongs to another family
  for (const cue of CONSTRUCT_CUES) {
    if (!cue.idIncludes.some((x) => constructId.toLowerCase().includes(x))) continue;
    if (!cue.answerOrStem.test(blob) && !cue.answerOrStem.test(answer)) {
      // Only fail when another clear rival family matches the answer
      const rivals = CONSTRUCT_CUES.filter((c) => c !== cue && c.answerOrStem.test(item.correctAnswer));
      if (rivals.length > 0) {
        issues.push({
          code: 'CONSTRUCT_MISMATCH',
          severity: 'critical',
          message: `Answer fits other construct family; not ${constructId}`,
          dimension: 'constructValidity',
        });
      }
    }
  }

  const critical = issues.some((i) => i.severity === 'critical');
  return {
    promptVersion: PROMPT_VERSIONS.construct_fidelity_v2,
    verdict: critical ? 'reject' : issues.length ? 'revise' : 'pass',
    issues,
  };
}
