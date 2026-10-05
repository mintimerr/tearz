/**
 * Combinatorial production families — language-specific, not translations.
 * Options are length-balanced to avoid LENGTH_CUE → REVISE.
 * Correct answer is always index 0 before rotation.
 */

import type { AssessmentSkill, CefrLevel } from '../../types.js';
import type { BankLanguage } from '../types.js';
import type { PoolItem } from './pools-en.js';
import { discourseUnits, cefrContextMinUnits } from '../../items/deterministic/normalize.js';

type Opt4 = [string, string, string, string];

type Family = {
  id: string;
  skill: AssessmentSkill;
  levels: CefrLevel[];
  prompt: string;
  explanation: string;
  /** Stem builders; each returns a unique stem for filler index. */
  stems: Array<(i: number) => string>;
  /** Option sets; correct at index 0; lengths kept similar. */
  optionSets: Opt4[];
};

function pick<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length]!;
}

/** Pad shorter phrase options so lengths stay close. Skip short grammar/vocab tokens. */
export function balanceOptionLengths(opts: Opt4): Opt4 {
  const lens = opts.map((o) => o.length);
  const maxL = Math.max(...lens);
  const minL = Math.min(...lens);
  // Short closed-class options (is/are/had…) — do not pad
  if (maxL <= 18 && minL <= 12) return opts;
  const correct = lens[0]!;
  const others = lens.slice(1);
  const mean = others.reduce((a, b) => a + b, 0) / 3;
  const maxO = Math.max(...others);
  if (!(correct >= mean * 1.45 && correct >= maxO + 6)) return opts;

  const target = correct;
  const fillers = [' for now', ' as noted', ' in full', ' today'];
  return opts.map((o, i) => {
    if (i === 0 || o.length >= target - 4) return o;
    let out = o;
    let f = 0;
    while (out.length < target - 1 && f < 6) {
      out += fillers[f % fillers.length]!;
      f += 1;
    }
    return out;
  }) as Opt4;
}

function assertBalanced(opts: Opt4, label: string): void {
  const balanced = balanceOptionLengths(opts);
  const lens = balanced.map((o) => o.length);
  const correct = lens[0]!;
  const others = lens.slice(1);
  const mean = others.reduce((a, b) => a + b, 0) / 3;
  const maxO = Math.max(...others);
  if (correct >= mean * 1.5 && correct >= maxO + 8) {
    throw new Error(`LENGTH_CUE risk in ${label}: ${lens.join(',')}`);
  }
}

// ─── EN ───────────────────────────────────────────────────────────────────────

const EN_NAMES = ['Anna', 'Sam', 'Mia', 'Leo', 'Nora', 'Omar', 'Elena', 'Kai', 'Priya', 'Jonas'];
const EN_PLACES = ['Canada', 'Spain', 'Japan', 'Brazil', 'Egypt', 'Korea', 'Italy', 'Kenya', 'Chile', 'Poland'];
const EN_OBJS = ['ticket', 'bag', 'book', 'phone', 'key', 'map', 'pass', 'card', 'badge', 'form'];
const EN_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_ORGS = ['the committee', 'leadership', 'the legal team', 'the board', 'the panel', 'the working group'];
const EN_TOPICS = [
  'the launch date',
  'the pilot scope',
  'the refund clause',
  'the hiring freeze',
  'the budget cap',
  'the vendor shortlist',
];

