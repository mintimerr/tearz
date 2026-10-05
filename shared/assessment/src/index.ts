/**
 * @tearz/assessment — shared psychometric Assessment Engine.
 *
 * Single source of truth for client and server. LLM must never set CEFR / theta.
 */

export * from './types.js';
export * from './config.js';
export * from './prior.js';
export * from './scale.js';
export * from './irt.js';
export * from './posterior.js';
export * from './skill-profile.js';
export * from './confidence.js';
export * from './verification.js';
export * from './selector.js';
export * from './item-factory.js';
export * from './result.js';
export * from './engine.js';
export * from './simulation.js';
export * from './legacy-bridge.js';

/** Content specification + quality gate (separate from IRT engine). */
export * as items from './items/index.js';
export * as languages from './languages/index.js';
/** 15-item adaptive test orchestration. */
export * as orchestrator from './orchestrator/index.js';
/** Production placement wiring (UI adapter + session + versions). */
export * as placement from './placement/index.js';
