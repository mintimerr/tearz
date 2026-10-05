/**
 * Offline heuristic semantic reviewer for tests / local gate.
 * Not a substitute for an LLM semantic pass in production.
 */

import { getEnConstruct } from '../../languages/en/constructs.js';
import { enLevelProfile } from '../../languages/en/cefr-map.js';
import { cefrRank } from '../../scale.js';
import { PROMPT_VERSIONS } from '../prompt-versions.js';
import type { GeneratedItem, QualityScores, ReviewIssue, SemanticReviewResult } from '../types.js';
import { normalizeText, wordCount } from '../deterministic/normalize.js';

const WORLD_KNOWLEDGE_RE =
  /\b(capital of|who invented|in what year|population of|Oscar winner|CEO of|founded in \d{4}|trivia)\b/i;

const UNNATURAL_RE =
  /\b(the freedom was liking|he goed|informations are|much peoples|I am agree)\b/i;

const DISPUTED_RE =
  /\b(only correct in British English|American English only|split infinitive is wrong|never end a sentence with a preposition)\b/i;

const DIALECT_RE =
  /\b(only Americans say|only Brits say|have got vs gotten is the key|flat adverb is wrong)\b/i;

export function heuristicSemanticReview(item: GeneratedItem): SemanticReviewResult {
  const issues: ReviewIssue[] = [];
  const scores: QualityScores = {
    correctness: 0.85,
    unambiguity: 0.85,
    constructValidity: 0.85,
    levelPlausibility: 0.85,
    distractorQuality: 0.8,
    naturalness: 0.85,
    cueResistance: 0.85,
    contextIndependence: 0.85,
  };

  const blob = `${item.stem}\n${item.prompt}\n${item.explanation}\n${item.options.map((o) => o.text).join('\n')}`;
  const spec = item.specification;

  // Multiple marked correct already deterministic; check explanation contradiction soft
  if (/answer is wrong|incorrect answer is/i.test(item.explanation) && item.correctAnswer) {
    issues.push({
      code: 'EXPLANATION_CONTRADICTS',
      severity: 'critical',
      message: 'Explanation appears to contradict the keyed answer',
      dimension: 'correctness',
    });
    scores.correctness = 0.1;
  }

  if (WORLD_KNOWLEDGE_RE.test(blob)) {
    issues.push({
      code: 'WORLD_KNOWLEDGE_RISK',
      severity: 'critical',
      message: 'Item appears to require world knowledge / trivia',
      dimension: 'contextIndependence',
    });
    scores.contextIndependence = 0.15;
  }

  if (UNNATURAL_RE.test(blob) || /\bTODO\b/.test(blob)) {
    issues.push({
      code: 'UNNATURAL_LANGUAGE',
      severity: 'critical',
      message: 'Unnatural or broken English in item text',
      dimension: 'naturalness',
    });
    scores.naturalness = 0.2;
  }

  if (DISPUTED_RE.test(blob) || DISPUTED_RE.test(item.explanation)) {
    issues.push({
      code: 'DISPUTED_GRAMMAR',
      severity: 'critical',
      message: 'Relies on disputed prescriptive rule',
      dimension: 'correctness',
    });
    scores.correctness = Math.min(scores.correctness, 0.25);
  }

  if (DIALECT_RE.test(blob)) {
    issues.push({
      code: 'DIALECT_DEPENDENCE',
      severity: 'critical',
      message: 'Answer appears dialect-dependent',
      dimension: 'unambiguity',
    });
    scores.unambiguity = 0.2;
  }

  // Absurd distractors: nonsense tokens (not short legitimate words like a/I)
  const absurd = item.options.filter(
    (o) => !o.isCorrect && /^(asdf|xxx|foo|zzz|qwerty|xxxx+)$/i.test(o.text.trim()),
  );
  if (absurd.length > 0) {
    issues.push({
      code: 'DISTRACTOR_ABSURD',
      severity: 'critical',
      message: 'One or more distractors are absurd / non-linguistic',
      dimension: 'distractorQuality',
    });
    scores.distractorQuality = 0.1;
  }

  // Construct registry level band check
  const construct = getEnConstruct(spec.construct);
  if (construct) {
    const t = cefrRank(spec.targetLevel);
    if (t < cefrRank(construct.minLevel) || t > cefrRank(construct.maxLevel)) {
      issues.push({
        code: 'CONSTRUCT_MISMATCH_SUSPECT',
        severity: 'critical',
        message: `targetLevel ${spec.targetLevel} outside construct band ${construct.minLevel}–${construct.maxLevel}`,
        dimension: 'constructValidity',
      });
      scores.constructValidity = 0.25;
    }
    if (!construct.allowedItemTypes.includes(spec.itemType)) {
      issues.push({
        code: 'CONSTRUCT_MISMATCH_SUSPECT',
        severity: 'warning',
        message: `itemType ${spec.itemType} not in construct allowedItemTypes`,
        dimension: 'constructValidity',
      });
      scores.constructValidity = Math.min(scores.constructValidity, 0.55);
    }
  } else if (spec.language === 'en' || spec.language === 'english') {
    issues.push({
      code: 'CONSTRUCT_MISMATCH_SUSPECT',
      severity: 'warning',
      message: `Unknown construct id ${spec.construct}`,
      dimension: 'constructValidity',
    });
  }

  // CEFR plausibility via reading load vs level
  const profile = enLevelProfile(spec.targetLevel);
  const words = wordCount(item.stem);
  if (words > profile.operational.maxStemWords) {
    issues.push({
      code: 'CEFR_MISMATCH_SUSPECT',
      severity: 'critical',
      message: `Reading load ${words} words exceeds ${spec.targetLevel} cap ${profile.operational.maxStemWords}`,
      dimension: 'levelPlausibility',
    });
    scores.levelPlausibility = 0.2;
  }

  // Target high but content looks very simple (A2-like for B2+)
  if (cefrRank(spec.targetLevel) >= cefrRank('B2') && words > 0 && words <= 8) {
    const hasComplexMarker =
      /\b(would have|had been|had lost|must have|were \w+|not until|whereby|notwithstanding|albeit|wish I had)\b/i.test(
        blob,
      );
    if (!hasComplexMarker && spec.skill === 'grammar') {
      issues.push({
        code: 'CEFR_MISMATCH_SUSPECT',
        severity: 'critical',
        message: 'Claimed B2+ but linguistic demand looks much lower',
        dimension: 'levelPlausibility',
      });
      scores.levelPlausibility = Math.min(scores.levelPlausibility, 0.3);
    }
  }

  // Target A2 but C1 reading
  if (cefrRank(spec.targetLevel) <= cefrRank('A2') && words >= enLevelProfile('C1').operational.maxStemWords * 0.5) {
    issues.push({
      code: 'CEFR_MISMATCH_SUSPECT',
      severity: 'critical',
      message: 'Low target level with high reading load (contamination)',
      dimension: 'levelPlausibility',
    });
    scores.levelPlausibility = 0.15;
  }

  // Ambiguity markers (avoid false hits on words like "both" in content summaries)
  if (
    /\b(either option|depending on|could also be|also correct|both (should|must|can|could)|several could)\b/i.test(
      item.explanation,
    )
  ) {
    issues.push({
      code: 'AMBIGUITY_SUSPECT',
      severity: 'critical',
      message: 'Explanation admits multiple acceptable answers',
      dimension: 'unambiguity',
    });
    scores.unambiguity = 0.15;
  }

  if (/\b(not|never|no|none|neither)\b/i.test(item.stem)) {
    const negCount = (item.stem.match(/\b(not|never|no|none|neither|unless|without)\b/gi) ?? []).length;
    if (negCount >= 3) {
      issues.push({
        code: 'NEGATION_OVERLOAD',
        severity: 'critical',
        message: 'Excessive negation / trick framing',
        dimension: 'unambiguity',
      });
      scores.unambiguity = Math.min(scores.unambiguity, 0.3);
    }
  }

  if (
    /\b(trick|gotcha|catch)\b/i.test(item.explanation) ||
    /\b(gotcha|trick)\b/i.test(item.stem) ||
    /\bEXCEPT\b/.test(item.stem)
  ) {
    issues.push({
      code: 'TRICK_QUESTION_SUSPECT',
      severity: 'critical',
      message: 'Trick-question / EXCEPT framing unsuitable for placement scoring',
      dimension: 'unambiguity',
    });
    scores.unambiguity = Math.min(scores.unambiguity, 0.25);
  }

  if (/\b(he|she|they|it|this|that)\b/i.test(item.stem) && /\bunclear who|ambiguous pronoun\b/i.test(item.explanation)) {
    issues.push({
      code: 'PRONOUN_AMBIGUITY',
      severity: 'critical',
      message: 'Ambiguous pronoun reference',
      dimension: 'unambiguity',
    });
    scores.unambiguity = 0.2;
  }

  if (/\b(yesterday|tomorrow|last week)\b/i.test(item.stem) && /\bno clear time|tense unclear\b/i.test(item.explanation)) {
    issues.push({
      code: 'TENSE_AMBIGUITY',
      severity: 'critical',
      message: 'Ambiguous tense context',
      dimension: 'unambiguity',
    });
    scores.unambiguity = 0.25;
  }

  // Vocabulary item solved by grammar/morphology cue
  if (
    spec.skill === 'vocabulary' &&
    item.options.filter((o) => /(?:ing|ed|s)$/i.test(o.text.trim())).length >= 3
  ) {
    issues.push({
      code: 'CUEING_SUSPECT',
      severity: 'critical',
      message: 'Vocabulary item may be solvable by morphology alone',
      dimension: 'cueResistance',
    });
    scores.cueResistance = Math.min(scores.cueResistance, 0.25);
  }

  // Grammar item keyed by rare vocabulary rather than form
  if (
    spec.skill === 'grammar' &&
    /\b(rare word|obscure|lexis is the key|vocabulary cue)\b/i.test(item.explanation)
  ) {
    issues.push({
      code: 'CONSTRUCT_MISMATCH_SUSPECT',
      severity: 'critical',
      message: 'Grammar item appears keyed by vocabulary rather than target construct',
      dimension: 'constructValidity',
    });
    scores.constructValidity = 0.2;
  }

  // Multiple plausible collocations admitted
  if (/\b(all collocate|both collocate|several could fit)\b/i.test(item.explanation)) {
    issues.push({
      code: 'MULTIPLE_PLAUSIBLE',
      severity: 'critical',
      message: 'Multiple collocations/options admitted as plausible',
      dimension: 'unambiguity',
    });
    scores.unambiguity = 0.1;
  }

  // Cultural trivia
  if (/\b(Thanksgiving|Guy Fawkes|Super Bowl|only in the US|British pub quiz)\b/i.test(blob)) {
    issues.push({
      code: 'CONTEXT_DEPENDENCE',
      severity: 'critical',
      message: 'Culturally specific knowledge required',
      dimension: 'contextIndependence',
    });
    scores.contextIndependence = 0.2;
  }

  const critical = issues.filter((i) => i.severity === 'critical');
  let verdict: SemanticReviewResult['verdict'] = 'pass';
  let suggestedAction: SemanticReviewResult['suggestedAction'] = 'accept';
  if (critical.length > 0) {
    verdict = 'reject';
    suggestedAction = 'reject';
  } else if (issues.some((i) => i.severity === 'warning')) {
    verdict = 'revise';
    suggestedAction = 'revise';
  }

  // Ensure scores reflect critical fails
  if (critical.some((i) => i.dimension === 'correctness')) scores.correctness = Math.min(scores.correctness, 0.2);
  if (critical.some((i) => i.dimension === 'unambiguity')) scores.unambiguity = Math.min(scores.unambiguity, 0.2);

  return {
    promptVersion: PROMPT_VERSIONS.en_semantic_review_v1,
    verdict,
    scores,
    issues,
    suggestedAction,
    notes: 'heuristic_semantic_v1',
  };
}

export function emptyScores(v = 0.5): QualityScores {
  return {
    correctness: v,
    unambiguity: v,
    constructValidity: v,
    levelPlausibility: v,
    distractorQuality: v,
    naturalness: v,
    cueResistance: v,
    contextIndependence: v,
  };
}

// silence unused if tree-shaken
void normalizeText;
