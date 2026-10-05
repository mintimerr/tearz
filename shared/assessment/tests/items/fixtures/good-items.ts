import { mcq, spec } from './helpers.js';
import type { GeneratedItem } from '../../../src/items/types.js';

export type GoodCase = {
  id: string;
  level: string;
  item: GeneratedItem;
};

export const GOOD_ITEMS: GoodCase[] = [
  {
    id: 'good-a1-be',
    level: 'A1',
    item: mcq({
      id: 'good-a1-be',
      specification: spec({
        construct: 'en.grammar.be_present',
        targetLevel: 'A1',
        skill: 'grammar',
        difficultyWithinLevel: 0.4,
      }),
      stem: 'I ____ a teacher.',
      options: ['am', 'is', 'are', 'be'],
      correctIndex: 0,
      explanation: 'With I, use am.',
    }),
  },
  {
    id: 'good-a1-vocab',
    level: 'A1',
    item: mcq({
      id: 'good-a1-vocab',
      specification: spec({
        construct: 'en.vocab.everyday_nouns',
        targetLevel: 'A1',
        skill: 'vocabulary',
        itemType: 'vocabularyChoice',
      }),
      stem: 'I drink ____ in the morning.',
      options: ['coffee', 'chair', 'shoe', 'window'],
      correctIndex: 0,
      explanation: 'Coffee is a common drink.',
    }),
  },
  {
    id: 'good-a1-present-simple',
    level: 'A1',
    item: mcq({
      id: 'good-a1-present-simple',
      specification: spec({
        construct: 'en.grammar.present_simple',
        targetLevel: 'A1',
        difficultyWithinLevel: 0.55,
      }),
      stem: 'She ____ in London.',
      options: ['lives', 'live', 'living', 'lived'],
      correctIndex: 0,
      explanation: 'Third person singular takes -s.',
    }),
  },
  {
    id: 'good-a2-past',
    level: 'A2',
    item: mcq({
      id: 'good-a2-past',
      specification: spec({
        construct: 'en.grammar.past_simple',
        targetLevel: 'A2',
        difficultyWithinLevel: 0.5,
      }),
      stem: 'They ____ football yesterday.',
      options: ['played', 'play', 'playing', 'plays'],
      correctIndex: 0,
      explanation: 'Yesterday signals past simple.',
    }),
  },
  {
    id: 'good-a2-comparative',
    level: 'A2',
    item: mcq({
      id: 'good-a2-comparative',
      specification: spec({
        construct: 'en.grammar.comparatives',
        targetLevel: 'A2',
      }),
      stem: 'This bag is ____ than that one.',
      options: ['heavier', 'heavy', 'heaviest', 'more heavy'],
      correctIndex: 0,
      explanation: 'Comparative of heavy is heavier.',
    }),
  },
  {
    id: 'good-a2-functional',
    level: 'A2',
    item: mcq({
      id: 'good-a2-functional',
      specification: spec({
        construct: 'en.functional.polite_request',
        targetLevel: 'A2',
        skill: 'functional',
        itemType: 'functionalPhrase',
      }),
      stem: 'You want sugar in a cafe. What do you say?',
      options: [
        'Could I have some sugar, please?',
        'I am wanting the sugar immediately.',
        'You will give me sugar right now.',
        'Sugar must be given to me now.',
      ],
      correctIndex: 0,
      explanation: 'Polite request with could/please.',
    }),
  },
  {
    id: 'good-b1-present-perfect',
    level: 'B1',
    item: mcq({
      id: 'good-b1-present-perfect',
      specification: spec({
        construct: 'en.grammar.present_perfect',
        targetLevel: 'B1',
        difficultyWithinLevel: 0.55,
      }),
      stem: 'I ____ to Japan three times.',
      options: ['have been', 'was', 'had been', 'am'],
      correctIndex: 0,
      explanation: 'Experience up to now → present perfect.',
    }),
  },
  {
    id: 'good-b1-conditional',
    level: 'B1',
    item: mcq({
      id: 'good-b1-conditional',
      specification: spec({
        construct: 'en.grammar.conditionals_01',
        targetLevel: 'B1',
      }),
      stem: 'If it rains tomorrow, we ____ the picnic.',
      options: ['will cancel', 'would cancel', 'cancelled', 'had cancelled'],
      correctIndex: 0,
      explanation: 'First conditional: if + present, will + verb.',
    }),
  },
  {
    id: 'good-b1-modal',
    level: 'B1',
    item: mcq({
      id: 'good-b1-modal',
      specification: spec({
        construct: 'en.grammar.modals_advice',
        targetLevel: 'B1',
      }),
      stem: 'You look tired. You ____ go to bed early.',
      options: ['should', 'would', 'shall', 'might have'],
      correctIndex: 0,
      explanation: 'should for advice.',
    }),
  },
  {
    id: 'good-b1-reading',
    level: 'B1',
    item: mcq({
      id: 'good-b1-reading',
      specification: spec({
        construct: 'en.reading.main_idea_short',
        targetLevel: 'B1',
        skill: 'reading',
        itemType: 'readingComprehension',
        maxReadingLoad: 55,
      }),
      stem:
        'Local shops will close at 6 p.m. this Friday because of road works. Buses will use a different route until Monday.',
      prompt: 'What is the main idea?',
      options: [
        'Road works will disrupt shops and bus routes',
        'Shops will open later on every weekday',
        'City buses will be free all day Friday',
        'Monday becomes an official public holiday',
      ],
      correctIndex: 0,
      explanation: 'Shops and buses are affected by the road works.',
    }),
  },
  {
    id: 'good-b2-hypothetical',
    level: 'B2',
    item: mcq({
      id: 'good-b2-hypothetical',
      specification: spec({
        construct: 'en.grammar.hypothetical_past',
        targetLevel: 'B2',
        difficultyWithinLevel: 0.65,
        itemType: 'sentenceCompletion',
      }),
      stem: 'If she had left earlier, she ____ the train.',
      options: ['would have caught', 'will catch', 'would catch', 'caught'],
      correctIndex: 0,
      explanation: 'Third conditional: would have + past participle.',
    }),
  },
  {
    id: 'good-b2-passive',
    level: 'B2',
    item: mcq({
      id: 'good-b2-passive',
      specification: spec({
        construct: 'en.grammar.passive_voice',
        targetLevel: 'B2',
      }),
      stem: 'The results ____ yesterday.',
      options: ['were published', 'published', 'have publish', 'was publishing'],
      correctIndex: 0,
      explanation: 'Passive past: were + past participle.',
    }),
  },
  {
    id: 'good-b2-reported',
    level: 'B2',
    item: mcq({
      id: 'good-b2-reported',
      specification: spec({
        construct: 'en.grammar.reported_speech',
        targetLevel: 'B2',
      }),
      stem: 'She said she ____ the keys.',
      options: ['had lost', 'loses', 'is losing', 'will lost'],
      correctIndex: 0,
      explanation: 'Backshift to past perfect in reported speech.',
    }),
  },
  {
    id: 'good-b2-collocation',
    level: 'B2',
    item: mcq({
      id: 'good-b2-collocation',
      specification: spec({
        construct: 'en.vocab.collocations_mid',
        targetLevel: 'B2',
        skill: 'vocabulary',
        itemType: 'vocabularyChoice',
      }),
      stem: 'The committee will ____ a decision tomorrow.',
      options: ['reach', 'touch', 'hit', 'strike'],
      correctIndex: 0,
      explanation: 'reach a decision is the natural collocation here.',
    }),
  },
  {
    id: 'good-c1-modality',
    level: 'C1',
    item: mcq({
      id: 'good-c1-modality',
      specification: spec({
        construct: 'en.grammar.advanced_modality',
        targetLevel: 'C1',
        difficultyWithinLevel: 0.55,
      }),
      stem: 'He ____ the email by now; he left hours ago.',
      options: ['must have received', 'must receive', 'must to receive', 'must receiving'],
      correctIndex: 0,
      explanation: 'Epistemic perfect modal for deduction about the past.',
    }),
  },
  {
    id: 'good-c1-inversion',
    level: 'C1',
    item: mcq({
      id: 'good-c1-inversion',
      specification: spec({
        construct: 'en.grammar.inversion_cleft',
        targetLevel: 'C1',
      }),
      stem: '____ the report that we noticed the error.',
      options: [
        'Not until we reread',
        'Only after we already finish',
        'Hardly the team starts',
        'No sooner they begin',
      ],
      correctIndex: 0,
      explanation: 'Negative inversion after Not until.',
    }),
  },
  {
    id: 'good-c1-academic-vocab',
    level: 'C1',
    item: mcq({
      id: 'good-c1-academic-vocab',
      specification: spec({
        construct: 'en.vocab.academic_precision',
        targetLevel: 'C1',
        skill: 'vocabulary',
        itemType: 'vocabularyChoice',
      }),
      stem: 'The findings ____ previous research in the field.',
      options: ['corroborate', 'cook', 'borrow', 'decorate'],
      correctIndex: 0,
      explanation: 'corroborate = support with evidence.',
    }),
  },
  {
    id: 'good-c1-hedging',
    level: 'C1',
    item: mcq({
      id: 'good-c1-hedging',
      specification: spec({
        construct: 'en.functional.hedging_opinion',
        targetLevel: 'C1',
        skill: 'functional',
        itemType: 'functionalPhrase',
      }),
      stem: 'In a meeting, you want to soften disagreement. Best option:',
      options: [
        'I am not entirely convinced that this is the best approach.',
        'I completely reject your idea because it is worthless nonsense.',
        'I refuse to discuss this further under any circumstances today.',
        'I insist that everyone abandon this proposal without discussion.',
      ],
      correctIndex: 0,
      explanation: 'Hedged disagreement is appropriate in semi-formal contexts.',
    }),
  },
  {
    id: 'good-c2-reading-inference',
    level: 'C2',
    item: mcq({
      id: 'good-c2-reading-inference',
      specification: spec({
        construct: 'en.reading.inference_attitude',
        targetLevel: 'C2',
        skill: 'reading',
        itemType: 'readingComprehension',
        maxReadingLoad: 160,
      }),
      stem:
        'The reviewer praised the novel’s ambition, yet the faint praise reserved for its ending suggested that structural unevenness had undercut an otherwise compelling narrative.',
      prompt: 'The reviewer’s attitude toward the ending is best described as:',
      options: [
        'politely critical',
        'enthusiastically admiring',
        'completely indifferent',
        'openly mocking',
      ],
      correctIndex: 0,
      explanation: 'Faint praise and undercut imply polite criticism.',
    }),
  },
  {
    id: 'good-c2-precision',
    level: 'C2',
    item: mcq({
      id: 'good-c2-precision',
      specification: spec({
        construct: 'en.vocab.academic_precision',
        targetLevel: 'C2',
        skill: 'vocabulary',
        itemType: 'vocabularyChoice',
        difficultyWithinLevel: 0.7,
      }),
      stem: 'Her argument was ____; every claim followed from carefully weighed evidence.',
      options: ['cogent', 'loud', 'casual', 'decorative'],
      correctIndex: 0,
      explanation: 'cogent = clear, logical, convincing.',
    }),
  },
  {
    id: 'good-a2-articles',
    level: 'A2',
    item: mcq({
      id: 'good-a2-articles',
      specification: spec({
        construct: 'en.grammar.articles_basic',
        targetLevel: 'A2',
      }),
      stem: 'She bought ____ umbrella because it was raining.',
      options: ['an', 'a', 'the', 'some'],
      correctIndex: 0,
      explanation: 'an before vowel sound.',
    }),
  },
  {
    id: 'good-b2-sentence-completion',
    level: 'B2',
    item: mcq({
      id: 'good-b2-sentence-completion',
      specification: spec({
        construct: 'en.grammar.hypothetical_past',
        targetLevel: 'B2',
        itemType: 'sentenceCompletion',
        difficultyWithinLevel: 0.45,
      }),
      stem: 'I wish I ____ more time last week.',
      options: ['had had', 'have', 'would have', 'am having'],
      correctIndex: 0,
      explanation: 'wish + past perfect for past regrets.',
    }),
  },
];

export const GOOD_ITEM_COUNT = GOOD_ITEMS.length;
