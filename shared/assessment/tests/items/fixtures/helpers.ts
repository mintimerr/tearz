import type { GeneratedItem, ItemSpecification } from '../../../src/items/types.js';
import { PROMPT_VERSIONS } from '../../../src/items/prompt-versions.js';
import type { CefrLevel } from '../../../src/types.js';

export function spec(partial: Partial<ItemSpecification> & Pick<ItemSpecification, 'construct' | 'targetLevel'>): ItemSpecification {
  return {
    id: partial.id ?? `spec-${partial.construct}-${partial.targetLevel}`,
    language: partial.language ?? 'en',
    targetLevel: partial.targetLevel,
    difficultyWithinLevel: partial.difficultyWithinLevel ?? 0.5,
    skill: partial.skill ?? 'grammar',
    construct: partial.construct,
    itemType: partial.itemType ?? 'grammarForm',
    responseFormat: partial.responseFormat ?? 'singleChoice',
    optionCount: partial.optionCount ?? 4,
    contextDomain: partial.contextDomain ?? 'daily_life',
    register: partial.register ?? 'neutral',
    maxReadingLoad: partial.maxReadingLoad,
    generationConstraints: partial.generationConstraints ?? { avoidWorldKnowledge: true },
  };
}

export function mcq(input: {
  id: string;
  specification: ItemSpecification;
  stem: string;
  prompt?: string;
  options: [string, string, string, string] | string[];
  correctIndex: number;
  explanation: string;
  calibrationStatus?: 'provisional' | 'experimental';
}): GeneratedItem {
  const options = input.options.map((text, i) => ({
    id: String.fromCharCode(65 + i),
    text,
    isCorrect: i === input.correctIndex,
  }));
  return {
    id: input.id,
    specificationId: input.specification.id ?? input.id,
    language: input.specification.language,
    stem: input.stem,
    prompt: input.prompt ?? 'Choose the best answer.',
    options,
    correctAnswer: options[input.correctIndex]?.text ?? '',
    explanation: input.explanation,
    generationModel: 'fixture',
    generationPromptVersion: PROMPT_VERSIONS.en_item_generation_v1,
    generatedAt: 1,
    calibrationStatus: input.calibrationStatus ?? 'provisional',
    specification: input.specification,
  };
}

export function level(l: CefrLevel): CefrLevel {
  return l;
}
