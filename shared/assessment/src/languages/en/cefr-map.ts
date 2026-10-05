/**
 * English provisional CEFR operational map for Tearz item generation.
 *
 * NOT an official CEFR specification. CEFR is a framework of can-do descriptors;
 * Tearz operational constructs below are an internal generation aid and must be
 * recalibrated against external CEFR-labelled materials.
 */

import type { LevelDemandProfile } from '../types.js';

export const EN_CEFR_DESCRIPTOR_DISCLAIMER =
  'Provisional Tearz operational mapping. Not an official or complete CEFR syllabus.';

export const EN_CEFR_MAP: LevelDemandProfile[] = [
  {
    level: 'A1',
    cefrDescriptorBasis:
      'Can understand and use familiar everyday expressions and very basic phrases.',
    demands: {
      vocabulary: 'High-frequency concrete words; personal details, numbers, food, places.',
      grammarMorphosyntax: 'Be/have; present simple; basic articles; simple imperatives.',
      sentenceComplexity: 'Single short clauses; little embedding.',
      readingLoad: '≤ ~20 words; familiar script; no dense paragraph.',
      inferenceDemand: 'None required; answer local and explicit.',
      pragmaticFunctional: 'Greetings, introductions, simple requests.',
      lexicalPrecision: 'Accept common near-synonyms; no fine shades.',
      registerSensitivity: 'Neutral / informal only.',
    },
    operational: {
      maxStemWords: 20,
      maxClauseDepth: 1,
      allowInference: false,
      allowIdioms: false,
      allowAbstractTopics: false,
      register: ['neutral', 'informal'],
    },
  },
  {
    level: 'A2',
    cefrDescriptorBasis:
      'Can communicate in simple routine tasks requiring a direct exchange of information.',
    demands: {
      vocabulary: 'Everyday topics; travel, shopping, family; limited collocations.',
      grammarMorphosyntax: 'Past simple; going to; comparatives; countable/uncountable basics.',
      sentenceComplexity: 'Coordination ok; light subordination (because/when).',
      readingLoad: '≤ ~35 words; short dialogues or notices.',
      inferenceDemand: 'Minimal; prefer explicit keys.',
      pragmaticFunctional: 'Orders, invitations, simple opinions.',
      lexicalPrecision: 'Basic sense distinctions only.',
      registerSensitivity: 'Neutral / informal.',
    },
    operational: {
      maxStemWords: 35,
      maxClauseDepth: 2,
      allowInference: false,
      allowIdioms: false,
      allowAbstractTopics: false,
      register: ['neutral', 'informal'],
    },
  },
  {
    level: 'B1',
    cefrDescriptorBasis:
      'Can deal with most situations likely to arise while travelling; describe experiences and plans.',
    demands: {
      vocabulary: 'Work/school/leisure; some abstract nouns; common phrasal verbs.',
      grammarMorphosyntax: 'Present perfect; conditionals 0/1; relative clauses; modals of advice.',
      sentenceComplexity: 'Multi-clause; controlled embedding.',
      readingLoad: '≤ ~55 words; short emails, blog posts.',
      inferenceDemand: 'Light contextual inference allowed.',
      pragmaticFunctional: 'Agree/disagree, soften requests, narrate.',
      lexicalPrecision: 'Choose among common near-synonyms.',
      registerSensitivity: 'Neutral; light formal cues.',
    },
    operational: {
      maxStemWords: 55,
      maxClauseDepth: 3,
      allowInference: true,
      allowIdioms: false,
      allowAbstractTopics: false,
      register: ['neutral', 'informal', 'formal'],
    },
  },
  {
    level: 'B2',
    cefrDescriptorBasis:
      'Can interact with fluency on a wide range of subjects; argue a viewpoint with support.',
    demands: {
      vocabulary: 'Wider abstract lexicon; discourse markers; mid-frequency collocations.',
      grammarMorphosyntax: 'Hypothetical/past conditionals; passives; reported speech; aspect contrasts.',
      sentenceComplexity: 'Complex sentences with clear focus; limited trickiness.',
      readingLoad: '≤ ~80 words; opinion paragraphs, workplace mail.',
      inferenceDemand: 'Moderate; may need pragmatic reading of intent.',
      pragmaticFunctional: 'Persuade, hedge, evaluate.',
      lexicalPrecision: 'Distinguish close synonyms in context.',
      registerSensitivity: 'Formal vs neutral distinctions matter.',
    },
    operational: {
      maxStemWords: 80,
      maxClauseDepth: 4,
      allowInference: true,
      allowIdioms: true,
      allowAbstractTopics: true,
      register: ['neutral', 'informal', 'formal'],
    },
  },
  {
    level: 'C1',
    cefrDescriptorBasis:
      'Can express ideas fluently and precisely; handle complex texts and implicit meaning.',
    demands: {
      vocabulary: 'Low-frequency academic/professional lexis; nuanced collocation.',
      grammarMorphosyntax: 'Inversion, clefting, advanced aspect/modality, nominalisation.',
      sentenceComplexity: 'Dense packaging; multiple embeddings ok if natural.',
      readingLoad: '≤ ~120 words; editorial/academic excerpts.',
      inferenceDemand: 'High; implicit stance/attitude.',
      pragmaticFunctional: 'Subtle hedging, irony awareness (careful in MCQ).',
      lexicalPrecision: 'Fine-grained synonym/register choice is the key.',
      registerSensitivity: 'Academic/professional register often decisive.',
    },
    operational: {
      maxStemWords: 120,
      maxClauseDepth: 5,
      allowInference: true,
      allowIdioms: true,
      allowAbstractTopics: true,
      register: ['neutral', 'formal', 'academic'],
    },
  },
  {
    level: 'C2',
    cefrDescriptorBasis:
      'Can understand virtually everything heard/read; summarise and reconstruct arguments precisely.',
    demands: {
      vocabulary: 'Near-native range including rare/literary items (use sparingly in MCQ).',
      grammarMorphosyntax: 'Full range; stylistic transformations; subtle aspectual contrasts.',
      sentenceComplexity: 'Highly complex but still natural; avoid puzzle-like traps.',
      readingLoad: '≤ ~160 words; sophisticated prose.',
      inferenceDemand: 'Very high; discourse-level.',
      pragmaticFunctional: 'Fine pragmatic control; cultural nuance with caution.',
      lexicalPrecision: 'Precision and style are central.',
      registerSensitivity: 'Register shifts may be the construct.',
    },
    operational: {
      maxStemWords: 160,
      maxClauseDepth: 6,
      allowInference: true,
      allowIdioms: true,
      allowAbstractTopics: true,
      register: ['neutral', 'formal', 'academic'],
    },
  },
];

export function enLevelProfile(level: LevelDemandProfile['level']): LevelDemandProfile {
  const found = EN_CEFR_MAP.find((x) => x.level === level);
  if (!found) throw new Error(`Missing EN CEFR profile for ${level}`);
  return found;
}
