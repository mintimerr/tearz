/**
 * Offline adversarial second-pass reviewer.
 * Goal: try to break the item, not rubber-stamp the first review.
 */

import { PROMPT_VERSIONS } from '../prompt-versions.js';
import type { AdversarialReviewResult, GeneratedItem, ReviewIssue } from '../types.js';
import { normalizeText } from '../deterministic/normalize.js';
import { heuristicSemanticReview } from '../semantic/heuristic-review.js';

export function heuristicAdversarialReview(item: GeneratedItem): AdversarialReviewResult {
  const issues: ReviewIssue[] = [];
  const attackNotes: string[] = [];

  // Independent re-scan — do not trust prior verdict.
  const semantic = heuristicSemanticReview(item);
  for (const issue of semantic.issues) {
    if (issue.severity === 'critical') {
      issues.push({ ...issue, message: `[adversarial] ${issue.message}` });
      attackNotes.push(`Exploit: ${issue.code}`);
    }
  }

  // Second correct answer attack: another option equals correct after light normalize
  const corrects = item.options.filter((o) => o.isCorrect);
  if (corrects.length > 1) {
    issues.push({
      code: 'MULTIPLE_CORRECT_STRUCTURE',
      severity: 'critical',
      message: '[adversarial] Multiple keyed correct options',
      dimension: 'correctness',
    });
    attackNotes.push('Multiple isCorrect flags');
  }

  // Synonym attack among options vs correct
  const key = normalizeText(item.correctAnswer);
  for (const opt of item.options) {
    if (normalizeText(opt.text) === key) continue;
    if (areLooseSynonyms(opt.text, item.correctAnswer)) {
      issues.push({
        code: 'MULTIPLE_PLAUSIBLE',
        severity: 'critical',
        message: `[adversarial] Distractor may also be acceptable: ${opt.text}`,
        dimension: 'unambiguity',
      });
      attackNotes.push(`Plausible alternate: ${opt.text}`);
    }
  }

  // Solvable without construct: stem already contains conjugated answer morphology for grammar blanks
  if (item.specification.skill === 'grammar') {
    const stem = normalizeText(item.stem);
    if (key.length > 2 && stem.includes(key)) {
      issues.push({
        code: 'ANSWER_LEAK',
        severity: 'critical',
        message: '[adversarial] Answer recoverable from stem without construct knowledge',
        dimension: 'constructValidity',
      });
      attackNotes.push('Stem leak bypasses construct');
    }
  }

  // Explanation wrong
  if (
    item.explanation &&
    /correct answer is/i.test(item.explanation) &&
    !normalizeText(item.explanation).includes(key) &&
    item.options.some(
      (o) =>
        !o.isCorrect && normalizeText(item.explanation).includes(`answer is ${normalizeText(o.text)}`),
    )
  ) {
    issues.push({
      code: 'EXPLANATION_CONTRADICTS',
      severity: 'critical',
      message: '[adversarial] Explanation names a different answer',
      dimension: 'correctness',
    });
    attackNotes.push('Explanation mismatch');
  }

  const broken = issues.some((i) => i.severity === 'critical');
  return {
    promptVersion: PROMPT_VERSIONS.en_adversarial_review_v1,
    verdict: broken ? 'reject' : issues.length ? 'revise' : 'pass',
    broken,
    issues,
    attackNotes,
    suggestedAction: broken ? 'reject' : issues.length ? 'revise' : 'accept',
  };
}

function areLooseSynonyms(a: string, b: string): boolean {
  const pairs: Array<[string, string]> = [
    ['big', 'large'],
    ['small', 'little'],
    ['start', 'begin'],
    ['end', 'finish'],
    ['happy', 'glad'],
    ['buy', 'purchase'],
  ];
  const na = normalizeText(a);
  const nb = normalizeText(b);
  for (const [x, y] of pairs) {
    if ((na === x && nb === y) || (na === y && nb === x)) return true;
  }
  return false;
}