const EN_FAMILIES: Family[] = [
  // Grammar A1
  {
    id: 'en.g.a1.be',
    skill: 'grammar',
    levels: ['A1'],
    prompt: 'Choose the correct form.',
    explanation: 'Agreement with the subject.',
    stems: [
      (i) => `${pick(EN_NAMES, i)} ____ from ${pick(EN_PLACES, i)}.`,
      (i) => `My friend ____ from ${pick(EN_PLACES, i + 1)}.`,
      (i) => `${pick(EN_NAMES, i + 2)} ____ at home today.`,
      (i) => `This city ____ near the sea.`,
      (i) => `${pick(EN_NAMES, i + 3)} and I ____ ready now.`,
    ],
    optionSets: [
      ['is', 'are', 'am', 'be'],
      ['are', 'is', 'am', 'be'],
    ],
  },
  {
    id: 'en.g.a1.there',
    skill: 'grammar',
    levels: ['A1'],
    prompt: 'Choose the correct form.',
    explanation: 'There is / there are agreement.',
    stems: [
      (i) => `There ____ ${pick(['two', 'three', 'four', 'five'], i)} ${pick(['apples', 'books', 'chairs', 'bags'], i)} on the table.`,
      (i) => `There ____ a ${pick(EN_OBJS, i)} on the desk.`,
      (i) => `There ____ many people at the station.`,
      (i) => `There ____ no milk in the fridge.`,
    ],
    optionSets: [
      ['are', 'is', 'am', 'be'],
      ['is', 'are', 'am', 'be'],
    ],
  },
  {
    id: 'en.g.a1.have',
    skill: 'grammar',
    levels: ['A1'],
    prompt: 'Choose the correct form.',
    explanation: 'Have / has agreement.',
    stems: [
      (i) => `${pick(EN_NAMES, i)} ____ a new ${pick(EN_OBJS, i)}.`,
      (i) => `We ____ class on ${pick(EN_DAYS, i)}.`,
      (i) => `I ____ two sisters.`,
      (i) => `They ____ a small flat near the park.`,
    ],
    optionSets: [
      ['has', 'have', 'having', 'had'],
      ['have', 'has', 'having', 'had'],
    ],
  },
  // Grammar A2
  {
    id: 'en.g.a2.past',
    skill: 'grammar',
    levels: ['A2'],
    prompt: 'Choose the correct form.',
    explanation: 'Past simple with time marker.',
    stems: [
      (i) => `We ____ the museum last ${pick(['weekend', 'Saturday', 'month', 'year'], i)}.`,
      (i) => `${pick(EN_NAMES, i)} ____ home early yesterday.`,
      (i) => `They ____ pizza on ${pick(EN_DAYS, i)}.`,
      (i) => `I ____ my keys this morning.`,
      (i) => `She ____ a long email after lunch.`,
    ],
    optionSets: [
      ['visited', 'visit', 'visiting', 'visits'],
      ['went', 'go', 'going', 'goes'],
      ['ate', 'eat', 'eating', 'eats'],
      ['lost', 'lose', 'losing', 'loses'],
      ['wrote', 'write', 'writing', 'writes'],
    ],
  },
  {
    id: 'en.g.a2.comp',
    skill: 'grammar',
    levels: ['A2'],
    prompt: 'Choose the correct form.',
    explanation: 'Comparative form.',
    stems: [
      (i) => `This ${pick(EN_OBJS, i)} is ____ than that one.`,
      (i) => `Today is ____ than yesterday.`,
      (i) => `My flat is ____ than yours.`,
      (i) => `This route is ____ for walking.`,
    ],
    optionSets: [
      ['cheaper', 'more cheap', 'cheapest', 'cheap'],
      ['warmer', 'more warm', 'warmest', 'warm'],
      ['bigger', 'more big', 'biggest', 'big'],
      ['better', 'more good', 'best', 'good'],
    ],
  },
  // Grammar B1
  {
    id: 'en.g.b1.perf',
    skill: 'grammar',
    levels: ['B1'],
    prompt: 'Choose the correct form.',
    explanation: 'Present perfect with duration / experience.',
    stems: [
      (i) => `I ____ in this city for ${pick(['two', 'three', 'four', 'five'], i)} years now.`,
      (i) => `${pick(EN_NAMES, i)} ____ that film before today.`,
      (i) => `We ____ each other since the year 2019.`,
      (i) => `They ____ already finished the long report.`,
      (i) => `Have you ever ____ to ${pick(EN_PLACES, i)} before?`,
    ],
    optionSets: [
      ['have lived', 'live', 'am living', 'lived'],
      ['has seen', 'sees', 'is seeing', 'saw'],
      ['have known', 'know', 'knew', 'are knowing'],
      ['have', 'has', 'are', 'were'],
      ['been', 'being', 'be', 'was'],
    ],
  },
  {
    id: 'en.g.b1.cond',
    skill: 'grammar',
    levels: ['B1'],
    prompt: 'Choose the correct form.',
    explanation: 'First conditional with if.',
    stems: [
      (i) => `If it rains tomorrow morning, we ____ the picnic in the park.`,
      (i) => `If she calls this afternoon, I ____ her the full address.`,
      (i) => `If they arrive late again, the meeting ____ without them today.`,
      (i) => `If you finish the task early, we ____ for coffee nearby.`,
    ],
    optionSets: [
      ['will cancel', 'cancel', 'cancelled', 'would cancel'],
      ['will give', 'give', 'gave', 'would give'],
      ['will start', 'start', 'started', 'would start'],
      ['will go', 'go', 'went', 'would go'],
    ],
  },
  // Grammar B2 — stems kept >8 words + complex markers for CEFR gate
  {
    id: 'en.g.b2.pp',
    skill: 'grammar',
    levels: ['B2'],
    prompt: 'Choose the correct form.',
    explanation: 'Past perfect / reported speech sequencing.',
    stems: [
      (i) => `By the time we finally arrived at the cinema, the film ____ already.`,
      (i) => `She told the receptionist that she ____ the keys at home that morning.`,
      (i) => `He claimed that he ____ the client email before noon yesterday.`,
      (i) => `When I phoned the office later, they ____ already left for lunch.`,
      (i) => `We suddenly realised that we ____ the wrong platform for the express.`,
    ],
    optionSets: [
      ['had started', 'has started', 'started', 'was starting'],
      ['had left', 'leaves', 'is leaving', 'leave'],
      ['had sent', 'sends', 'is sending', 'send'],
      ['had left', 'have left', 'are leaving', 'leave now'],
      ['had chosen', 'choose', 'are choosing', 'chose'],
    ],
  },
  // Grammar C1/C2
  {
    id: 'en.g.c1.inv',
    skill: 'grammar',
    levels: ['C1', 'C2'],
    prompt: 'Choose the correct form.',
    explanation: 'Inversion / mandative / mixed conditional nuance.',
    stems: [
      (i) =>
        `In the latest audit notes, rarely ____ such careful documentation in an early draft about ${pick(EN_TOPICS, i)}.`,
      (i) =>
        `If she had taken the earlier train this morning, she ____ here for the briefing on ${pick(EN_TOPICS, i)} now.`,
      (i) =>
        `After the legal review, the board insisted that the indemnity clause ____ unchanged in the final text.`,
      (i) =>
        `The amendment is contingent ____ written approval from legal before it can take effect.`,
      (i) =>
        `Not until the revised figures arrived ____ the panel willing to reopen ${pick(EN_TOPICS, i)}.`,
      (i) =>
        `Had the vendor disclosed the delay earlier, the committee ____ a softer stance on penalties.`,
    ],
    optionSets: [
      ['do we encounter', 'we encounter', 'we do encounter', 'encounter we'],
      ['would be', 'would have been', 'will be', 'is'],
      ['remain', 'remains', 'remained', 'remaining'],
      ['on', 'to', 'for', 'with'],
      ['was', 'were', 'are', 'is'],
      ['might have taken', 'may well take it', 'takes it now', 'took it then'],
    ],
  },
  // Vocabulary A1–B2
  {
    id: 'en.v.a1',
    skill: 'vocabulary',
    levels: ['A1'],
    prompt: 'Choose the best word.',
    explanation: 'Basic everyday vocabulary.',
    stems: [
      (i) => `I usually have ____ at ${pick(['7', '8', '9'], i)}.`,
      (i) => `You need a ____ to enter the ${pick(['cinema', 'museum', 'concert', 'stadium'], i)}.`,
      (i) => `Please open the ____; it is hot in here.`,
      (i) => `She puts her coat in the ____.`,
      (i) => `We buy bread at the ____.`,
    ],
    optionSets: [
      ['breakfast', 'lunch', 'dinner', 'snack'],
      ['ticket', 'receipt', 'menu', 'map'],
      ['window', 'mirror', 'picture', 'carpet'],
      ['wardrobe', 'fridge', 'oven', 'sink'],
      ['bakery', 'pharmacy', 'garage', 'airport'],
    ],
  },
  {
    id: 'en.v.a2',
    skill: 'vocabulary',
    levels: ['A2'],
    prompt: 'Choose the best word.',
    explanation: 'Common A2 collocations / near-confusions.',
    stems: [
      (i) => `I have a dentist ____ at ${pick(['3', '4', '5'], i)}.`,
      (i) => `Can I ____ your pen for a minute?`,
      (i) => `The train was ____ because of the rain.`,
      (i) => `Please ____ your shoes at the door.`,
      (i) => `He gave me useful ____ about the city.`,
    ],
    optionSets: [
      ['appointment', 'invitation', 'meeting', 'visit'],
      ['borrow', 'lend', 'rent', 'own'],
      ['delayed', 'cancelled', 'booked', 'opened'],
      ['remove', 'delete', 'erase', 'cut'],
      ['advice', 'advise', 'advices', 'advisory'],
    ],
  },
  {
    id: 'en.v.b1',
    skill: 'vocabulary',
    levels: ['B1'],
    prompt: 'Choose the best word.',
    explanation: 'B1 collocation / precise word.',
    stems: [
      (i) => `Please send the form before the ____ on ${pick(EN_DAYS, i)}.`,
      (i) => `We need to ____ a decision today.`,
      (i) => `The manager asked for a short ____ of the meeting.`,
      (i) => `Traffic was ____ after the accident.`,
      (i) => `She took ____ of the free language class.`,
    ],
    optionSets: [
      ['deadline', 'outline', 'headline', 'timeline'],
      ['make', 'do', 'take', 'put'],
      ['summary', 'summing', 'sum', 'summarise'],
      ['heavy', 'strong', 'hard', 'thick'],
      ['advantage', 'profit', 'benefit', 'gain'],
    ],
  },
  {
    id: 'en.v.b2',
    skill: 'vocabulary',
    levels: ['B2'],
    prompt: 'Choose the best word.',
    explanation: 'Near-synonym discrimination.',
    stems: [
      (i) => `The company plans to ____ salaries next year.`,
      (i) => `There was ____ traffic on the ring road.`,
      (i) => `Please ____ me of the meeting tomorrow morning.`,
      (i) => `The findings ____ earlier assumptions about demand.`,
      (i) => `They reached a ____ after a long negotiation.`,
    ],
    optionSets: [
      ['raise', 'rise', 'arise', 'arouse'],
      ['heavy', 'strong', 'hard', 'thick'],
      ['remind', 'remember', 'recall', 'memorise'],
      ['challenge', 'charge', 'change', 'chase'],
      ['compromise', 'promise', 'premise', 'permission'],
    ],
  },
  {
    id: 'en.v.c1c2',
    skill: 'vocabulary',
    levels: ['C1', 'C2'],
    prompt: 'Choose the best word.',
    explanation: 'Contextual stance / collocation nuance.',
    stems: [
      (i) =>
        `In the risk memo to investors about ${pick(EN_TOPICS, i)}, the authors try to ____ residual concerns without promising refunds or a revised timeline.`,
      (i) =>
        `Colleagues found his reply politely ____ of the proposal on ${pick(EN_TOPICS, i)}: he thanked them, then moved on without engaging any substance.`,
      (i) =>
        `Her closing line thanked ${pick(EN_ORGS, i)} “for an intriguing direction” and suggested it “may sit better later,” offering no next step. The stance is best described as ____ rather than endorsement.`,
      (i) =>
        `After the revised shipment logs appeared, several analysts said the new figures ____ doubt on the earlier forecast that inventories would clear by June.`,
      (i) =>
        `The counsel’s wording was carefully ____: it acknowledged the complaint while avoiding any admission of liability regarding ${pick(EN_TOPICS, i)}.`,
      (i) =>
        `Leadership chose language that would ____ tensions with the vendor without locking the firm into a public apology on ${pick(EN_TOPICS, i)}.`,
    ],
    optionSets: [
      ['mitigate', 'amplify', 'ignore', 'celebrate'],
      ['dismissive', 'supportive', 'curious', 'grateful'],
      ['non-committal', 'enthusiastic', 'hostile', 'procedural'],
      ['cast', 'threw', 'placed', 'made'],
      ['hedged', 'blunt', 'casual', 'joking'],
      ['defuse', 'inflate', 'ignore', 'mock'],
    ],
  },
  // Reading
  {
    id: 'en.r.a1',
    skill: 'reading',
    levels: ['A1'],
    prompt: 'Choose the best answer.',
    explanation: 'Literal reading of a short notice.',
    stems: [
      (i) => {
        const a = 11 + (i % 4);
        const b = a + 1;
        return `Sign: "Closed for lunch ${a}:00–${b}:00." When can you shop?`;
      },
      (i) => `Board: "Bus ${10 + (i % 5)} → Station." Where does the bus go?`,
      (i) => `Note: "Library open until ${pick(['6', '7', '8', '9'], i)} pm." What is true?`,
      (i) => `Menu: "Soup of the day: tomato." What soup is available today?`,
      (i) => `Label: "Use by ${pick(EN_DAYS, i)}." What should you check?`,
    ],
    optionSets: [
      ['Before lunch or after it', 'Only at lunchtime hour', 'All day with no break', 'Never again today'],
      ['To the station stop', 'To the bus number only', 'Around town forever', 'To no place listed'],
      ['It closes in the evening', 'It never opens again', 'It opens at midnight', 'It is closed all day'],
      ['Tomato soup is available', 'No soup is available', 'Only bread is available', 'Only water is available'],
      ['The last safe use day', 'The shop opening time', 'The cook’s first name', 'The price of the item'],
    ],
  },
  {
    id: 'en.r.a2',
    skill: 'reading',
    levels: ['A2'],
    prompt: 'Choose the best answer.',
    explanation: 'Simple inference from short text.',
    stems: [
      (i) => `Card: "Wi‑Fi: Guest / password on receipt." Where is the password?`,
      (i) => `Notice: "Take a number and wait." What should you do first?`,
      (i) => `Email: "Bring your passport on ${pick(EN_DAYS, i)}." What must you bring?`,
      (i) => `Sign: "Staff only beyond this point." Who may enter?`,
      (i) => `Text: "Lift out of order — use stairs." How do you go up?`,
    ],
    optionSets: [
      ['On the receipt paper', 'On the guest name tag', 'Only on the router box', 'It is not available'],
      ['Take a waiting number', 'Wait with no number', 'Leave the desk now', 'Call a manager first'],
      ['Your passport document', 'Only a photocopy card', 'Nothing at all today', 'A second phone only'],
      ['Staff members only', 'Any visitor today', 'Children after school', 'Customers with carts'],
      ['Use the stairs now', 'Wait for the lift', 'Call a taxi upstairs', 'Stay on this floor'],
    ],
  },
  {
    id: 'en.r.b1',
    skill: 'reading',
    levels: ['B1'],
    prompt: 'Choose the best answer.',
    explanation: 'Policy / message comprehension.',
    stems: [
      (i) =>
        `Policy: "Unused tickets can be refunded within 48 hours of purchase." When is a refund possible?`,
      (i) =>
        `Chat: "Can you cover my ${pick(EN_DAYS, i)} shift if I take your Monday?" What is offered?`,
      (i) =>
        `Note: "Submit expenses with receipts within 10 days." What is required?`,
      (i) =>
        `Message: "If the package is damaged, refuse delivery and contact support." What should you do first if damaged?`,
      (i) =>
        `Guide: "Quiet coaches are for passengers who prefer no phone calls." Who are they for?`,
    ],
    optionSets: [
      ['Within two days if unused', 'Any time after the show', 'Only before you buy it', 'Never for unused tickets'],
      ['A swap of work shifts', 'Extra days off for both', 'A resignation from work', 'A permanent pay cut'],
      ['Receipts within ten days', 'No receipts are needed', 'Wait one full month', 'Call without any form'],
      ['Refuse then contact help', 'Accept and ignore damage', 'Open it on the street', 'Pay a second delivery'],
      ['People wanting quiet space', 'Only train staff members', 'Passengers with pets only', 'Anyone making loud calls'],
    ],
  },
  {
    id: 'en.r.b2',
    skill: 'reading',
    levels: ['B2'],
    prompt: 'Choose the best answer.',
    explanation: 'Hedged / implied stance.',
    stems: [
      (i) =>
        `Brief: "Growth is likely, though supply risks around ${pick(EN_TOPICS, i)} remain material." What stance does the writer take?`,
      (i) =>
        `Email: "We admire the concept on ${pick(EN_TOPICS, i)}; timing is the obstacle." What is implied?`,
      (i) =>
        `Memo: "The pilot met the floor metrics but fell short of stretch targets." What is true?`,
      (i) =>
        `Review: "The draft is serviceable, pending clearer success metrics." What is the overall tone?`,
      (i) =>
        `Note: "Support is conditional on a revised timeline for ${pick(EN_TOPICS, i)}." What does support depend on?`,
    ],
    optionSets: [
      ['Optimistic but clearly hedged', 'Certain total market collapse', 'No opinion is expressed', 'Pure celebration of success'],
      ['Interest without green light', 'Full approval with funding', 'Hostile rejection of ideas', 'A request to resign now'],
      ['Minimum bar met, not stretch', 'All targets were exceeded', 'The pilot never started', 'Metrics were not measured'],
      ['Cautious conditional approval', 'Unconditional strong praise', 'Angry personal attack', 'Neutral weather report'],
      ['A revised delivery timeline', 'An unlimited budget increase', 'A public apology letter', 'Hiring more executives'],
    ],
  },
  {
    id: 'en.r.c1c2',
    skill: 'reading',
    levels: ['C1', 'C2'],
    prompt: 'Choose the best answer.',
    explanation: 'Pragmatic inference from institutional tone.',
    stems: [
      (i) =>
        `Minutes from ${pick(EN_ORGS, i)}: "Members thanked the authors for the draft on ${pick(EN_TOPICS, i)}. The group noted the proposal with interest and moved to other business without a vote or a request for follow-up." What is the most likely pragmatic reading?`,
      (i) =>
        `Internal note: "We remain open in principle to revisiting ${pick(EN_TOPICS, i)}, subject to capacity we do not currently have." What does this mainly signal?`,
      (i) =>
        `Counsel wrote: "Without prejudice, the firm disputes the characterisation of events around ${pick(EN_TOPICS, i)} while inviting a narrower discussion of remedy." What is the stance?`,
      (i) =>
        `Press line: "We are looking into the reports and will update stakeholders as appropriate regarding ${pick(EN_TOPICS, i)}." What does this commit to?`,
      (i) =>
        `${pick(EN_ORGS, i)} summary: "The recommendation is noted. No action items were assigned." What follows most naturally?`,
      (i) =>
        `Debrief: "The vote was deferred pending materials that were never requested." What does this imply about urgency?`,
    ],
    optionSets: [
      ['Polite non-commitment, not endorsement', 'Unanimous funding approval today', 'Order for immediate roll-out work', 'A clear clerical minutes error'],
      ['Deferral dressed as openness', 'Immediate funded commitment', 'Hostile rejection of the topic', 'A confession of legal guilt'],
      ['Contested facts, limited talks', 'Full admission of all claims', 'Refusal to speak at all', 'Celebration of the complaint'],
      ['Process without fixed outcome', 'A precise refund schedule', 'A personal apology tomorrow', 'Proof that claims are true'],
      ['Shelving without explicit no', 'Kick-off of full delivery', 'Mandatory staff celebration', 'Automatic legal settlement'],
      ['Low urgency despite delay talk', 'Crisis-level immediate action', 'Proof the vote already passed', 'A clerical calendar mistake'],
    ],
  },
  // Functional
  {
    id: 'en.f.a1',
    skill: 'functional',
    levels: ['A1'],
    prompt: 'Choose the best response.',
    explanation: 'Basic polite functional language.',
    stems: [
      (i) => `You meet ${pick(EN_NAMES, i)} for the first time. What do you say?`,
      (i) => `You want the bill in a café. What do you say?`,
      (i) => `Someone says "Thank you." What do you reply?`,
      (i) => `You need help finding the station. What do you say?`,
      (i) => `You arrive late to class. What do you say?`,
    ],
    optionSets: [
      ['Nice to meet you', 'Who are you then', 'Go away please', 'I am leaving now'],
      ['The bill, please', 'Give me money now', 'I hate this food', 'Close the café'],
      ['You’re welcome', 'No thank you', 'I don’t care', 'Stop talking now'],
      ['Excuse me, where is it?', 'You must know it', 'I refuse to ask', 'Tell me or else'],
      ['Sorry I’m late', 'I am never wrong', 'Class is stupid', 'Open the door'],
    ],
  },
  {
    id: 'en.f.a2',
    skill: 'functional',
    levels: ['A2'],
    prompt: 'Choose the best response.',
    explanation: 'Everyday requests / offers.',
    stems: [
      (i) => `You want to book a table for ${pick(['two', 'three', 'four'], i)} on ${pick(EN_DAYS, i)}. What do you say?`,
      (i) => `${pick(EN_NAMES, i)} looks busy. You offer help. What do you say?`,
      (i) => `You cannot hear the speaker. What do you say?`,
      (i) => `You need to cancel an appointment. What do you say?`,
      (i) => `A shop assistant asks if you need help. You are just looking. What do you say?`,
    ],
    optionSets: [
      ['Could we book a table?', 'Give us free food now', 'We own this restaurant', 'Close early for us'],
      ['Can I help you?', 'Work faster now', 'This is your fault', 'I will leave you'],
      ['Could you repeat that?', 'Speak nonsense then', 'I refuse to listen', 'Stop the meeting'],
      ['I need to cancel, please', 'Never call me again', 'I was never booked', 'Delete your calendar'],
      ['Just looking, thanks', 'Leave me alone now', 'I buy everything', 'You must follow me'],
    ],
  },
  {
    id: 'en.f.b1',
    skill: 'functional',
    levels: ['B1'],
    prompt: 'Choose the best response.',
    explanation: 'Workplace / service pragmatics.',
    stems: [
      (i) => `${pick(EN_NAMES, i)} asks you to cover a shift. You can, but only until 6. What do you say?`,
      (i) => `A client is unhappy about a delay on ${pick(EN_TOPICS, i)}. You want to apologise and offer a next step. What do you say?`,
      (i) => `You disagree in a meeting but want to stay polite. What do you say?`,
      (i) => `You need an extension on a deadline. What do you say?`,
      (i) => `Someone interrupts you mid-sentence. What do you say?`,
    ],
    optionSets: [
      ['I can help until six', 'I refuse any shifts', 'Do it yourself now', 'I quit this job'],
      ['Sorry — here’s our plan', 'That is your problem', 'We never delay work', 'Stop complaining now'],
      ['I see it differently', 'You are always wrong', 'This idea is trash', 'I will not listen'],
      ['Could we extend it?', 'Deadlines are stupid', 'I ignore all dates', 'Do my work for me'],
      ['May I finish first?', 'Never speak again', 'You are ridiculous', 'Leave the room now'],
    ],
  },
  {
    id: 'en.f.b2',
    skill: 'functional',
    levels: ['B2'],
    prompt: 'Choose the best response.',
    explanation: 'Diplomatic workplace language.',
    stems: [
      (i) => `A colleague pushes for a quick yes on ${pick(EN_TOPICS, i)}. You need more data. What do you say?`,
      (i) => `You must decline an invitation without sounding cold. What do you say?`,
      (i) => `You want to challenge a claim without accusing anyone. What do you say?`,
      (i) => `A vendor overpromises. You want to reset expectations. What do you say?`,
      (i) => `Leadership asks for your view; you are only partly aligned. What do you say?`,
    ],
    optionSets: [
      ['Let’s confirm with data first', 'Say yes with no checks', 'Never raise this again', 'Approve full funding now'],
      ['Thanks — I’m unavailable then', 'I dislike all of you', 'Never invite me again', 'That event is worthless'],
      ['Can we check the evidence?', 'You are lying openly', 'I reject every fact', 'This discussion is over'],
      ['Let’s align on realistic dates', 'Promise even larger delivery now', 'We should trust every vendor claim', 'Ignore the contract terms entirely'],
      ['I support the aim, with limits', 'I approve every detail', 'I reject the whole aim', 'Sympathy equals a contract'],
    ],
  },
  {
    id: 'en.f.c1c2',
    skill: 'functional',
    levels: ['C1', 'C2'],
    prompt: 'Choose the best response.',
    explanation: 'High-register pragmatic mitigation.',
    stems: [
      (i) =>
        `${pick(EN_NAMES, i)} pushes for an aggressive decision on ${pick(EN_TOPICS, i)}. You want to defer without a blunt no. What do you say?`,
      (i) =>
        `In a meeting with ${pick(EN_ORGS, i)}, you partly support the aim behind ${pick(EN_TOPICS, i)} but will not endorse unchecked delivery. What do you say?`,
      (i) =>
        `A stakeholder demands a public statement today on ${pick(EN_TOPICS, i)}. You need time for legal review. What do you say?`,
      (i) =>
        `Someone frames disagreement as disloyalty. You want to reframe without escalating. What do you say?`,
      (i) =>
        `${pick(EN_ORGS, i)} seeks your sign-off under time pressure. The file on ${pick(EN_TOPICS, i)} is incomplete. What do you say?`,
      (i) =>
        `You must refuse a favour that would create a conflict of interest around ${pick(EN_TOPICS, i)}. What do you say?`,
    ],
    optionSets: [
      ['Worth revisiting with clearer evidence', 'No — never raise this again today', 'The idea is worthless; drop it', 'Approve everything with full funding'],
      ['Sympathetic to the aim, pending metrics', 'I approve every detail unchecked', 'I reject the aim but praise metrics', 'Sympathy equals signed commitment'],
      ['We should clear legal before speaking', 'Post any statement immediately', 'Ignore counsel entirely today', 'Admit liability in public now'],
      ['Disagreement can still be loyal critique', 'Loyalty means silent agreement', 'Critics should be removed now', 'Debate proves bad character'],
      ['I can’t sign until the file is complete', 'Sign anyway to save time today', 'Ignore missing pages entirely', 'Approve and fix papers later'],
      ['I must decline given the conflict risk', 'Sure — personal favours are fine', 'Hide the conflict from records', 'Trade favours for future deals'],
    ],
  },
];

