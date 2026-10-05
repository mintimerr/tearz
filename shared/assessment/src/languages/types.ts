import type { AssessmentSkill, CefrLevel, ItemType } from '../types.js';

/**
 * CEFR is a framework, not an official Tearz grammar syllabus.
 * cefrDescriptorBasis = high-level capability sketches (provisional).
 * tearzOperationalConstructs = Tearz-internal operational topics for generation.
 */
export type CefrDemandAxis =
  | 'vocabulary'
  | 'grammarMorphosyntax'
  | 'sentenceComplexity'
  | 'readingLoad'
  | 'inferenceDemand'
  | 'pragmaticFunctional'
  | 'lexicalPrecision'
  | 'registerSensitivity';

export type LevelDemandProfile = {
  level: CefrLevel;
  /** Short provisional sketch — NOT an official CEFR checklist. */
  cefrDescriptorBasis: string;
  demands: Record<CefrDemandAxis, string>;
  /** Operational generation caps for Tearz. */
  operational: {
    maxStemWords: number;
    maxClauseDepth: number;
    allowInference: boolean;
    allowIdioms: boolean;
    allowAbstractTopics: boolean;
    register: Array<'neutral' | 'informal' | 'formal' | 'academic'>;
  };
};

export type ConstructEntry = {
  id: string;
  language: string;
  skill: AssessmentSkill;
  minLevel: CefrLevel;
  typicalLevel: CefrLevel;
  maxLevel: CefrLevel;
  prerequisites: string[];
  allowedItemTypes: ItemType[];
  description: string;
  /** Notes that difficulty depends on vocabulary/context/distractors. */
  difficultyNotes: string;
};

export type LanguagePack = {
  language: string;
  displayName: string;
  status: 'implemented' | 'stub';
  cefrMap: LevelDemandProfile[];
  constructs: ConstructEntry[];
  getConstruct(id: string): ConstructEntry | undefined;
};
