/**
 * Language-aware naturalness — structural checks on stem + ALL options.
 * Not English-centric exact-phrase blacklists.
 */

import {
  classifyDistractorDefect,
  findBrokenFunctionalOptions,
  isGreetingNounAppend,
  isNonsenseCategoryClaim,
} from './distractor-helpers.js';
import { PROMPT_VERSIONS } from './prompt-versions.js';
import type { GeneratedItem, ReviewIssue, ReviewVerdict } from './types.js';

export type NaturalnessResult = {
  promptVersion: string;
  verdict: ReviewVerdict;
  issues: ReviewIssue[];
};

function result(promptVersion: string, issues: ReviewIssue[]): NaturalnessResult {
  const critical = issues.some((i) => i.severity === 'critical');
  return {
    promptVersion,
    verdict: critical ? 'reject' : issues.length ? 'revise' : 'pass',
    issues,
  };
}

function pushUnnatural(issues: ReviewIssue[], message: string, code: ReviewIssue['code'] = 'UNNATURAL_LANGUAGE') {
  issues.push({
    code,
    severity: 'critical',
    message,
    dimension: 'naturalness',
  });
}

function scanOptionsStructural(item: GeneratedItem, issues: ReviewIssue[]): void {
  const lang = item.language;
  const skill = item.specification.skill;
  for (const opt of item.options) {
    const defect = classifyDistractorDefect(opt.text, { language: lang, skill });
    if (defect) {
      pushUnnatural(
        issues,
        `Unnatural/broken option [${defect.class}]: "${opt.text}"`,
        defect.class === 'nonsense_category_claim' ? 'TRANSLATIONESE' : 'UNNATURAL_LANGUAGE',
      );
    }
  }
  if (skill === 'functional') {
    for (const b of findBrokenFunctionalOptions(
      item.options.map((o) => o.text),
      lang,
    )) {
      pushUnnatural(issues, `Functional option not natively utterable: "${b.text}"`);
    }
  }
}

export function reviewNaturalnessEn(item: GeneratedItem): NaturalnessResult {
  const issues: ReviewIssue[] = [];
  scanOptionsStructural(item, issues);
  const blob = [item.stem, ...item.options.map((o) => o.text)].join('\n');
  if (/\b(informations are|he goed|much peoples|I am agree)\b/i.test(blob)) {
    pushUnnatural(issues, 'Unnatural English wording in stem/options');
  }
  if (isGreetingNounAppend(item.stem) || isNonsenseCategoryClaim(item.stem)) {
    pushUnnatural(issues, 'Unnatural English stem');
  }
  return result(PROMPT_VERSIONS.naturalness_en_v3, issues);
}

export function reviewNaturalnessFr(item: GeneratedItem): NaturalnessResult {
  const issues: ReviewIssue[] = [];
  scanOptionsStructural(item, issues);
  const blob = [item.stem, ...item.options.map((o) => o.text)].join('\n');
  if (/bonjour\s+la\s+porte/i.test(blob)) {
    pushUnnatural(issues, 'Unnatural French option (greeting + door)', 'TRANSLATIONESE');
  }
  return result(PROMPT_VERSIONS.naturalness_fr_v3, issues);
}

export function reviewNaturalnessZh(item: GeneratedItem): NaturalnessResult {
  const issues: ReviewIssue[] = [];
  scanOptionsStructural(item, issues);
  const blob = [item.stem, ...item.options.map((o) => o.text)].join('\n');
  if (/周五是蔬菜|我是咖啡|午饭是椅子/.test(blob)) {
    pushUnnatural(issues, 'Calqued nonsense in Chinese', 'TRANSLATIONESE');
  }
  return result(PROMPT_VERSIONS.naturalness_zh_v3, issues);
}

export function reviewNaturalnessDe(item: GeneratedItem): NaturalnessResult {
  const issues: ReviewIssue[] = [];
  scanOptionsStructural(item, issues);
  const blob = [item.stem, ...item.options.map((o) => o.text)].join('\n');
  if (/Freitag ist Gemüse/i.test(blob)) {
    pushUnnatural(issues, 'Calqued nonsense in German', 'TRANSLATIONESE');
  }
  return result(PROMPT_VERSIONS.naturalness_de_v3, issues);
}

export function reviewNaturalnessRu(item: GeneratedItem): NaturalnessResult {
  const issues: ReviewIssue[] = [];
  scanOptionsStructural(item, issues);
  const blob = [item.stem, ...item.options.map((o) => o.text)].join('\n');
  if (/о участии/.test(blob) && /ответ/i.test(blob)) {
    issues.push({
      code: 'GOVERNMENT_ERROR',
      severity: 'critical',
      message: 'Unnatural government: «ответ … о участии»',
      dimension: 'naturalness',
    });
  }
  if (/здесь не есть/i.test(blob)) {
    pushUnnatural(issues, 'Unnatural Russian: «здесь не есть»');
  }
  return result(PROMPT_VERSIONS.naturalness_ru_v3, issues);
}

export function reviewNaturalness(item: GeneratedItem): NaturalnessResult {
  const lang = item.language.trim().toLowerCase();
  if (lang === 'fr' || lang === 'french') return reviewNaturalnessFr(item);
  if (lang === 'zh' || lang === 'chinese' || lang === 'zh-cn') return reviewNaturalnessZh(item);
  if (lang === 'de' || lang === 'german') return reviewNaturalnessDe(item);
  if (lang === 'ru' || lang === 'russian') return reviewNaturalnessRu(item);
  return reviewNaturalnessEn(item);
}