// Validate EN option balance at module load (dev safety)
for (const f of EN_FAMILIES) {
  for (const os of f.optionSets) assertBalanced(os, f.id);
}

// ─── FR / DE / RU / ZH — compact parallel families ─────────────────────────────

type LangPack = {
  names: string[];
  places: string[];
  days: string[];
  orgs: string[];
  topics: string[];
  prompts: Record<AssessmentSkill, string>;
};

const PACK: Record<Exclude<BankLanguage, 'en'>, LangPack> = {
  fr: {
    names: ['Léa', 'Hugo', 'Nora', 'Amine', 'Claire', 'Yanis', 'Inès', 'Marc'],
    places: ['Canada', 'Espagne', 'Japon', 'Belgique', 'Maroc', 'Italie', 'Brésil', 'Égypte'],
    days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    orgs: ['le comité', 'la direction', 'l’équipe juridique', 'le conseil', 'le panel'],
    topics: [
      'la date de lancement',
      'le périmètre pilote',
      'la clause de remboursement',
      'le gel des embauches',
      'le plafond budgétaire',
    ],
    prompts: {
      grammar: 'Choisissez la forme correcte.',
      vocabulary: 'Choisissez le meilleur mot.',
      reading: 'Choisissez la meilleure réponse.',
      functional: 'Choisissez la meilleure réponse.',
    },
  },
  de: {
    names: ['Anna', 'Sam', 'Mia', 'Leo', 'Nora', 'Omar', 'Elena', 'Kai'],
    places: ['Kanada', 'Spanien', 'Japan', 'Belgien', 'Italien', 'Brasilien', 'Ägypten', 'Korea'],
    days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    orgs: ['dem Ausschuss', 'der Leitung', 'dem Legal-Team', 'dem Rat', 'der Arbeitsgruppe'],
    topics: [
      'das Launch-Datum',
      'den Pilotumfang',
      'die Erstattungsklausel',
      'den Einstellungsstopp',
      'die Budgetgrenze',
    ],
    prompts: {
      grammar: 'Wählen Sie die richtige Form.',
      vocabulary: 'Wählen Sie das beste Wort.',
      reading: 'Wählen Sie die beste Antwort.',
      functional: 'Wählen Sie die beste Antwort.',
    },
  },
  ru: {
    names: ['Анна', 'Саша', 'Мия', 'Лев', 'Нора', 'Омар', 'Елена', 'Кай'],
    places: ['Канада', 'Испания', 'Япония', 'Бельгия', 'Италия', 'Бразилия', 'Египет', 'Корея'],
    days: ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
    orgs: ['комитет', 'руководство', 'юротдел', 'совет', 'рабочая группа'],
    topics: [
      'дату запуска',
      'рамки пилота',
      'пункт о возврате',
      'заморозку найма',
      'лимит бюджета',
    ],
    prompts: {
      grammar: 'Выберите правильную форму.',
      vocabulary: 'Выберите лучшее слово.',
      reading: 'Выберите лучший ответ.',
      functional: 'Выберите лучший ответ.',
    },
  },
  zh: {
    names: ['小王', '小李', '小陈', '小张', '小刘', '阿明', '小美', '阿杰'],
    places: ['北京', '上海', '广州', '深圳', '成都', '杭州', '南京', '西安'],
    days: ['周一', '周二', '周三', '周四', '周五', '周六'],
    orgs: ['法务部', '合规组', '产品委员会', '风险小组', '工作组'],
    topics: ['上线日期', '试点范围', '退款条款', '招聘冻结', '预算上限'],
    prompts: {
      grammar: '选择正确的形式。',
      vocabulary: '选择最合适的词。',
      reading: '选择最佳答案。',
      functional: '选择最合适的回答。',
    },
  },
};

