import { enLevelProfile } from '../../languages/en/cefr-map.js';
import { getLanguagePack } from '../../languages/index.js';
import type { DeterministicCheckResult, GeneratedItem } from '../types.js';
import {
  detectPromptInjection,
  hasForbiddenPlaceholder,
  hasMalformedUnicode,
  normalizeText,
  stripPunct,
  wordCount,
} from './normalize.js';

function fail(
  code: DeterministicCheckResult['code'],
  message: string,
  details?: Record<string, unknown>,
): DeterministicCheckResult {
  return { code, severity: 'fail', message, details };
}

function warn(
  code: DeterministicCheckResult['code'],
  message: string,
  details?: Record<string, unknown>,
): DeterministicCheckResult {
  return { code, severity: 'warning', message, details };
}

function pass(
  code: DeterministicCheckResult['code'],
  message: string,
): DeterministicCheckResult {
  return { code, severity: 'pass', message };
}

/** Run all deterministic quality checks. Content treated as untrusted quoted data. */
export function runDeterministicChecks(item: GeneratedItem): DeterministicCheckResult[] {
  const out: DeterministicCheckResult[] = [];
  const spec = item.specification;
  const texts = [
    item.stem,
    item.prompt,
    item.explanation,
    ...item.options.map((o) => o.text),
    item.correctAnswer,
  ];

  // --- format / structure ---
  if (!item.stem?.trim()) {
    out.push(fail('EMPTY_STEM', 'Stem is empty'));
  } else {
    out.push(pass('EMPTY_STEM', 'Stem present'));
  }

  if (!item.prompt?.trim()) {
    out.push(warn('EMPTY_PROMPT', 'Prompt is empty'));
  }

  if (spec.responseFormat === 'singleChoice' || spec.responseFormat === 'multiSelect') {
    const expected = spec.optionCount ?? 4;
    if (item.options.length !== expected) {
      out.push(
        fail('INVALID_OPTION_COUNT', `Expected ${expected} options, got ${item.options.length}`, {
          expected,
          actual: item.options.length,
        }),
      );
    } else {
      out.push(pass('INVALID_OPTION_COUNT', 'Option count matches'));
    }
  }

  if (spec.responseFormat === 'singleChoice') {
    const corrects = item.options.filter((o) => o.isCorrect);
    if (corrects.length === 0) {
      out.push(fail('NO_CORRECT_OPTION', 'No option marked isCorrect'));
    } else if (corrects.length > 1) {
      out.push(
        fail('MULTIPLE_CORRECT_STRUCTURE', `Expected one correct option, found ${corrects.length}`),
      );
    } else {
      out.push(pass('MULTIPLE_CORRECT_STRUCTURE', 'Exactly one correct flag'));
    }

    const marked = corrects[0]?.text;
    if (marked && normalizeText(marked) !== normalizeText(item.correctAnswer)) {
      out.push(
        fail(
          'CORRECT_ANSWER_MISSING',
          'correctAnswer does not match the option flagged isCorrect',
          { correctAnswer: item.correctAnswer, flagged: marked },
        ),
      );
    } else if (
      !item.options.some((o) => normalizeText(o.text) === normalizeText(item.correctAnswer))
    ) {
      out.push(fail('CORRECT_ANSWER_MISSING', 'correctAnswer not found among options'));
    } else {
      out.push(pass('CORRECT_ANSWER_MISSING', 'correctAnswer present in options'));
    }
  }

  if (spec.responseFormat === 'freeText' || spec.responseFormat === 'constructed') {
    if (item.options.length > 0) {
      out.push(
        fail('FORMAT_MISMATCH', `${spec.responseFormat} must not include MCQ options`),
      );
    }
  }

  // empty / duplicate options
  const seen = new Set<string>();
  const seenNorm = new Set<string>();
  for (const opt of item.options) {
    if (!opt.text?.trim()) {
      out.push(fail('EMPTY_OPTION', `Empty option ${opt.id}`));
      continue;
    }
    const raw = opt.text.trim();
    const norm = normalizeText(raw);
    if (seen.has(raw) || seenNorm.has(norm)) {
      out.push(fail('DUPLICATE_OPTION', `Duplicate option text: ${raw}`));
    }
    if (seenNorm.has(norm) && !seen.has(raw)) {
      out.push(fail('NORMALIZED_DUPLICATE_OPTION', `Normalized duplicate: ${raw}`));
    }
    seen.add(raw);
    seenNorm.add(norm);
  }
  if (item.options.length > 0 && !out.some((c) => c.code === 'DUPLICATE_OPTION' && c.severity === 'fail')) {
    out.push(pass('DUPLICATE_OPTION', 'No duplicate options'));
  }

  // unicode / placeholders / injection (treat as data)
  for (const t of texts) {
    if (!t) continue;
    if (hasMalformedUnicode(t)) {
      out.push(fail('MALFORMED_UNICODE', 'Malformed Unicode detected'));
      break;
    }
  }

  for (const t of texts) {
    if (!t) continue;
    if (hasForbiddenPlaceholder(t)) {
      out.push(fail('FORBIDDEN_PLACEHOLDER', 'Forbidden placeholder in item text', { sample: t.slice(0, 80) }));
      break;
    }
  }

  for (const t of texts) {
    if (!t) continue;
    const hit = detectPromptInjection(t);
    if (hit) {
      out.push(
        fail('PROMPT_INJECTION_PATTERN', 'Instruction/metadata leakage pattern in item content', {
          pattern: hit,
        }),
      );
      break;
    }
  }

  // metadata leakage
  const blob = texts.join('\n');
  if (
    /\b(targetLevel|difficultyWithinLevel|calibrationStatus|theta|IRT)\b/i.test(blob) ||
    /\bCEFR\s*[:=]\s*[ABC][12]\b/i.test(blob)
  ) {
    out.push(fail('METADATA_LEAKAGE', 'Psychometric/metadata leakage in learner-facing text'));
  }

  // answer leak in stem/prompt (blank stems must not reveal the key either)
  const key = normalizeText(item.correctAnswer);
  if (key.length >= 2) {
    const stemNorm = normalizeText(`${item.stem} ${item.prompt}`);
    const keyAsWord = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegExp(key)}([^\\p{L}\\p{N}]|$)`,
      'u',
    );
    if (keyAsWord.test(stemNorm)) {
      out.push(
        fail('ANSWER_LEAK', 'Correct answer text appears in stem/prompt', {
          correctAnswer: item.correctAnswer,
        }),
      );
    }
  }

  // explanation contradicts / leaks by saying wrong letter mapping badly
  if (item.explanation?.trim()) {
    const exp = normalizeText(item.explanation);
    const wrongOpts = item.options.filter((o) => !o.isCorrect).map((o) => normalizeText(o.text));
    // "correct answer is X" where X is a wrong option
    for (const w of wrongOpts) {
      if (
        w.length >= 2 &&
        (exp.includes(`answer is ${w}`) ||
          exp.includes(`correct is ${w}`) ||
          exp.includes(`correct answer is ${w}`))
      ) {
        out.push(fail('EXPLANATION_CONTRADICTS', 'Explanation points to a wrong option'));
        break;
      }
    }
    if (
      key.length >= 3 &&
      (exp.includes(`incorrect`) || exp.includes(`wrong`)) &&
      exp.includes(key) &&
      /incorrect|wrong/.test(exp) &&
      new RegExp(`(incorrect|wrong).{0,40}${escapeRegExp(key)}`).test(exp)
    ) {
      out.push(fail('EXPLANATION_CONTRADICTS', 'Explanation labels the correct answer as wrong'));
    }
  }

  // length cue: correct option much longer than others
  if (item.options.length >= 3) {
    const lengths = item.options.map((o) => o.text.trim().length);
    const correctLen =
      item.options.find((o) => o.isCorrect)?.text.trim().length ??
      item.options.find((o) => normalizeText(o.text) === key)?.text.trim().length;
    if (typeof correctLen === 'number') {
      const others = lengths.filter((l) => l !== correctLen);
      const meanOthers = others.reduce((a, b) => a + b, 0) / Math.max(1, others.length);
      const maxOthers = Math.max(...others, 0);
      if (correctLen >= meanOthers * 1.85 && correctLen >= maxOthers + 12) {
        out.push(
          fail('LENGTH_CUE', 'Correct option is a length outlier relative to distractors', {
            correctLen,
            meanOthers,
          }),
        );
      } else if (correctLen >= meanOthers * 1.5 && correctLen >= maxOthers + 8) {
        out.push(warn('LENGTH_CUE', 'Correct option may be length-cued', { correctLen, meanOthers }));
      }
    }
  }

  // grammatical form compatibility (heuristic for English MCQ endings)
  if ((spec.language === 'en' || spec.language === 'english') && item.options.length >= 2) {
    const forms = item.options.map((o) => classifyEnding(o.text));
    const dominant = mode(forms.filter((f) => f !== 'other'));
    if (dominant) {
      const correctForm = classifyEnding(
        item.options.find((o) => o.isCorrect)?.text ?? item.correctAnswer,
      );
      const mismatches = forms.filter((f) => f !== 'other' && f !== dominant).length;
      // If exactly one option has a different morphological class and it is correct → cue
      if (mismatches === 1 && correctForm !== 'other' && correctForm !== dominant) {
        out.push(
          fail(
            'GRAMMAR_FORM_MISMATCH',
            'Correct option has a unique grammatical form among options (agreement/form cue)',
          ),
        );
      }
    }
  }

  // synonymous options (very similar normalized tokens)
  if (item.options.length >= 2) {
    for (let i = 0; i < item.options.length; i += 1) {
      for (let j = i + 1; j < item.options.length; j += 1) {
        const a = stripPunct(item.options[i].text);
        const b = stripPunct(item.options[j].text);
        if (a && b && (a === b || (tokenJaccard(a, b) >= 0.95 && a.split(/\s+/).length >= 4))) {
          out.push(
            fail('SYNONYMOUS_OPTIONS', 'Options are near-identical / synonymous', {
              a: item.options[i].text,
              b: item.options[j].text,
            }),
          );
        }
      }
    }
  }

  // reading load vs specification / CEFR operational caps
  const stemWords = wordCount(item.stem);
  const maxLoad = spec.maxReadingLoad ?? inferMaxWords(spec.language, spec.targetLevel);
  if (stemWords > maxLoad) {
    out.push(
      fail('STEM_TOO_LONG', `Stem has ${stemWords} words; max ${maxLoad}`, {
        stemWords,
        maxLoad,
      }),
    );
  } else if (stemWords > maxLoad * 0.9) {
    out.push(warn('STEM_TOO_LONG', `Stem near reading-load cap (${stemWords}/${maxLoad})`));
  }

  const maxOpt =
    spec.generationConstraints?.maxOptionChars ??
    (spec.targetLevel === 'A1' || spec.targetLevel === 'A2' ? 40 : 80);
  for (const opt of item.options) {
    if (opt.text.trim().length > maxOpt) {
      out.push(
        fail('OPTION_TOO_LONG', `Option exceeds max chars (${opt.text.length}>${maxOpt})`, {
          id: opt.id,
        }),
      );
    }
  }

  if (spec.generationConstraints?.maxStemChars) {
    if (item.stem.length > spec.generationConstraints.maxStemChars) {
      out.push(
        fail('READING_LOAD_EXCEEDED', 'Stem exceeds generationConstraints.maxStemChars'),
      );
    }
  }

  // reading-load contamination heuristic for grammar items
  if (
    (spec.skill === 'grammar' || spec.itemType === 'grammarForm') &&
    stemWords > inferMaxWords(spec.language, spec.targetLevel) * 0.85
  ) {
    out.push(
      warn(
        'READING_LOAD_EXCEEDED',
        'Grammar item stem is near reading-load cap — risk of reading contamination',
      ),
    );
  }

  return out;
}

export function deterministicGatePassed(checks: DeterministicCheckResult[]): boolean {
  return !checks.some((c) => c.severity === 'fail');
}

function inferMaxWords(language: string, level: GeneratedItem['specification']['targetLevel']): number {
  const pack = getLanguagePack(language);
  if (pack?.status === 'implemented' && (language === 'en' || language === 'english')) {
    return enLevelProfile(level).operational.maxStemWords;
  }
  // conservative defaults if pack stub
  const defaults: Record<string, number> = {
    A1: 20,
    A2: 35,
    B1: 55,
    B2: 80,
    C1: 120,
    C2: 160,
  };
  return defaults[level] ?? 80;
}

function classifyEnding(text: string): 'ing' | 'ed' | 's' | 'ly' | 'en' | 'other' {
  const t = normalizeText(text).replace(/[^a-z']/g, '');
  if (t.endsWith('ing')) return 'ing';
  if (t.endsWith('ly')) return 'ly';
  if (t.endsWith('ed')) return 'ed';
  if (t.endsWith('en')) return 'en';
  if (t.endsWith('s') && t.length > 3) return 's';
  return 'other';
}

function mode(xs: string[]): string | null {
  if (xs.length === 0) return null;
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of counts) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}

function tokenJaccard(a: string, b: string): number {
  const A = new Set(a.split(/\s+/).filter(Boolean));
  const B = new Set(b.split(/\s+/).filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return inter / union;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
