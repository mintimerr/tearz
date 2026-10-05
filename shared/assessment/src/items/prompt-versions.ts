/** Versioned prompt IDs for generation / review pipelines. */

export const PROMPT_VERSIONS = {
  en_item_generation_v1: 'en_item_generation_v1',
  en_semantic_review_v1: 'en_semantic_review_v1',
  en_adversarial_review_v1: 'en_adversarial_review_v1',
} as const;

export type PromptVersionId = (typeof PROMPT_VERSIONS)[keyof typeof PROMPT_VERSIONS];