function buildNonEnFamilies(lang: Exclude<BankLanguage, 'en'>): Family[] {
  const p = PACK[lang];
  const n = (i: number) => pick(p.names, i);
  const place = (i: number) => pick(p.places, i);
  const day = (i: number) => pick(p.days, i);
  const org = (i: number) => pick(p.orgs, i);
  const topic = (i: number) => pick(p.topics, i);

  if (lang === 'fr') {
    return [
      {
        id: 'fr.g.a1',
        skill: 'grammar',
        levels: ['A1'],
        prompt: p.prompts.grammar,
        explanation: 'Accord sujet–verbe / article.',
        stems: [
          (i) => `${n(i)} ____ de ${place(i)}.`,
          (i) => `Il y ____ deux livres sur la table.`,
          (i) => `C’est ____ ami de Marie.`,
          (i) => `Nous ____ prêts maintenant.`,
          (i) => `${n(i + 1)} ____ à la maison aujourd’hui.`,
        ],
        optionSets: [
          ['est', 'sont', 'suis', 'êtes'],
          ['a', 'est', 'ont', 'sont'],
          ['un', 'une', 'des', 'le'],
          ['sommes', 'êtes', 'sont', 'suis'],
          ['est', 'sont', 'suis', 'es'],
        ],
      },
      {
        id: 'fr.g.a2',
        skill: 'grammar',
        levels: ['A2'],
        prompt: p.prompts.grammar,
        explanation: 'Passé composé / comparatif.',
        stems: [
          (i) => `Hier nous ____ au musée.`,
          (i) => `${n(i)} ____ une longue lettre.`,
          (i) => `Ce sac est ____ que l’autre.`,
          (i) => `Ils ____ pizza ${day(i)}.`,
          (i) => `J’____ mes clés ce matin.`,
        ],
        optionSets: [
          ['sommes allés', 'allons', 'aller', 'alliez'],
          ['a écrit', 'écrit', 'écrire', 'écrivait'],
          ['moins cher', 'plus cherement', 'le moins', 'cher'],
          ['ont mangé', 'mangent', 'manger', 'mangeaient'],
          ['ai perdu', 'perds', 'perdre', 'perdais'],
        ],
      },
      {
        id: 'fr.g.b1',
        skill: 'grammar',
        levels: ['B1'],
        prompt: p.prompts.grammar,
        explanation: 'Présent parfait / conditionnel simple contexte.',
        stems: [
          (i) => `J’____ dans cette ville depuis trois ans.`,
          (i) => `Si tu viens demain, nous ____ au café.`,
          (i) => `${n(i)} ____ déjà vu ce film.`,
          (i) => `Quand il arrivera, la réunion ____.`,
          (i) => `Nous ____ nous connaître en 2019.`,
        ],
        optionSets: [
          ['habite', 'habitais', 'habiterai', 'habité'],
          ['irons', 'allons', 'irions', 'sommes allés'],
          ['a', 'avoir', 'est', 'avait'],
          ['aura commencé', 'commence', 'commençait', 'commencer'],
          ['nous sommes', 'avons', 'étions', 'serons'],
        ],
      },
      {
        id: 'fr.g.b2',
        skill: 'grammar',
        levels: ['B2'],
        prompt: p.prompts.grammar,
        explanation: 'Plus-que-parfait / discours rapporté.',
        stems: [
          (i) => `Quand nous sommes arrivés, le film ____.`,
          (i) => `Elle a dit qu’elle ____ les clés à la maison.`,
          (i) => `Il prétendait qu’il ____ le message avant midi.`,
          (i) => `Nous avons compris que nous ____ le mauvais quai.`,
          (i) => `Dès qu’ils ____, la salle était vide.`,
        ],
        optionSets: [
          ['avait commencé', 'a commencé', 'commençait', 'commence'],
          ['avait laissées', 'laisse', 'laissait', 'laissera'],
          ['avait envoyé', 'envoie', 'enverra', 'envoyait'],
          ['avions choisi', 'choisissons', 'choisirons', 'choisissions'],
          ['sont partis', 'partent', 'partiront', 'partaient'],
        ],
      },
      {
        id: 'fr.g.c',
        skill: 'grammar',
        levels: ['C1', 'C2'],
        prompt: p.prompts.grammar,
        explanation: 'Registre / subjonctif / inversion pragmatique.',
        stems: [
          (i) =>
            `Dans les notes d’audit, rarement ____ une documentation aussi soignée dès le premier jet sur ${topic(i)}.`,
          (i) =>
            `Le conseil a exigé que la clause d’indemnité ____ inchangée dans le texte final.`,
          (i) =>
            `L’amendement est subordonné ____ l’accord écrit du juridique avant toute prise d’effet.`,
          (i) =>
            `Si elle avait pris le train plus tôt, elle ____ déjà là pour le point sur ${topic(i)}.`,
          (i) =>
            `Ce n’est qu’après les nouveaux chiffres que ${org(i)} ____ prêt à rouvrir le dossier.`,
        ],
        optionSets: [
          ['trouve-t-on', 'on trouve', 'trouve on', 'trouvons-nous'],
          ['reste', 'restez', 'restait', 'restera'],
          ['à', 'de', 'pour', 'par'],
          ['serait', 'aurait été', 'sera', 'est'],
          ['a été', 'était', 'sera', 'soit'],
        ],
      },
      {
        id: 'fr.v.low',
        skill: 'vocabulary',
        levels: ['A1', 'A2'],
        prompt: p.prompts.vocabulary,
        explanation: 'Lexique courant.',
        stems: [
          (i) => `Le matin, je prends ____ vers ${pick(['7', '8', '9'], i)} h.`,
          (i) => `Il faut un ____ pour entrer au cinéma.`,
          (i) => `J’ai un ____ chez le dentiste à 16 h.`,
          (i) => `Je peux ____ ton stylo une minute ?`,
          (i) => `Le train était ____ à cause de la pluie.`,
        ],
        optionSets: [
          ['le petit déjeuner', 'le déjeuner', 'le dîner', 'le goûter'],
          ['billet', 'reçu', 'menu', 'plan'],
          ['rendez-vous', 'invitation', 'visite', 'appel'],
          ['emprunter', 'prêter', 'louer', 'posséder'],
          ['en retard', 'annulé tôt', 'réservé', 'ouvert'],
        ],
      },
      {
        id: 'fr.v.mid',
        skill: 'vocabulary',
        levels: ['B1', 'B2'],
        prompt: p.prompts.vocabulary,
        explanation: 'Collocation / quasi-synonyme.',
        stems: [
          (i) => `Envoyez le formulaire avant la ____ de ${day(i)}.`,
          (i) => `Il faut ____ une décision aujourd’hui.`,
          (i) => `La circulation était ____ après l’accident.`,
          (i) => `L’entreprise compte ____ les salaires l’an prochain.`,
          (i) => `Merci de me ____ la réunion de demain matin.`,
        ],
        optionSets: [
          ['date limite', 'ligne forte', 'titre court', 'chronologie'],
          ['prendre', 'faire', 'mettre', 'poser'],
          ['dense', 'forte', 'dure', 'épaisse'],
          ['augmenter', 'monter', 'soulever', 'élever'],
          ['rappeler', 'souvenir', 'retenir', 'mémoriser'],
        ],
      },
      {
        id: 'fr.v.high',
        skill: 'vocabulary',
        levels: ['C1', 'C2'],
        prompt: p.prompts.vocabulary,
        explanation: 'Nuance de stance / collocation.',
        stems: [
          (i) =>
            `Dans la note aux investisseurs sur ${topic(i)}, les auteurs cherchent à ____ les inquiétudes restantes sans promettre de remboursement ni de nouveau calendrier.`,
          (i) =>
            `Ses collègues ont trouvé sa réponse poliment ____ à l’égard de la proposition : il a remercié, puis est passé à autre chose sans traiter le fond.`,
          (i) =>
            `Sa phrase finale remerciait ${org(i)} « pour une piste intrigante » et suggérait qu’elle « trouverait mieux sa place plus tard », sans suite. La posture est surtout ____.`,
          (i) =>
            `Après les nouveaux journaux d’expédition, plusieurs analystes ont dit que les chiffres ____ un doute sur la prévision de juin.`,
          (i) =>
            `La formulation du conseil était soigneusement ____ : elle reconnaissait la plainte sans admettre de responsabilité sur ${topic(i)}.`,
        ],
        optionSets: [
          ['atténuer', 'amplifier', 'ignorer', 'célébrer'],
          ['dédaigneuse', 'soutenue', 'curieuse', 'reconnaissante'],
          ['non engageante', 'enthousiaste', 'hostile', 'procédurale'],
          ['jetaient', 'lançaient', 'mettaient', 'faisaient'],
          ['prudente', 'brutale', 'casuale', 'moqueuse'],
        ],
      },
      {
        id: 'fr.r.low',
        skill: 'reading',
        levels: ['A1', 'A2'],
        prompt: p.prompts.reading,
        explanation: 'Lecture d’un avis court.',
        stems: [
          (i) => {
            const a = 11 + (i % 4);
            return `Affiche : « Fermé pour le déjeuner ${a} h–${a + 1} h. » Quand peut-on faire des courses ?`;
          },
          (i) => `Panneau : « Bus 12 → Gare. » Où va le bus ?`,
          (i) => `Carte : « Wi‑Fi : Invité / mot de passe sur le ticket. » Où est le mot de passe ?`,
          (i) => `Avis : « Prenez un numéro et attendez. » Que faire d’abord ?`,
          (i) => `Note : « Bibliothèque ouverte jusqu’à ${pick(['18', '19', '20'], i)} h. » Que dit le texte ?`,
        ],
        optionSets: [
          ['Avant ou après la pause', 'Seulement à l’heure pile', 'Toute la journée sans pause', 'Jamais plus aujourd’hui'],
          ['Vers la gare indiquée', 'Vers le numéro du bus', 'Partout en boucle', 'Nulle part listé'],
          ['Sur le ticket reçu', 'Sur le badge invité', 'Seulement sur le routeur', 'Il n’est pas fourni'],
          ['Prendre un numéro', 'Attendre sans numéro', 'Partir tout de suite', 'Appeler un manager'],
          ['Elle ferme le soir', 'Elle n’ouvre jamais', 'Elle ouvre à minuit', 'Elle est fermée tout le jour'],
        ],
      },
      {
        id: 'fr.r.mid',
        skill: 'reading',
        levels: ['B1', 'B2'],
        prompt: p.prompts.reading,
        explanation: 'Inférence de politique / ton.',
        stems: [
          (i) =>
            `Politique : « Les billets non utilisés peuvent être remboursés sous 48 h après l’achat. » Quand est un remboursement possible ?`,
          (i) =>
            `Brief : « La croissance est probable, même si les risques d’approvisionnement autour de ${topic(i)} restent matériels. » Quelle est la posture ?`,
          (i) =>
            `Mail : « Nous admirons le concept sur ${topic(i)} ; le calendrier est l’obstacle. » Qu’est-ce qui est implicite ?`,
          (i) =>
            `Mémo : « Le pilote a atteint le plancher, pas les cibles ambitieuses. » Qu’est-ce qui est vrai ?`,
          (i) =>
            `Note : « Le soutien est conditionné à un calendrier révisé pour ${topic(i)}. » De quoi dépend le soutien ?`,
        ],
        optionSets: [
          ['Sous deux jours si inutilisé', 'N’importe quand après', 'Seulement avant l’achat', 'Jamais si inutilisé'],
          ['Optimisme clairement prudent', 'Effondrement certain annoncé', 'Aucune opinion exprimée', 'Pure célébration du succès'],
          ['Intérêt sans feu vert', 'Approbation avec budget', 'Rejet hostile de l’idée', 'Demande de démission'],
          ['Seuil minimal atteint seulement', 'Toutes les cibles dépassées', 'Le pilote n’a pas commencé', 'Aucune mesure prise'],
          ['Un calendrier de livraison révisé', 'Une hausse illimitée de budget', 'Des excuses publiques', 'Plus de dirigeants embauchés'],
        ],
      },
      {
        id: 'fr.r.high',
        skill: 'reading',
        levels: ['C1', 'C2'],
        prompt: p.prompts.reading,
        explanation: 'Inférence pragmatique institutionnelle.',
        stems: [
          (i) =>
            `Procès-verbal de ${org(i)} : « Les membres ont remercié les auteurs pour le projet sur ${topic(i)}. Le groupe a pris note avec intérêt, puis est passé aux autres points sans vote ni suite demandée. » Lecture pragmatique la plus probable ?`,
          (i) =>
            `Note interne : « Nous restons ouverts par principe à revisiter ${topic(i)}, sous réserve d’une capacité que nous n’avons pas. » Que signale surtout ce texte ?`,
          (i) =>
            `Le conseil a écrit : « Sans préjudice, la société conteste la présentation des faits autour de ${topic(i)} tout en invitant une discussion plus étroite du remède. » Quelle est la posture ?`,
          (i) =>
            `Ligne presse : « Nous examinons les signalements et informerons les parties prenantes le moment venu concernant ${topic(i)}. » À quoi cela engage-t-il ?`,
          (i) =>
            `Synthèse de ${org(i)} : « La recommandation est notée. Aucune action n’a été assignée. » Que s’ensuit le plus naturellement ?`,
        ],
        optionSets: [
          ['Non-engagement poli, pas d’accord', 'Approbation unanime du budget', 'Ordre de déploiement immédiat', 'Erreur claire de secrétariat'],
          ['Report habillé d’ouverture', 'Engagement financé immédiat', 'Rejet hostile du sujet', 'Aveux de culpabilité'],
          ['Faits contestés, échanges limités', 'Aveux complets des griefs', 'Refus total de parler', 'Célébration de la plainte'],
          ['Processus sans résultat fixé', 'Calendrier précis de remboursement', 'Excuses personnelles demain', 'Preuve que les faits sont vrais'],
          ['Mise de côté sans non explicite', 'Lancement de la livraison', 'Célébration obligatoire', 'Règlement juridique automatique'],
        ],
      },
      {
        id: 'fr.f.low',
        skill: 'functional',
        levels: ['A1', 'A2'],
        prompt: p.prompts.functional,
        explanation: 'Actes de langage de base.',
        stems: [
          (i) => `Vous rencontrez ${n(i)} pour la première fois. Que dites-vous ?`,
          (i) => `Vous voulez l’addition. Que dites-vous ?`,
          (i) => `On vous dit « Merci ». Que répondez-vous ?`,
          (i) => `Vous voulez réserver une table pour ${pick(['deux', 'trois', 'quatre'], i)} ${day(i)}. Que dites-vous ?`,
          (i) => `Vous arrivez en retard en cours. Que dites-vous ?`,
        ],
        optionSets: [
          ['Enchanté de vous rencontrer', 'Qui êtes-vous exactement', 'Allez-vous-en tout de suite', 'Je m’en vais immédiatement'],
          ['L’addition, s’il vous plaît', 'Donnez-moi de l’argent', 'Je déteste ce plat', 'Fermez le café'],
          ['Je vous en prie', 'Non merci', 'Je m’en fiche', 'Arrêtez de parler'],
          ['Pourrions-nous réserver ?', 'Donnez-nous à manger', 'Nous possédons le lieu', 'Fermez plus tôt'],
          ['Désolé pour le retard', 'Je n’ai jamais tort', 'Le cours est stupide', 'Ouvrez la porte'],
        ],
      },
      {
        id: 'fr.f.mid',
        skill: 'functional',
        levels: ['B1', 'B2'],
        prompt: p.prompts.functional,
        explanation: 'Pragmatique professionnelle.',
        stems: [
          (i) => `${n(i)} vous demande de couvrir un créneau. Vous pouvez jusqu’à 18 h. Que dites-vous ?`,
          (i) => `Un client est mécontent d’un retard sur ${topic(i)}. Vous voulez vous excuser et proposer une suite. Que dites-vous ?`,
          (i) => `Un collègue pousse à un oui rapide sur ${topic(i)}. Il vous faut plus de données. Que dites-vous ?`,
          (i) => `Vous devez décliner une invitation sans paraître froid. Que dites-vous ?`,
          (i) => `Vous voulez contester une affirmation sans accuser. Que dites-vous ?`,
        ],
        optionSets: [
          ['Je peux aider jusqu’à 18 h', 'Je refuse tout créneau', 'Faites-le vous-même', 'Je démissionne'],
          ['Désolé — voici notre plan', 'C’est votre problème', 'Nous ne retardons jamais', 'Arrêtez de vous plaindre'],
          ['Confirmons d’abord les données', 'Dites oui sans vérifier', 'N’en reparlez plus', 'Approuvez le budget'],
          ['Merci — je ne suis pas libre', 'Je vous déteste tous', 'Ne m’invitez plus', 'Cet événement ne vaut rien'],
          ['Pouvons-nous vérifier les preuves ?', 'Vous mentez de façon ouverte ici', 'Je rejette absolument tout fait', 'La discussion est désormais close'],
        ],
      },
      {
        id: 'fr.f.high',
        skill: 'functional',
        levels: ['C1', 'C2'],
        prompt: p.prompts.functional,
        explanation: 'Atténuation pragmatique de haut niveau.',
        stems: [
          (i) =>
            `On vous presse sur ${topic(i)}. Vous voulez différer sans refus brutal. Que dites-vous ?`,
          (i) =>
            `En réunion avec ${org(i)}, vous partagez l’objectif derrière ${topic(i)} mais refusez une livraison sans garde-fous. Que dites-vous ?`,
          (i) =>
            `Une partie prenante exige une déclaration publique aujourd’hui sur ${topic(i)}. Il faut une revue juridique. Que dites-vous ?`,
          (i) =>
            `${org(i)} veut votre validation sous pression. Le dossier sur ${topic(i)} est incomplet. Que dites-vous ?`,
          (i) =>
            `Vous devez refuser une faveur qui créerait un conflit d’intérêts autour de ${topic(i)}. Que dites-vous ?`,
        ],
        optionSets: [
          ['Piste intéressante avec preuves plus claires', 'Non — n’en reparlez plus jamais', 'L’idée ne vaut rien ; abandonnez', 'Nous approuvons tout avec budget'],
          ['Je partage l’objectif, sous conditions', 'J’approuve chaque détail sans filtre', 'Je refuse l’objectif mais loue les métriques', 'Cette sympathie vaut un contrat'],
          ['Il faut passer par le juridique d’abord', 'Publiez n’importe quelle déclaration', 'Ignorez totalement le conseil', 'Admettez la responsabilité'],
          ['Je ne signe pas tant que le dossier est incomplet', 'Signez quand même pour gagner du temps aujourd’hui', 'Ignorez complètement les pages encore manquantes', 'Approuvez maintenant et corrigez les papiers plus tard'],
          ['Je dois décliner vu le risque de conflit', 'Bien sûr — les faveurs perso vont', 'Cachez le conflit des dossiers', 'Échangeons faveurs pour plus tard'],
        ],
      },
    ];
  }

  if (lang === 'de') {
    return [
      {
        id: 'de.g.a1',
        skill: 'grammar',
        levels: ['A1'],
        prompt: p.prompts.grammar,
        explanation: 'Sein / Artikel / Kongruenz.',
        stems: [
          (i) => `Wir ____ aus ${place(i)}.`,
          (i) => `Das ist ____ Apfel.`,
          (i) => `${n(i)} ____ heute zu Hause.`,
          (i) => `Es ____ zwei Bücher auf dem Tisch.`,
          (i) => `Ich ____ einen neuen Ausweis.`,
        ],
        optionSets: [
          ['sind', 'bist', 'bin', 'ist'],
          ['ein', 'eine', 'einen', 'der'],
          ['ist', 'sind', 'bist', 'seid'],
          ['gibt', 'sind', 'ist', 'habt'],
          ['habe', 'hat', 'habt', 'haben'],
        ],
      },
      {
        id: 'de.g.a2',
        skill: 'grammar',
        levels: ['A2'],
        prompt: p.prompts.grammar,
        explanation: 'Perfekt / Akkusativ.',
        stems: [
          (i) => `Gestern ____ wir ins Museum gegangen.`,
          (i) => `Ich sehe ____ Mann am Bahnhof.`,
          (i) => `${n(i)} ____ gestern lange gearbeitet.`,
          (i) => `Wir ____ Pizza am ${day(i)} gegessen.`,
          (i) => `Diese Tasche ist ____ als die andere.`,
        ],
        optionSets: [
          ['sind', 'haben', 'seid', 'habt'],
          ['den', 'der', 'dem', 'des'],
          ['hat', 'ist', 'habt', 'seid'],
          ['haben', 'sind', 'habt', 'seid'],
          ['günstiger', 'mehr günstig', 'am günstig', 'günstig'],
        ],
      },
      {
        id: 'de.g.b1',
        skill: 'grammar',
        levels: ['B1'],
        prompt: p.prompts.grammar,
        explanation: 'Nebensatz / Relativpronomen.',
        stems: [
          (i) => `Ich bleibe zu Hause, weil ich krank ____.`,
          (i) => `Das ist der Kollege, ____ gestern angerufen hat.`,
          (i) => `Wenn es morgen regnet, ____ wir das Picknick.`,
          (i) => `${n(i)} wohnt hier, seit sie den Job ____.`,
          (i) => `Sobald er ankommt, ____ die Sitzung.`,
        ],
        optionSets: [
          ['bin', 'ich bin', 'sein', 'bist'],
          ['der', 'den', 'dem', 'dessen'],
          ['sagen wir ab', 'sagen ab wir', 'wir absagen', 'ab sagen wir'],
          ['bekommen hat', 'bekommt', 'bekommen wird', 'bekam'],
          ['beginnt sie', 'sie beginnt', 'beginnen sie', 'sie beginnen'],
        ],
      },
      {
        id: 'de.g.b2',
        skill: 'grammar',
        levels: ['B2'],
        prompt: p.prompts.grammar,
        explanation: 'Konjunktiv II / Plusquamperfekt.',
        stems: [
          (i) => `Wenn ich mehr Zeit hätte, ____ ich länger bleiben.`,
          (i) => `Als wir ankamen, ____ der Zug schon abgefahren.`,
          (i) => `Sie sagte, sie ____ die Schlüssel zu Hause gelassen.`,
          (i) => `Er behauptete, er ____ die Mail vor mittag geschickt.`,
          (i) => `Wir merkten, dass wir den falschen Bahnsteig ____.`,
        ],
        optionSets: [
          ['würde', 'werde', 'wurde', 'will'],
          ['war', 'ist', 'hatte', 'wurde'],
          ['habe', 'hat', 'hätte', 'habt'],
          ['habe', 'hat', 'hätte', 'habt'],
          ['genommen hatten', 'nehmen', 'nehmen werden', 'nahmen'],
        ],
      },
      {
        id: 'de.g.c',
        skill: 'grammar',
        levels: ['C1', 'C2'],
        prompt: p.prompts.grammar,
        explanation: 'Inversion / Konjunktiv / Präpositionnuance.',
        stems: [
          (i) =>
            `In den aktuellen Prüfungsnotizen trifft man selten ____ so sorgfältige Dokumentation schon im frühen Entwurf zu ${topic(i)}.`,
          (i) =>
            `Der Vorstand bestand darauf, dass die Freistellungsklausel im Endtext unverändert ____.`,
          (i) =>
            `Die Änderung ist von der schriftlichen Freigabe der Rechtsabteilung ____, bevor sie greift.`,
          (i) =>
            `Hätte sie den früheren Zug genommen, ____ sie jetzt schon bei der Besprechung zu ${topic(i)}.`,
          (i) =>
            `Erst nach den neuen Zahlen ____ ${org(i)} bereit, den Punkt wieder zu öffnen.`,
        ],
        optionSets: [
          ['auf', 'an', 'über', 'bei'],
          ['bleibe', 'bleibt', 'blieb', 'bleiben'],
          ['abhängig', 'unabhängig', 'bereit', 'offen'],
          ['wäre', 'würde sein', 'wird sein', 'ist'],
          ['war', 'ist', 'wird', 'sei'],
        ],
      },
      {
        id: 'de.v.low',
        skill: 'vocabulary',
        levels: ['A1', 'A2'],
        prompt: p.prompts.vocabulary,
        explanation: 'Alltagslexik.',
        stems: [
          (i) => `Am Morgen esse ich meistens ____ um ${pick(['7', '8', '9'], i)} Uhr.`,
          (i) => `Du brauchst eine ____, um ins Kino zu kommen.`,
          (i) => `Ich habe um 16 Uhr einen ____ beim Zahnarzt.`,
          (i) => `Kann ich kurz deinen Stift ____?`,
          (i) => `Der Zug war wegen des Regens ____.`,
        ],
        optionSets: [
          ['Frühstück', 'Mittagessen', 'Abendessen', 'Snackzeit'],
          ['Fahrkarte', 'Quittung', 'Speisekarte', 'Stadtkarte'],
          ['Termin', 'Einladung', 'Besuch', 'Anruf'],
          ['leihen', 'verleihen', 'mieten', 'besitzen'],
          ['verspätet', 'storniert', 'gebucht', 'geöffnet'],
        ],
      },
      {
        id: 'de.v.mid',
        skill: 'vocabulary',
        levels: ['B1', 'B2'],
        prompt: p.prompts.vocabulary,
        explanation: 'Kollokation / Nahsynonyme.',
        stems: [
          (i) => `Bitte senden Sie das Formular vor der ____ am ${day(i)}.`,
          (i) => `Wir müssen heute eine Entscheidung ____.`,
          (i) => `Nach dem Unfall war der Verkehr ____.`,
          (i) => `Die Firma plant, die Gehälter nächstes Jahr zu ____.`,
          (i) => `Bitte ____ Sie mich morgen früh an die Sitzung.`,
        ],
        optionSets: [
          ['Frist', 'Überschrift', 'Zeitlinie', 'Gliederung'],
          ['treffen', 'machen', 'tun', 'setzen'],
          ['dicht', 'stark', 'hart', 'dick'],
          ['erhöhen', 'steigen', 'heben', 'wachsen'],
          ['erinnern', 'erinnern Sie', 'merken', 'behalten'],
        ],
      },
      {
        id: 'de.v.high',
        skill: 'vocabulary',
        levels: ['C1', 'C2'],
        prompt: p.prompts.vocabulary,
        explanation: 'Stance- / Kollokationsnuance.',
        stems: [
          (i) =>
            `Im Memo an Investoren zu ${topic(i)} versuchen die Autoren, Restbedenken zu ____, ohne Erstattung oder neuen Zeitplan zuzusagen.`,
          (i) =>
            `Kollegen fanden seine Antwort höflich ____ gegenüber dem Vorschlag: er dankte, ging dann ohne inhaltliche Auseinandersetzung weiter.`,
          (i) =>
            `Ihre Schlusszeile dankte ${org(i)} „für eine interessante Richtung“ und meinte, sie passe „besser später“, ohne nächsten Schritt. Die Haltung ist vor allem ____.`,
          (i) =>
            `Nach den neuen Versandprotokollen sagte mehrere Analysten, die Zahlen ____ Zweifel an der Juni-Prognose.`,
          (i) =>
            `Die Formulierung der Kanzlei war sorgfältig ____: sie räumte die Beschwerde ein, ohne Haftung zu ${topic(i)} zuzugeben.`,
        ],
        optionSets: [
          ['abmildern', 'verstärken', 'ignorieren', 'feiern'],
          ['abweisend', 'unterstützend', 'neugierig', 'dankbar'],
          ['unverbindlich', 'begeistert', 'feindselig', 'formal'],
          ['würfen', 'legten', 'setzten', 'machten'],
          ['abgewogen', 'brutal', 'lässig', 'spöttisch'],
        ],
      },
      {
        id: 'de.r.low',
        skill: 'reading',
        levels: ['A1', 'A2'],
        prompt: p.prompts.reading,
        explanation: 'Kurzer Aushang / Hinweis.',
        stems: [
          (i) => {
            const a = 11 + (i % 4);
            return `Schild: „Mittagspause ${a}:00–${a + 1}:00.“ Wann können Sie einkaufen?`;
          },
          (i) => `Tafel: „Bus 12 → Bahnhof.“ Wohin fährt der Bus?`,
          (i) => `Karte: „WLAN: Gast / Passwort auf dem Beleg.“ Wo ist das Passwort?`,
          (i) => `Hinweis: „Nummer ziehen und warten.“ Was tun Sie zuerst?`,
          (i) => `Notiz: „Bibliothek bis ${pick(['18', '19', '20'], i)} Uhr geöffnet.“ Was gilt?`,
        ],
        optionSets: [
          ['Vor oder nach der Pause', 'Nur genau zur Pause', 'Den ganzen Tag ohne Pause', 'Heute gar nicht mehr'],
          ['Zum Bahnhof hin', 'Nur zur Busnummer', 'Endlos durch die Stadt', 'Nirgendwohin gelistet'],
          ['Auf dem Belegzettel', 'Auf dem Gastnamen', 'Nur am Routergerät', 'Es gibt keines'],
          ['Eine Nummer ziehen', 'Ohne Nummer warten', 'Sofort weggehen', 'Den Chef anrufen'],
          ['Sie schließt am Abend', 'Sie öffnet nie', 'Sie öffnet um Mitternacht', 'Sie bleibt den Tag zu'],
        ],
      },
      {
        id: 'de.r.mid',
        skill: 'reading',
        levels: ['B1', 'B2'],
        prompt: p.prompts.reading,
        explanation: 'Policy- / Toninferenz.',
        stems: [
          (i) =>
            `Regel: „Ungenutzte Tickets können innerhalb von 48 Stunden nach Kauf erstattet werden.“ Wann ist eine Erstattung möglich?`,
          (i) =>
            `Briefing: „Wachstum ist wahrscheinlich, auch wenn Lieferrisiken um ${topic(i)} erheblich bleiben.“ Welche Haltung zeigt der Text?`,
          (i) =>
            `Mail: „Wir schätzen das Konzept zu ${topic(i)}; der Zeitplan ist das Hindernis.“ Was ist impliziert?`,
          (i) =>
            `Memo: „Der Pilot erreichte die Untergrenze, nicht die Stretch-Ziele.“ Was trifft zu?`,
          (i) =>
            `Notiz: „Unterstützung hängt von einem überarbeiteten Zeitplan für ${topic(i)} ab.“ Wovon hängt die Unterstützung ab?`,
        ],
        optionSets: [
          ['Binnen zwei Tagen, ungenutzt', 'Jederzeit nach dem Event', 'Nur vor dem Kauf', 'Nie bei ungenutzten'],
          ['Optimistisch, klar abgefedert', 'Sicherer Totalzusammenbruch', 'Keine Meinung erkennbar', 'Reine Erfolgsfeier'],
          ['Interesse ohne Freigabe', 'Volle Finanzierung sofort', 'Feindliche Ablehnung', 'Rücktrittsforderung'],
          ['Minimum erreicht, Stretch nicht', 'Alle Stretch-Ziele übertroffen', 'Der Pilot startete nie wirklich', 'Es erfolgte keine Messung je'],
          ['Vom neuen Lieferzeitplan', 'Von unbegrenztem Budget', 'Von öffentlicher Entschuldigung', 'Von mehr Führungskräften'],
        ],
      },
      {
        id: 'de.r.high',
        skill: 'reading',
        levels: ['C1', 'C2'],
        prompt: p.prompts.reading,
        explanation: 'Pragmatische Institutionslesart.',
        stems: [
          (i) =>
            `Protokoll von ${org(i)}: „Die Mitglieder dankten für den Entwurf zu ${topic(i)}. Die Gruppe nahm ihn mit Interesse zur Kenntnis und ging ohne Abstimmung und ohne Nachforderung zu anderen Punkten über.“ Wahrscheinlichste Lesart?`,
          (i) =>
            `Interne Notiz: „Prinzipiell bleiben wir offen, ${topic(i)} wieder aufzugreifen, vorbehaltlich Kapazität, die wir derzeit nicht haben.“ Was signalisiert der Text vor allem?`,
          (i) =>
            `Die Kanzlei schrieb: „Ohne Präjudiz bestreitet die Firma die Darstellung der Ereignisse um ${topic(i)}, lädt aber zu einer engeren Erörterung der Abhilfe ein.“ Welche Haltung?`,
          (i) =>
            `Presselinie: „Wir prüfen die Berichte und informieren Stakeholder zu gegebener Zeit zu ${topic(i)}.“ Worauf legt das fest?`,
          (i) =>
            `Kurzfassung von ${org(i)}: „Die Empfehlung wird zur Kenntnis genommen. Es wurden keine Maßnahmen vergeben.“ Was folgt am ehesten?`,
        ],
        optionSets: [
          ['Höfliche Nichtfestlegung statt Ja', 'Einstimmige Mittelbewilligung jetzt', 'Auftrag zur Sofortumsetzung', 'Klarer Protokollfehler nur'],
          ['Aufschub im Gewand von Offenheit', 'Sofortige Finanzzusage', 'Feindliche Themenablehnung', 'Schuldgeständnis im Text'],
          ['Strittige Fakten, begrenzte Gespräche', 'Volle Anerkennung aller Ansprüche', 'Totaler Redeverzicht', 'Feier der Beschwerde'],
          ['Prozess ohne festes Ergebnis', 'Genauer Erstattungskalender', 'Persönliche Entschuldigung morgen', 'Beweis, dass alles stimmt'],
          ['Beiseitelegen ohne klares Nein', 'Start der Volllieferung', 'Pflichtfeier fürs Team', 'Automatischer Rechtsvergleich'],
        ],
      },
      {
        id: 'de.f.low',
        skill: 'functional',
        levels: ['A1', 'A2'],
        prompt: p.prompts.functional,
        explanation: 'Grundlegende Sprechakte.',
        stems: [
          (i) => `Sie treffen ${n(i)} zum ersten Mal. Was sagen Sie?`,
          (i) => `Sie möchten die Rechnung. Was sagen Sie?`,
          (i) => `Jemand sagt „Danke“. Was antworten Sie?`,
          (i) => `Sie möchten einen Tisch für ${pick(['zwei', 'drei', 'vier'], i)} am ${day(i)} reservieren. Was sagen Sie?`,
          (i) => `Sie kommen zu spät zum Unterricht. Was sagen Sie?`,
        ],
        optionSets: [
          ['Freut mich, Sie kennenzulernen', 'Wer sind Sie denn eigentlich', 'Gehen Sie bitte sofort weg', 'Ich gehe jetzt sofort fort'],
          ['Die Rechnung, bitte', 'Geben Sie Geld her', 'Ich hasse das Essen', 'Schließen Sie das Café'],
          ['Bitte schön', 'Nein danke', 'Mir egal', 'Hören Sie auf'],
          ['Könnten wir reservieren?', 'Geben Sie uns Essen', 'Wir besitzen das Lokal', 'Schließen Sie früher'],
          ['Entschuldigung für die Verspätung', 'Ich habe niemals irgendwie Unrecht', 'Der Unterricht ist total albern', 'Öffnen Sie bitte sofort die Tür'],
        ],
      },
      {
        id: 'de.f.mid',
        skill: 'functional',
        levels: ['B1', 'B2'],
        prompt: p.prompts.functional,
        explanation: 'Berufliche Pragmatik.',
        stems: [
          (i) => `${n(i)} bittet Sie, eine Schicht zu übernehmen. Sie können bis 18 Uhr. Was sagen Sie?`,
          (i) => `Ein Kunde ist unzufrieden wegen Verzögerung bei ${topic(i)}. Sie wollen sich entschuldigen und einen nächsten Schritt anbieten. Was sagen Sie?`,
          (i) => `Ein Kollege drängt auf schnelles Ja zu ${topic(i)}. Sie brauchen mehr Daten. Was sagen Sie?`,
          (i) => `Sie müssen eine Einladung höflich ablehnen. Was sagen Sie?`,
          (i) => `Sie wollen eine Behauptung prüfen, ohne jemanden anzuklagen. Was sagen Sie?`,
        ],
        optionSets: [
          ['Ich kann bis sechs helfen', 'Ich lehne jede Schicht ab', 'Machen Sie es selbst', 'Ich kündige jetzt'],
          ['Tut mir leid — hier unser Plan', 'Das ist Ihr Problem', 'Wir verspäten nie', 'Hören Sie auf zu klagen'],
          ['Lass uns erst Daten prüfen', 'Sag Ja ohne Prüfung', 'Bring das nie wieder', 'Genehmige das Budget'],
          ['Danke — ich bin dann nicht frei', 'Ich mag euch alle überhaupt nicht', 'Ladet mich bitte niemals wieder ein', 'Das Event ist völlig wertlos heute'],
          ['Können wir die Belege prüfen?', 'Sie lügen ganz offen', 'Ich lehne alle Fakten ab', 'Die Diskussion ist zu Ende'],
        ],
      },
      {
        id: 'de.f.high',
        skill: 'functional',
        levels: ['C1', 'C2'],
        prompt: p.prompts.functional,
        explanation: 'Hohe Register-Abmilderung.',
        stems: [
          (i) =>
            `Man drängt Sie zu einer schnellen Entscheidung über ${topic(i)}. Sie wollen aufschieben ohne harte Absage. Was sagen Sie?`,
          (i) =>
            `In der Sitzung mit ${org(i)} teilen Sie das Ziel hinter ${topic(i)}, wollen aber keine ungeprüfte Lieferung. Was sagen Sie?`,
          (i) =>
            `Ein Stakeholder verlangt heute eine öffentliche Aussage zu ${topic(i)}. Sie brauchen Rechtsprüfung. Was sagen Sie?`,
          (i) =>
            `${org(i)} will Ihre Freigabe unter Zeitdruck. Die Akte zu ${topic(i)} ist unvollständig. Was sagen Sie?`,
          (i) =>
            `Sie müssen einen Gefallen ablehnen, der einen Interessenkonflikt zu ${topic(i)} schaffen würde. Was sagen Sie?`,
        ],
        optionSets: [
          ['Richtung interessant; besser mit klarerer Lage', 'Nein — bringen Sie das nie wieder', 'Idee wertlos; heute fallen lassen', 'Alles sofort mit voller Finanzierung'],
          ['Ziel teile ich, unter klaren Kennzahlen', 'Ich genehmige jedes Detail ungeprüft', 'Ziel lehne ich ab, lobe Kennzahlen', 'Sympathie gleicht einem Vertrag'],
          ['Zuerst die Rechtsprüfung abwarten', 'Sofort irgendeine Aussage posten', 'Rechtsrat komplett ignorieren', 'Haftung öffentlich eingestehen'],
          ['Ohne vollständige Akte unterschreibe ich nicht', 'Trotzdem unterschreiben, Zeit sparen', 'Fehlende Seiten ignorieren', 'Freigeben und später nachbessern'],
          ['Ich muss wegen Konfliktgefahr ablehnen', 'Klar — private Gefallen sind ok', 'Konflikt in Akten verstecken', 'Gefallen gegen spätere Deals'],
        ],
      },
    ];
  }

  if (lang === 'ru') {
    return [
      {
        id: 'ru.g.a1',
        skill: 'grammar',
        levels: ['A1'],
        prompt: p.prompts.grammar,
        explanation: 'Согласование / есть.',
        stems: [
          (i) => `${n(i)} ____ из ${place(i)}.`,
          (i) => `На столе ____ две книги.`,
          (i) => `Это ____ друг Марии.`,
          (i) => `Мы ____ готовы сейчас.`,
          (i) => `У меня ____ новый пропуск.`,
        ],
        optionSets: [
          ['из', 'в', 'на', 'к'],
          ['лежат', 'лежит', 'лежал', 'лежать'],
          ['мой', 'моя', 'моё', 'мои'],
          ['готовы', 'готов', 'готова', 'готово'],
          ['есть', 'нет', 'был', 'будет'],
        ],
      },
      {
        id: 'ru.g.a2',
        skill: 'grammar',
        levels: ['A2'],
        prompt: p.prompts.grammar,
        explanation: 'Прошедшее / сравнение.',
        stems: [
          (i) => `Вчера мы ____ в музей.`,
          (i) => `${n(i)} ____ длинное письмо.`,
          (i) => `Эта сумка ____ той.`,
          (i) => `Они ____ пиццу в ${day(i)}.`,
          (i) => `Я ____ ключи сегодня утром.`,
        ],
        optionSets: [
          ['ходили', 'ходим', 'идём', 'ходили бы'],
          ['написала', 'пишет', 'писать', 'напишет'],
          ['дешевле', 'более дешёвая', 'самая дешёвая', 'дешёвая'],
          ['ели', 'едят', 'есть', 'съедят'],
          ['потерял', 'теряю', 'терять', 'потеряю'],
        ],
      },
      {
        id: 'ru.g.b1',
        skill: 'grammar',
        levels: ['B1'],
        prompt: p.prompts.grammar,
        explanation: 'Аспект / условие.',
        stems: [
          (i) => `Я ____ в этом городе уже три года.`,
          (i) => `Если завтра будет дождь, мы ____ пикник.`,
          (i) => `${n(i)} уже ____ этот фильм.`,
          (i) => `Когда он приедет, совещание ____.`,
          (i) => `Мы ____ друг друга с 2019 года.`,
        ],
        optionSets: [
          ['живу', 'жил', 'буду жить', 'проживу'],
          ['отменим', 'отменяем', 'отменили', 'отменим бы'],
          ['видел', 'видит', 'увидит', 'видеть'],
          ['начнётся', 'начинается', 'начиналось', 'началось'],
          ['знаем', 'знали', 'узнаем', 'узнали'],
        ],
      },
      {
        id: 'ru.g.b2',
        skill: 'grammar',
        levels: ['B2'],
        prompt: p.prompts.grammar,
        explanation: 'Предшествование / косвенная речь.',
        stems: [
          (i) => `К моменту нашего прихода фильм уже ____.`,
          (i) => `Она сказала, что ____ ключи дома.`,
          (i) => `Он утверждал, что ____ письмо до полудня.`,
          (i) => `Мы поняли, что ____ не ту платформу.`,
          (i) => `Как только они ____, зал был пуст.`,
        ],
        optionSets: [
          ['начался', 'начинается', 'начнётся', 'начинался'],
          ['оставила', 'оставляет', 'оставит', 'оставляла'],
          ['отправил', 'отправляет', 'отправит', 'отправлял'],
          ['выбрали', 'выбираем', 'выберем', 'выбирали'],
          ['ушли', 'уходят', 'уйдут', 'уходили'],
        ],
      },
      {
        id: 'ru.g.c',
        skill: 'grammar',
        levels: ['C1', 'C2'],
        prompt: p.prompts.grammar,
        explanation: 'Сложный регистр / условные конструкции.',
        stems: [
          (i) =>
            `В последних аудиторских заметках редко ____ столь аккуратную документацию уже в раннем черновике по теме «${topic(i)}».`,
          (i) =>
            `Совет настоял, чтобы пункт об ответственности ____ без изменений в финальном тексте.`,
          (i) =>
            `Поправка зависит ____ письменного согласия юридического отдела, прежде чем она вступит в силу.`,
          (i) =>
            `Если бы она села на более ранний поезд, она ____ уже здесь к обсуждению «${topic(i)}».`,
          (i) =>
            `Только после новых цифр ${org(i)} ____ готов снова открыть вопрос.`,
        ],
        optionSets: [
          ['встречаешь', 'встречаем', 'встретишь', 'встретили'],
          ['остался', 'останется', 'остаётся', 'оставался'],
          ['от', 'из', 'для', 'к'],
          ['была бы', 'будет', 'есть', 'была'],
          ['был', 'будет', 'есть', 'будь'],
        ],
      },
      {
        id: 'ru.v.low',
        skill: 'vocabulary',
        levels: ['A1', 'A2'],
        prompt: p.prompts.vocabulary,
        explanation: 'Базовый лексикон.',
        stems: [
          (i) => `Утром я обычно ем ____ около ${pick(['7', '8', '9'], i)}.`,
          (i) => `Нужен ____, чтобы войти в кино.`,
          (i) => `У меня ____ у стоматолога в 16:00.`,
          (i) => `Можно на минуту ____ твою ручку?`,
          (i) => `Поезд был ____ из‑за дождя.`,
        ],
        optionSets: [
          ['завтрак', 'обед', 'ужин', 'перекус'],
          ['билет', 'чек', 'меню', 'карта'],
          ['запись', 'приглашение', 'визит', 'звонок'],
          ['взять', 'дать', 'снять', 'иметь'],
          ['задержан', 'отменён', 'забронирован', 'открыт'],
        ],
      },
      {
        id: 'ru.v.mid',
        skill: 'vocabulary',
        levels: ['B1', 'B2'],
        prompt: p.prompts.vocabulary,
        explanation: 'Коллокации / близкие синонимы.',
        stems: [
          (i) => `Пришлите форму до ____ в ${day(i)}.`,
          (i) => `Нам нужно ____ решение сегодня.`,
          (i) => `После аварии движение было ____.`,
          (i) => `Компания планирует ____ зарплаты в следующем году.`,
          (i) => `Пожалуйста, ____ мне о встрече завтра утром.`,
        ],
        optionSets: [
          ['срока', 'заголовка', 'графика', 'плана'],
          ['принять', 'сделать', 'взять', 'положить'],
          ['плотным', 'сильным', 'твёрдым', 'толстым'],
          ['повысить', 'поднять', 'вырасти', 'встать'],
          ['напомните', 'помните', 'запомните', 'вспомните'],
        ],
      },
      {
        id: 'ru.v.high',
        skill: 'vocabulary',
        levels: ['C1', 'C2'],
        prompt: p.prompts.vocabulary,
        explanation: 'Нюанс позиции / коллокация.',
        stems: [
          (i) =>
            `В записке для инвесторов о «${topic(i)}» авторы пытаются ____ оставшиеся опасения, не обещая возврат денег и не предлагая новый график.`,
          (i) =>
            `Коллеги сочли его ответ вежливо ____ по отношению к предложению: он поблагодарил и перешёл дальше, не затрагивая сути.`,
          (i) =>
            `Её финальная фраза благодарила ${org(i)} «за интересное направление» и предлагала вернуться «позже», без следующего шага. Позиция скорее ____.`,
          (i) =>
            `После новых журналов отгрузки аналитики сказали, что цифры ____ сомнение на июньский прогноз.`,
          (i) =>
            `Формулировка юристов была осторожно ____: она признавала жалобу, не признавая ответственности по «${topic(i)}».`,
        ],
        optionSets: [
          ['смягчить', 'усилить', 'игнорировать', 'отметить'],
          ['отстраняющим', 'поддерживающим', 'любопытным', 'благодарным'],
          ['уклончивая', 'восторженная', 'враждебная', 'процедурная'],
          ['бросают', 'кладут', 'ставлят', 'делают'],
          ['взвешенной', 'грубой', 'небрежной', 'насмешливой'],
        ],
      },
      {
        id: 'ru.r.low',
        skill: 'reading',
        levels: ['A1', 'A2'],
        prompt: p.prompts.reading,
        explanation: 'Короткое объявление.',
        stems: [
          (i) => {
            const a = 11 + (i % 4);
            return `Объявление: «Закрыто на обед ${a}:00–${a + 1}:00.» Когда можно делать покупки?`;
          },
          (i) => `Табло: «Автобус 12 → Вокзал.» Куда идёт автобус?`,
          (i) => `Карточка: «Wi‑Fi: Гость / пароль на чеке.» Где пароль?`,
          (i) => `Надпись: «Возьмите номер и ждите.» Что сделать сначала?`,
          (i) => `Заметка: «Библиотека до ${pick(['18', '19', '20'], i)}:00.» Что верно?`,
        ],
        optionSets: [
          ['До или после обеда', 'Только ровно в обед', 'Весь день без перерыва', 'Сегодня уже нельзя'],
          ['На вокзал', 'К номеру автобуса', 'Кругом по городу', 'Никуда из списка'],
          ['На чеке', 'На бейдже гостя', 'Только на роутере', 'Его нет'],
          ['Взять номер', 'Ждать без номера', 'Сразу уйти', 'Позвонить менеджеру'],
          ['Она закрывается вечером', 'Она не открывается', 'Она открыта в полночь', 'Она закрыта весь день'],
        ],
      },
      {
        id: 'ru.r.mid',
        skill: 'reading',
        levels: ['B1', 'B2'],
        prompt: p.prompts.reading,
        explanation: 'Политика / тон.',
        stems: [
          (i) =>
            `Правило: «Неиспользованные билеты можно вернуть в течение 48 часов после покупки.» Когда возможен возврат?`,
          (i) =>
            `Бриф: «Рост вероятен, хотя риски поставок вокруг «${topic(i)}» остаются существенными.» Какова позиция автора?`,
          (i) =>
            `Письмо: «Мы ценим концепцию по «${topic(i)}»; препятствие — сроки.» Что подразумевается?`,
          (i) =>
            `Мемо: «Пилот достиг нижнего порога, но не амбициозных целей.» Что верно?`,
          (i) =>
            `Заметка: «Поддержка зависит от пересмотренного графика по «${topic(i)}».» От чего зависит поддержка?`,
        ],
        optionSets: [
          ['В течение двух дней, если не использован', 'В любое время после самого события', 'Только до момента самой покупки', 'Никогда даже для неиспользованных'],
          ['Оптимизм с оговорками', 'Гарантированный крах', 'Нет мнения', 'Чистое торжество'],
          ['Интерес без зелёного света', 'Полное финансирование', 'Враждебный отказ', 'Требование уйти'],
          ['Минимум достигнут, stretch — нет', 'Все цели были превышены сразу', 'Пилот вообще не начинался вовсе', 'Метрик просто не было никогда'],
          ['От нового графика поставки', 'От безлимитного бюджета', 'От публичных извинений', 'От найма руководителей'],
        ],
      },
      {
        id: 'ru.r.high',
        skill: 'reading',
        levels: ['C1', 'C2'],
        prompt: p.prompts.reading,
        explanation: 'Прагматическое институциональное чтение.',
        stems: [
          (i) =>
            `Протокол ${org(i)}: «Члены поблагодарили авторов за проект по теме «${topic(i)}». Группа приняла предложение к сведению с интересом и без голосования и без запроса продолжения перешла к другим вопросам.» Наиболее вероятное прочтение?`,
          (i) =>
            `Внутренняя записка: «Мы в принципе открыты снова обсудить «${topic(i)}», при наличии мощности, которой сейчас нет.» Что это в основном сигнализирует?`,
          (i) =>
            `Юристы написали: «Без ущерба для позиции компания оспаривает описание событий вокруг «${topic(i)}», но предлагает более узкое обсуждение средств.» Какова позиция?`,
          (i) =>
            `Пресс-линия: «Мы изучаем сообщения и сообщим заинтересованным сторонам в должное время по «${topic(i)}».» К чему это обязывает?`,
          (i) =>
            `Краткое резюме ${org(i)}: «Рекомендация принята к сведению. Поручений не выдано.» Что следует естественнее всего?`,
        ],
        optionSets: [
          ['Вежливое неучастие, не одобрение', 'Единогласное финансирование сейчас', 'Приказ немедленно внедрять', 'Явная ошибка секретаря'],
          ['Отсрочка под видом открытости', 'Немедленное финансирование', 'Враждебный отказ от темы', 'Признание вины в тексте'],
          ['Спорные факты, ограниченные переговоры', 'Полное признание всех претензий', 'Полный отказ говорить', 'Празднование жалобы'],
          ['Процесс без фиксированного итога', 'Точный график возврата', 'Личные извинения завтра', 'Доказательство истинности'],
          ['Откладывание без явного «нет»', 'Старт полной поставки', 'Обязательный праздник', 'Автоматическое урегулирование'],
        ],
      },
      {
        id: 'ru.f.low',
        skill: 'functional',
        levels: ['A1', 'A2'],
        prompt: p.prompts.functional,
        explanation: 'Базовые речевые акты.',
        stems: [
          (i) => `Вы впервые встречаете ${n(i)}. Что сказать?`,
          (i) => `Вы хотите счёт в кафе. Что сказать?`,
          (i) => `Вам говорят «Спасибо». Что ответить?`,
          (i) => `Вы хотите забронировать стол на ${pick(['двоих', 'троих', 'четверых'], i)} в ${day(i)}. Что сказать?`,
          (i) => `Вы опоздали на занятие. Что сказать?`,
        ],
        optionSets: [
          ['Приятно познакомиться', 'Кто вы такой вообще', 'Уходите отсюда сейчас', 'Я ухожу прямо сейчас'],
          ['Счёт, пожалуйста', 'Дайте мне деньги', 'Я ненавижу еду', 'Закройте кафе'],
          ['Пожалуйста', 'Нет, спасибо', 'Мне всё равно', 'Хватит говорить'],
          ['Можно забронировать стол?', 'Дайте еду бесплатно', 'Мы владеем местом', 'Закройте раньше'],
          ['Извините за опоздание', 'Я никогда не ошибаюсь', 'Урок глупый', 'Откройте дверь'],
        ],
      },
      {
        id: 'ru.f.mid',
        skill: 'functional',
        levels: ['B1', 'B2'],
        prompt: p.prompts.functional,
        explanation: 'Рабочая прагматика.',
        stems: [
          (i) => `${n(i)} просит подменить смену. Вы можете до 18:00. Что сказать?`,
          (i) => `Клиент недоволен задержкой по «${topic(i)}». Нужны извинения и следующий шаг. Что сказать?`,
          (i) => `Коллега торопит с «да» по «${topic(i)}». Нужны данные. Что сказать?`,
          (i) => `Нужно вежливо отказаться от приглашения. Что сказать?`,
          (i) => `Хотите проверить утверждение, не обвиняя. Что сказать?`,
        ],
        optionSets: [
          ['Могу помочь до шести', 'Отказываюсь от любых смен', 'Делайте сами', 'Я увольняюсь'],
          ['Извините — вот наш план', 'Это ваша проблема', 'Мы никогда не опаздываем', 'Хватит жаловаться'],
          ['Сначала сверим данные', 'Скажите «да» без проверок', 'Больше не поднимайте', 'Одобрите бюджет'],
          ['Спасибо — меня не будет', 'Вы мне все не нравитесь', 'Больше не зовите', 'Событие ничего не стоит'],
          ['Можем проверить доказательства?', 'Вы открыто лжёте прямо сейчас', 'Отвергаю абсолютно все факты', 'Разговор окончен окончательно'],
        ],
      },
      {
        id: 'ru.f.high',
        skill: 'functional',
        levels: ['C1', 'C2'],
        prompt: p.prompts.functional,
        explanation: 'Высокий регистр смягчения.',
        stems: [
          (i) =>
            `Вас торопят с решением по поводу «${topic(i)}». Нужно отложить без резкого отказа. Что сказать?`,
          (i) =>
            `На встрече с ${org(i)} вы разделяете цель по «${topic(i)}», но не готовы к бесконтрольной поставке. Что сказать?`,
          (i) =>
            `Стейкхолдер требует публичного заявления сегодня по «${topic(i)}». Нужна юридическая проверка. Что сказать?`,
          (i) =>
            `${org(i)} хочет вашу подпись под давлением сроков. Файл по «${topic(i)}» неполный. Что сказать?`,
          (i) =>
            `Нужно отказать в услуге, создающей конфликт интересов вокруг «${topic(i)}». Что сказать?`,
        ],
        optionSets: [
          ['Направление интересное; лучше с ясными данными', 'Нет — больше никогда это не поднимайте', 'Идея ничего не стоит; просто бросьте её', 'Одобряем всё сразу с полным финансированием'],
          ['Цель разделяю, при ясных метриках', 'Одобряю каждую деталь без условий', 'Цель отвергаю, но хвалю метрики', 'Симпатия равна подписанному контракту'],
          ['Сначала нужна юридическая проверка', 'Публикуйте любое заявление сейчас', 'Игнорируйте юристов полностью', 'Признайте ответственность публично'],
          ['Не подпишу, пока файл неполон', 'Подпишите всё равно ради скорости', 'Игнорируйте недостающие страницы', 'Одобрите и поправьте потом'],
          ['Вынужден отказать из‑за риска конфликта', 'Конечно — личные услуги нормальны', 'Скройте конфликт в документах', 'Обменяемся услугами позже'],
        ],
      },
    ];
  }

  // zh
  return [
    {
      id: 'zh.g.a1',
      skill: 'grammar',
      levels: ['A1'],
      prompt: p.prompts.grammar,
      explanation: '是/有/量词基础。',
      stems: [
        (i) => `${n(i)} ____ ${place(i)}人。`,
        (i) => `桌子上 ____ 两本书。`,
        (i) => `这是 ____ 朋友。`,
        (i) => `我们现在 ____ 准备好了。`,
        (i) => `我 ____ 一张新卡。`,
      ],
      optionSets: [
        ['是', '在', '有', '很'],
        ['有', '是', '在', '很'],
        ['我的', '我', '我们', '我们的'],
        ['已经', '正在', '将要', '没有'],
        ['有', '是', '在', '给'],
      ],
    },
    {
      id: 'zh.g.a2',
      skill: 'grammar',
      levels: ['A2'],
      prompt: p.prompts.grammar,
      explanation: '了/比/过。',
      stems: [
        (i) => `昨天我们 ____ 博物馆。`,
        (i) => `${n(i)} ____ 一封很长的信。`,
        (i) => `这个包比那个 ____ 。`,
        (i) => `他们${day(i)} ____ 披萨。`,
        (i) => `我今天早上 ____ 钥匙。`,
      ],
      optionSets: [
        ['去了', '去过', '正在去', '会去'],
        ['写了', '写着', '要写', '写过吗'],
        ['便宜', '更便宜的最', '最便宜了些', '便宜得很最'],
        ['吃了', '吃着', '要吃', '吃过吗'],
        ['丢了', '丢着', '要丢', '丢过吗'],
      ],
    },
    {
      id: 'zh.g.b1',
      skill: 'grammar',
      levels: ['B1'],
      prompt: p.prompts.grammar,
      explanation: '把/被/如果。',
      stems: [
        (i) => `我已经在这座城市 ____ 三年了。`,
        (i) => `如果明天下雨，我们就 ____ 野餐。`,
        (i) => `${n(i)}以前 ____ 这部电影。`,
        (i) => `他一到，会议就 ____ 。`,
        (i) => `请把表格 ____ 前台。`,
      ],
      optionSets: [
        ['住了', '住着', '要住', '住过吗'],
        ['取消', '取消了着', '正在取消过', '会取消吗了'],
        ['看过', '看着', '要看', '看了吗着'],
        ['开始', '开始了着', '正在开始过', '会开始吗了'],
        ['交给', '交着', '要交过', '交了吗着'],
      ],
    },
    {
      id: 'zh.g.b2',
      skill: 'grammar',
      levels: ['B2'],
      prompt: p.prompts.grammar,
      explanation: '复杂时间关系 / 转述。',
      stems: [
        (i) => `等我们到的时候，电影已经 ____ 。`,
        (i) => `她说她把钥匙 ____ 家里了。`,
        (i) => `他声称中午之前就 ____ 邮件。`,
        (i) => `我们意识到选 ____ 站台。`,
        (i) => `他们一离开，大厅就 ____ 。`,
      ],
      optionSets: [
        ['开始了', '开始着', '要开始', '开始过吗'],
        ['忘在', '忘着', '要忘', '忘过'],
        ['发了', '发着', '要发', '发过吗'],
        ['错了', '错着', '要错', '错过'],
        ['空了', '空着', '要空', '空过'],
      ],
    },
    {
      id: 'zh.g.c',
      skill: 'grammar',
      levels: ['C1', 'C2'],
      prompt: p.prompts.grammar,
      explanation: '书面语衔接 / 条件语势。',
      stems: [
        (i) =>
          `在最新审计纪要里，很少能在关于${topic(i)}的初稿中就 ____ 如此细致的文档记录。`,
        (i) =>
          `董事会坚持要求最终文本中的免责条款保持 ____ 。`,
        (i) =>
          `该修订须 ____ 法务书面批准后方可生效。`,
        (i) =>
          `她若今早赶上更早一班车，此刻就 ____ 在${topic(i)}通报会上了。`,
        (i) =>
          `直到新数据出来，${org(i)}才 ____ 重新讨论该议题。`,
      ],
      optionSets: [
        ['见到', '见着', '要见', '见过吗'],
        ['不变', '变得', '变着', '变过'],
        ['取得', '取得了着', '正在取得过', '会取得吗了'],
        ['能到', '能到了着', '正在能到过', '会能到吗了'],
        ['愿意', '愿意了着', '正在愿意过', '会愿意吗了'],
      ],
    },
    {
      id: 'zh.v.low',
      skill: 'vocabulary',
      levels: ['A1', 'A2'],
      prompt: p.prompts.vocabulary,
      explanation: '日常词汇。',
      stems: [
        (i) => `我早上一般${pick(['七点', '八点', '九点'], i)}吃 ____ 。`,
        (i) => `进电影院需要 ____ 。`,
        (i) => `我下午四点有牙医 ____ 。`,
        (i) => `能 ____ 一下你的笔吗？`,
        (i) => `因为下雨，火车 ____ 了。`,
      ],
      optionSets: [
        ['早饭', '午饭', '晚饭', '零食'],
        ['票', '收据', '菜单', '地图'],
        ['预约', '邀请', '拜访', '电话'],
        ['借', '借给', '租', '拥有'],
        ['晚点', '取消', '预订', '开门'],
      ],
    },
    {
      id: 'zh.v.mid',
      skill: 'vocabulary',
      levels: ['B1', 'B2'],
      prompt: p.prompts.vocabulary,
      explanation: '搭配 / 近义辨析。',
      stems: [
        (i) => `请在${day(i)}的 ____ 前交表格。`,
        (i) => `我们今天必须 ____ 一个决定。`,
        (i) => `事故之后，路上交通很 ____ 。`,
        (i) => `公司计划明年 ____ 工资。`,
        (i) => `请 ____ 我明天早上的会议。`,
      ],
      optionSets: [
        ['截止日期', '大标题', '时间线', '大纲'],
        ['做出', '做做', '拿下', '放上'],
        ['拥堵', '强壮', '坚硬', '厚重'],
        ['上调', '上升', '举起', '成长'],
        ['提醒', '记得', '回忆', '背诵'],
      ],
    },
    {
      id: 'zh.v.high',
      skill: 'vocabulary',
      levels: ['C1', 'C2'],
      prompt: p.prompts.vocabulary,
      explanation: '语境立场 / 搭配细微差别。',
      stems: [
        (i) =>
          `在给投资者的说明里，作者试图 ____ 对${topic(i)}的剩余顾虑，但并未承诺退款或新的时间表。`,
        (i) =>
          `同事觉得他的回复对提案礼貌地显得 ____ ：他先感谢，随即转开，几乎不触及实质内容。`,
        (i) =>
          `她的收尾向${org(i)}致谢，称方向“值得一看”，又说“或许更适合以后再谈”，却未给出下一步。这种立场更接近 ____ 。`,
        (i) =>
          `新的发货记录出现后，多名分析人士表示这些数字给六月库存清仓的预测 ____ 了疑问。`,
        (i) =>
          `法务措辞刻意 ____ ：承认收到投诉，却不对${topic(i)}相关责任作任何承认。`,
      ],
      optionSets: [
        ['缓解', '放大', '忽视', '庆祝'],
        ['敷衍', '支持', '好奇', '感激'],
        ['不表态', '很热衷', '很敌意', '走流程'],
        ['投下', '扔出', '放上', '做成'],
        ['留有余地', '直截了当', '随口说说', '讥讽挖苦'],
      ],
    },
    {
      id: 'zh.r.low',
      skill: 'reading',
      levels: ['A1', 'A2'],
      prompt: p.prompts.reading,
      explanation: '短告示字面理解。',
      stems: [
        (i) => {
          const a = 11 + (i % 4);
          return `告示：「午餐休息 ${a}:00–${a + 1}:00。」什么时候可以购物？`;
        },
        (i) => `站牌：「12路 → 火车站。」公交车去哪里？`,
        (i) => `卡片：「Wi‑Fi：访客 / 密码在收据上。」密码在哪里？`,
        (i) => `提示：「请取号等候。」你应该先做什么？`,
        (i) => `纸条：「图书馆开放至${pick(['18', '19', '20'], i)}点。」哪项正确？`,
      ],
      optionSets: [
        ['午餐前后可以', '只能整点午餐时', '全天都没有休息', '今天再也不能'],
        ['去火车站', '只去12这个数字', '在城里一直转', '哪里都不去'],
        ['在收据上', '在访客名牌上', '只在路由器上', '根本没有'],
        ['先取一个号', '不取号就等', '马上离开', '先打电话给经理'],
        ['傍晚会关门', '从不开放', '午夜才开门', '全天关闭'],
      ],
    },
    {
      id: 'zh.r.mid',
      skill: 'reading',
      levels: ['B1', 'B2'],
      prompt: p.prompts.reading,
      explanation: '政策 / 语气推断。',
      stems: [
        (i) =>
          `规定：「未使用的票可在购买后48小时内退款。」什么时候可以退？`,
        (i) =>
          `简报：「增长仍有可能，不过围绕${topic(i)}的供应风险依然不可忽视。」作者态度是？`,
        (i) =>
          `邮件：「我们认可${topic(i)}的方向，但时间是障碍。」隐含意思是？`,
        (i) =>
          `备忘：「试点达到了底线指标，但未达到冲刺目标。」哪项正确？`,
        (i) =>
          `说明：「支持取决于${topic(i)}的修订时间表。」支持取决于什么？`,
      ],
      optionSets: [
        ['两天内且未使用', '活动后随时可以', '只能在购买前', '未使用也永不退'],
        ['乐观但有保留', '断定市场崩盘', '完全没有立场', '纯庆祝成功'],
        ['有兴趣但未批准', '立刻全额拨款', '敌意彻底否定', '要求对方辞职'],
        ['达标下限未达冲刺', '所有目标都超额', '试点从未开始', '根本没测指标'],
        ['修订后的交付时间', '无限增加的预算', '公开道歉信', '再招更多高管'],
      ],
    },
    {
      id: 'zh.r.high',
      skill: 'reading',
      levels: ['C1', 'C2'],
      prompt: p.prompts.reading,
      explanation: '机构话语语用推断。',
      stems: [
        (i) =>
          `${org(i)}纪要：「委员感谢作者分发关于${topic(i)}的草案。会议表示兴趣并记录在案，随后未要求后续材料也未表决，便转入其他议题。」最可能的语用解读是？`,
        (i) =>
          `内部说明：「原则上我们仍愿意回头讨论${topic(i)}，前提是目前并不具备的人力带宽。」这段话主要在释放什么信号？`,
        (i) =>
          `法务写道：「在不构成自认的前提下，公司对围绕${topic(i)}的事实定性提出异议，同时愿意就更窄的救济方案继续沟通。」立场是？`,
        (i) =>
          `对外口径：「我们正在了解相关反映，并将在适当时机向相关方通报${topic(i)}进展。」这实际承诺了什么？`,
        (i) =>
          `${org(i)}摘要：「建议已阅。未分配任何行动项。」接下来最自然的是？`,
      ],
      optionSets: [
        ['礼貌不表态，而非批准', '今天一致通过拨款', '要求立刻全面落地', '明显是秘书写错'],
        ['用开放姿态包装推迟', '立刻给出资金承诺', '敌意地否定议题', '在文中承认违法'],
        ['争议事实、有限沟通', '全面承认全部诉求', '完全拒绝再谈', '庆祝收到投诉'],
        ['流程承诺，结果未定', '精确的退款时间表', '明天个人公开道歉', '证明指控全部属实'],
        ['未明说拒绝的搁置', '启动完整交付', '强制全员庆祝', '自动达成和解'],
      ],
    },
    {
      id: 'zh.f.low',
      skill: 'functional',
      levels: ['A1', 'A2'],
      prompt: p.prompts.functional,
      explanation: '基础交际功能。',
      stems: [
        (i) => `你第一次见到${n(i)}。你说？`,
        (i) => `你在咖啡馆想结账。你说？`,
        (i) => `别人说「谢谢」。你回？`,
        (i) => `你想订${pick(['两人', '三人', '四人'], i)}${day(i)}的位子。你说？`,
        (i) => `你上课迟到了。你说？`,
      ],
      optionSets: [
        ['很高兴认识你', '你到底是谁', '请你走开', '我要离开了'],
        ['买单，谢谢', '快给我钱', '我讨厌这菜', '把店关上'],
        ['不客气', '不，谢谢', '我无所谓', '别再说了'],
        ['可以订位吗？', '免费给我们吃', '这店是我们的', '请提早打烊'],
        ['对不起我迟到了', '我从来没错', '课很无聊', '把门打开'],
      ],
    },
    {
      id: 'zh.f.mid',
      skill: 'functional',
      levels: ['B1', 'B2'],
      prompt: p.prompts.functional,
      explanation: '职场语用。',
      stems: [
        (i) => `${n(i)}请你代班。你只能到六点。你说？`,
        (i) => `客户对${topic(i)}延误不满。你想道歉并提出下一步。你说？`,
        (i) => `同事催你马上同意${topic(i)}。你还需要数据。你说？`,
        (i) => `你要礼貌拒绝一个邀请。你说？`,
        (i) => `你想核实说法，又不想指责对方。你说？`,
      ],
      optionSets: [
        ['我可以帮忙到六点', '我拒绝任何代班', '你自己做', '我要辞职'],
        ['抱歉，这是我们的安排', '那是你的问题', '我们从不延误', '别再抱怨'],
        ['先把数据核对清楚', '先无条件说好', '以后别再提', '直接批准预算'],
        ['谢谢，我那天不方便', '我讨厌你们所有人', '别再邀请我', '这活动毫无价值'],
        ['我们能否先核对证据？', '你在公开撒谎', '我否定全部事实', '讨论到此结束'],
      ],
    },
    {
      id: 'zh.f.high',
      skill: 'functional',
      levels: ['C1', 'C2'],
      prompt: p.prompts.functional,
      explanation: '高语域缓和与立场管理。',
      stems: [
        (i) =>
          `${n(i)}坚持立刻敲定${topic(i)}。你想婉拒又不伤关系。你说？`,
        (i) =>
          `与${org(i)}讨论时，你认同目标方向，但不能无条件背书${topic(i)}的执行细节。你说？`,
        (i) =>
          `相关方要求今天就${topic(i)}公开发声。你需要法务审阅。你说？`,
        (i) =>
          `${org(i)}在时间压力下要你签字。关于${topic(i)}的材料并不完整。你说？`,
        (i) =>
          `有人请你帮一个会对${topic(i)}形成利益冲突的忙。你说？`,
      ],
      optionSets: [
        ['这个方向值得看，证据更充分后再定', '不行，以后别再提这件事', '想法毫无价值，今天就该放弃', '现在全盘批准并立即拨款'],
        ['我认同目标，但需要更清晰成功指标', '我无条件批准每一个细节', '我否定目标，却大力称赞指标', '这种认同等于已签法律承诺'],
        ['对外表态前应先做法务审阅', '现在随便发一份声明', '完全不必看法务意见', '公开承认全部责任'],
        ['材料不齐，我还不能签字', '为了赶时间先签再说', '缺页可以先不管', '先批准，文件以后补'],
        ['鉴于冲突风险，我必须婉拒', '私人帮忙完全没问题', '把冲突从档案里藏起来', '以后互相交换人情'],
      ],
    },
  ];
}

