/**
 * Synthetic eligible candidate bank for orchestrator tests/sims.
 * Items are treated as already quality-approved (PASS).
 */

import { CEFR_LEVELS, DEFAULT_ASSESSMENT_CONFIG, reliabilityForItem } from '../config.js';
import { createItemFromSpec } from '../item-factory.js';
import type { AssessmentConfig } from '../config.js';
import type {
  AssessmentSkill,
  CalibrationStatus,
  CefrLevel,
  ItemMeta,
} from '../types.js';
import type { OrchestratorCandidate } from './types.js';

const SKILLS: AssessmentSkill[] = ['grammar', 'vocabulary', 'reading', 'functional'];

const CONSTRUCTS: Record<AssessmentSkill, string[]> = {
  grammar: [
    'en.grammar.present_simple',
    'en.grammar.past_simple',
    'en.grammar.present_perfect',
    'en.grammar.hypothetical_past',
    'en.grammar.passive_voice',
    'en.grammar.conditionals_01',
  ],
  vocabulary: [
    'en.vocab.everyday_nouns',
    'en.vocab.collocations_mid',
    'en.vocab.academic_precision',
  ],
  reading: ['en.reading.main_idea_short', 'en.reading.inference_attitude'],
  functional: ['en.functional.polite_request', 'en.functional.hedging_opinion'],
  listening: ['en.listening.stub'],
  writing: ['en.writing.stub'],
  speaking: ['en.speaking.stub'],
};

function withinForLevel(i: number, n: number): number {
  return 0.2 + (i / Math.max(1, n - 1)) * 0.6;
}

export type BankOptions = {
  perLevelPerSkill?: number;
  calibrationStatus?: CalibrationStatus;
  includeExperimental?: number;
  assessmentConfig?: AssessmentConfig;
};

export function buildOrchestratorBank(opts: BankOptions = {}): OrchestratorCandidate[] {
  const per = opts.perLevelPerSkill ?? 3;
  const status = opts.calibrationStatus ?? 'calibrated';
  const config = opts.assessmentConfig ?? DEFAULT_ASSESSMENT_CONFIG;
  const out: OrchestratorCandidate[] = [];

  for (const level of CEFR_LEVELS) {
    for (const skill of SKILLS) {
      const constructs = CONSTRUCTS[skill];
      for (let i = 0; i < per; i += 1) {
        const construct = constructs[i % constructs.length];
        const within = withinForLevel(i, per);
        // Prefer anchor for mid B1 items (good Q1 pool)
        let calibrationStatus: CalibrationStatus = status;
        if (level === 'B1' && within >= 0.35 && within <= 0.5 && skill !== 'reading') {
          calibrationStatus = 'anchor';
        }
        // High C2 evidence pool
        if (level === 'C2' || level === 'C1') {
          calibrationStatus = status === 'provisional' ? 'calibrated' : status;
        }

        const item = createItemFromSpec(
          {
            id: `orch-${level}-${skill}-${i}-${construct.split('.').pop()}`,
            language: 'en',
            skill,
            construct,
            itemType:
              skill === 'reading'
                ? 'readingComprehension'
                : skill === 'vocabulary'
                  ? 'vocabularyChoice'
                  : skill === 'functional'
                    ? 'functionalPhrase'
                    : 'grammarForm',
            responseFormat: 'singleChoice',
            optionCount: 4,
            targetLevel: level,
            difficultyWithinLevel: within,
            isScored: true,
            calibrationStatus,
            source: 'procedural',
          },
          config,
        );
        out.push(toCandidate(item, config));
      }
    }
  }

  const nExp = opts.includeExperimental ?? 4;
  for (let i = 0; i < nExp; i += 1) {
    const level = CEFR_LEVELS[i % CEFR_LEVELS.length];
    const item = createItemFromSpec(
      {
        id: `orch-exp-${i}`,
        language: 'en',
        skill: 'grammar',
        construct: 'en.grammar.experimental_probe',
        itemType: 'grammarForm',
        responseFormat: 'singleChoice',
        optionCount: 4,
        targetLevel: level,
        difficultyWithinLevel: 0.5,
        isScored: false,
        calibrationStatus: 'experimental',
        source: 'ai',
      },
      config,
    );
    out.push(toCandidate(item, config));
  }

  return out;
}

export function toCandidate(
  item: ItemMeta,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
  qualityGate: OrchestratorCandidate['qualityGate'] = 'PASS',
): OrchestratorCandidate {
  const eligible = qualityGate === 'PASS' && item.status !== 'retired' && item.status !== 'draft';
  return {
    item,
    eligible,
    qualityGate,
    evidenceWeight: item.isScored
      ? reliabilityForItem(item.calibrationStatus, config)
      : 0,
    readingLoadWords: item.skill === 'reading' ? 40 + Math.round(item.difficultyWithinLevel * 80) : 12,
  };
}

/** Inject a rejected high-info decoy for invariant tests. */
export function withRejectedDecoy(
  bank: OrchestratorCandidate[],
  decoy: ItemMeta,
): OrchestratorCandidate[] {
  return [
    ...bank,
    {
      item: decoy,
      eligible: false,
      qualityGate: 'REJECT',
      evidenceWeight: 0,
    },
  ];
}