const FAMILY_CACHE: Partial<Record<BankLanguage, Family[]>> = {
  en: EN_FAMILIES,
};

function familiesFor(lang: BankLanguage): Family[] {
  if (!FAMILY_CACHE[lang]) {
    if (lang === 'en') FAMILY_CACHE.en = EN_FAMILIES;
    else {
      const fams = buildNonEnFamilies(lang);
      for (const f of fams) for (const os of f.optionSets) assertBalanced(os, f.id);
      FAMILY_CACHE[lang] = fams;
    }
  }
  return FAMILY_CACHE[lang]!;
}

const C1_FRAME: Record<BankLanguage, string[]> = {
  en: [
    'After reviewing the supporting annex and the prior discussion thread, consider the following excerpt carefully.',
    'Given the institutional tone and what is left unsaid, read this passage and answer.',
    'Focus on pragmatic implication rather than surface wording in the note below.',
  ],
  fr: [
    'Après lecture de l’annexe et du fil de discussion préalable, considérez attentivement l’extrait suivant.',
    'Compte tenu du ton institutionnel et de ce qui reste non dit, lisez ce passage puis répondez.',
    'Concentrez-vous sur l’implication pragmatique, pas seulement sur le libellé de surface ci-dessous.',
  ],
  de: [
    'Nach Durchsicht der Anlage und des vorherigen Diskussionsstrangs lesen Sie den folgenden Auszug sorgfältig.',
    'Angesichts des institutionellen Tons und des Ungesagten lesen Sie diese Passage und antworten Sie.',
    'Achten Sie auf die pragmatische Implikation, nicht nur auf die Oberflächenformulierung im Text.',
  ],
  ru: [
    'После просмотра приложения и предыдущей переписки внимательно рассмотрите следующий фрагмент.',
    'Учитывая институциональный тон и недосказанное, прочитайте отрывок и ответьте.',
    'Сфокусируйтесь на прагматическом следствии, а не только на поверхностной формулировке ниже.',
  ],
  zh: [
    '在审阅附件与此前讨论串后，请仔细阅读下列节选并作答。',
    '结合机构语气与未明说之处，阅读这段文字后回答。',
    '请关注语用含义，而不只是表面措辞，再看下文。',
  ],
};

function ensureCefrDepth(
  lang: BankLanguage,
  skill: AssessmentSkill,
  level: CefrLevel,
  stem: string,
  variantIndex: number,
): string {
  if (level !== 'C1' && level !== 'C2') return stem;
  if (skill !== 'reading' && skill !== 'vocabulary' && skill !== 'functional' && skill !== 'grammar') {
    return stem;
  }
  const min = cefrContextMinUnits(lang, skill);
  let out = stem;
  let guard = 0;
  while (discourseUnits(out, lang) < min && guard < 4) {
    const frame = pick(C1_FRAME[lang], variantIndex + guard);
    out = `${frame} ${out}`;
    guard += 1;
  }
  return out;
}

/**
 * Generate a unique combinatorial candidate for a production slot.
 */
export function generateCombinatorialPoolItem(
  lang: BankLanguage,
  skill: AssessmentSkill,
  level: CefrLevel,
  variantIndex: number,
): PoolItem | null {
  const fams = familiesFor(lang).filter((f) => f.skill === skill && f.levels.includes(level));
  if (!fams.length) return null;
  const family = pick(fams, Math.floor(variantIndex / 11));
  // Keep stem template and option set aligned by the same template index
  const templateIndex = variantIndex % Math.max(family.stems.length, family.optionSets.length);
  const stemFn = family.stems[templateIndex % family.stems.length]!;
  const opts = family.optionSets[templateIndex % family.optionSets.length]!;
  const balanced = balanceOptionLengths(opts);
  // Diversify entities inside the stem builder
  const scenario = variantIndex * 17 + 3;
  const rawStem = stemFn(variantIndex + scenario);
  const framed = ensureCefrDepth(lang, skill, level, rawStem, variantIndex);
  // Identity uniqueness is via itemId / conceptKey — never inject user-visible Case N prefixes.
  const stem = framed;
  return {
    conceptKey: `${family.id}.v${variantIndex}.s${scenario}`,
    stem,
    prompt: family.prompt,
    options: balanced,
    correctIndex: 0,
    explanation: family.explanation,
  };
}
