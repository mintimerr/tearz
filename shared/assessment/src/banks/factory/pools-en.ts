import type { AssessmentSkill, CefrLevel } from '../../types.js';

export type PoolItem = {
  stem: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  conceptKey: string;
};

/**
 * EN template pool v3 — language-specific situations; distractors are natural
 * learner confusions / pragmatic near-misses (never broken-language nonsense).
 */
export const EN_POOLS: Record<AssessmentSkill, Partial<Record<CefrLevel, PoolItem[]>>> = {
  grammar: {
    A1: [
      {
        conceptKey: 'en.a1.be_nationality',
        stem: 'She ____ from Canada.',
        prompt: 'Choose the correct form.',
        options: ['is', 'are', 'am', 'be'],
        correctIndex: 0,
        explanation: 'Third-person singular takes is.',
      },
      {
        conceptKey: 'en.a1.there_are',
        stem: 'There ____ two apples on the table.',
        prompt: 'Choose the correct form.',
        options: ['are', 'is', 'am', 'be'],
        correctIndex: 0,
        explanation: 'Plural noun → are.',
      },
    ],
    A2: [
      {
        conceptKey: 'en.a2.past_yesterday',
        stem: 'We ____ the museum last weekend.',
        prompt: 'Choose the correct form.',
        options: ['visited', 'visit', 'visiting', 'visits'],
        correctIndex: 0,
        explanation: 'Past simple with last weekend.',
      },
      {
        conceptKey: 'en.a2.comparatives',
        stem: 'This bag is ____ than that one.',
        prompt: 'Choose the correct form.',
        options: ['cheaper', 'more cheap', 'cheapest', 'cheap'],
        correctIndex: 0,
        explanation: 'Short adjective comparative: cheaper.',
      },
    ],
    B1: [
      {
        conceptKey: 'en.b1.present_perfect',
        stem: 'I ____ in this city for three years.',
        prompt: 'Choose the correct form.',
        options: ['have lived', 'live', 'am living', 'lived'],
        correctIndex: 0,
        explanation: 'For + duration with present perfect.',
      },
      {
        conceptKey: 'en.b1.first_conditional',
        stem: 'If it rains tomorrow, we ____ the picnic.',
        prompt: 'Choose the correct form.',
        options: ['will cancel', 'cancel', 'cancelled', 'would cancel'],
        correctIndex: 0,
        explanation: 'First conditional: will + base.',
      },
    ],
    B2: [
      {
        conceptKey: 'en.b2.past_perfect',
        stem: 'By the time we arrived, the film ____.',
        prompt: 'Choose the correct form.',
        options: ['had started', 'has started', 'started', 'was starting'],
        correctIndex: 0,
        explanation: 'Earlier past → past perfect.',
      },
      {
        conceptKey: 'en.b2.reported_speech',
        stem: 'She said she ____ the keys at home.',
        prompt: 'Choose the correct form.',
        options: ['had left', 'leaves', 'is leaving', 'leave'],
        correctIndex: 0,
        explanation: 'Backshift in reported speech.',
      },
    ],
    C1: [
      {
        conceptKey: 'en.c1.inversion_rarely',
        stem: 'In the latest audit notes, rarely ____ such careful documentation in an early draft.',
        prompt: 'Choose the correct form.',
        options: ['do we encounter', 'we encounter', 'we do encounter', 'encounter we'],
        correctIndex: 0,
        explanation: 'Negative adverb fronting → subject–auxiliary inversion.',
      },
      {
        conceptKey: 'en.c1.mixed_conditional',
        stem: 'If she had taken the earlier train this morning, she ____ here for the briefing now.',
        prompt: 'Choose the correct form.',
        options: ['would be', 'would have been', 'will be', 'is'],
        correctIndex: 0,
        explanation: 'Mixed conditional: past condition, present result.',
      },
    ],
    C2: [
      {
        conceptKey: 'en.c2.subjunctive_insist',
        stem: 'After the legal review, the board insisted that the indemnity clause ____ unchanged in the final text.',
        prompt: 'Choose the correct form.',
        options: ['remain', 'remains', 'remained', 'remaining'],
        correctIndex: 0,
        explanation: 'Mandative subjunctive after insist that.',
      },
      {
        conceptKey: 'en.c2.preposition_nuance',
        stem: 'The amendment is contingent ____ written approval from legal before it can take effect.',
        prompt: 'Choose the correct form.',
        options: ['on', 'to', 'for', 'with'],
        correctIndex: 0,
        explanation: 'Contingent on.',
      },
    ],
  },
  vocabulary: {
    A1: [
      {
        conceptKey: 'en.a1.vocab_breakfast',
        stem: 'I usually have ____ at 8.',
        prompt: 'Choose the best word.',
        options: ['breakfast', 'lunch', 'dinner', 'snack'],
        correctIndex: 0,
        explanation: 'Morning meal.',
      },
      {
        conceptKey: 'en.a1.vocab_ticket',
        stem: 'You need a ____ to enter the cinema.',
        prompt: 'Choose the best word.',
        options: ['ticket', 'receipt', 'menu', 'map'],
        correctIndex: 0,
        explanation: 'Entry ticket.',
      },
    ],
    A2: [
      {
        conceptKey: 'en.a2.vocab_appointment',
        stem: 'I have a dentist ____ at 4.',
        prompt: 'Choose the best word.',
        options: ['appointment', 'invitation', 'meeting', 'visit'],
        correctIndex: 0,
        explanation: 'Scheduled medical appointment.',
      },
      {
        conceptKey: 'en.a2.vocab_borrow',
        stem: 'Can I ____ your pen for a minute?',
        prompt: 'Choose the best word.',
        options: ['borrow', 'lend', 'rent', 'own'],
        correctIndex: 0,
        explanation: 'Borrow = take temporarily.',
      },
    ],
    B1: [
      {
        conceptKey: 'en.b1.vocab_deadline',
        stem: 'Please send the form before the ____ on Friday.',
        prompt: 'Choose the best word.',
        options: ['deadline', 'outline', 'headline', 'timeline'],
        correctIndex: 0,
        explanation: 'Last date to submit.',
      },
      {
        conceptKey: 'en.b1.collocation_make_decision',
        stem: 'We need to ____ a decision today.',
        prompt: 'Choose the best word.',
        options: ['make', 'do', 'take', 'put'],
        correctIndex: 0,
        explanation: 'Make a decision.',
      },
    ],
    B2: [
      {
        conceptKey: 'en.b2.near_synonym_raise_rise',
        stem: 'The company plans to ____ salaries next year.',
        prompt: 'Choose the best word.',
        options: ['raise', 'rise', 'arise', 'arouse'],
        correctIndex: 0,
        explanation: 'Raise is transitive.',
      },
      {
        conceptKey: 'en.b2.collocation_heavy_traffic',
        stem: 'There was ____ traffic on the ring road.',
        prompt: 'Choose the best word.',
        options: ['heavy', 'strong', 'hard', 'thick'],
        correctIndex: 0,
        explanation: 'Heavy traffic collocation.',
      },
    ],
    C1: [
      {
        conceptKey: 'en.c1.near_mitigate_context',
        stem:
          'In the risk memo to investors, the authors try to ____ residual concerns about delays without promising any refund path or revised timeline.',
        prompt: 'Choose the best word.',
        options: ['mitigate', 'amplify', 'ignore', 'celebrate'],
        correctIndex: 0,
        explanation: 'Mitigate = reduce the force of concerns.',
      },
      {
        conceptKey: 'en.c1.register_dismissive_context',
        stem:
          'Colleagues found his reply politely ____ of the proposal: he thanked them, then moved on without engaging any of the substance.',
        prompt: 'Choose the best word.',
        options: ['dismissive', 'supportive', 'curious', 'grateful'],
        correctIndex: 0,
        explanation: 'Dismissive of = rejecting stance under polite cover.',
      },
    ],
    C2: [
      {
        conceptKey: 'en.c2.stance_hedged_refusal',
        stem:
          'Her closing line thanked the panel “for an intriguing direction” and suggested it “may sit better in a later phase,” while offering no next step. The stance is best described as ____ rather than endorsement.',
        prompt: 'Choose the best word.',
        options: ['non-committal', 'enthusiastic', 'hostile', 'procedural'],
        correctIndex: 0,
        explanation: 'Polite deferral without commitment.',
      },
      {
        conceptKey: 'en.c2.collocation_cast_doubt_context',
        stem:
          'After the revised shipment logs appeared, several analysts said the new figures ____ doubt on the earlier forecast that inventories would clear by June.',
        prompt: 'Choose the best word.',
        options: ['cast', 'threw', 'placed', 'made'],
        correctIndex: 0,
        explanation: 'Cast doubt on is the fixed collocation.',
      },
    ],
  },
  reading: {
    A1: [
      {
        conceptKey: 'en.a1.read_shop_hours',
        stem: 'Sign: "Closed for lunch 13:00–14:00." When can you shop?',
        prompt: 'Choose the best answer.',
        options: [
          'Before 13:00 or after 14:00',
          'Only at 13:00',
          'All afternoon without a break',
          'Never today',
        ],
        correctIndex: 0,
        explanation: 'Closed only during that lunch hour.',
      },
      {
        conceptKey: 'en.a1.read_bus_stop',
        stem: 'Board: "Bus 12 → Station." Where does bus 12 go?',
        prompt: 'Choose the best answer.',
        options: ['To the station', 'To bus 12 only', 'Around the city forever', 'Nowhere'],
        correctIndex: 0,
        explanation: 'Arrow indicates destination.',
      },
    ],
    A2: [
      {
        conceptKey: 'en.a2.read_wifi_password',
        stem: 'Card: "Wi‑Fi: Guest / password on receipt." Where is the password?',
        prompt: 'Choose the best answer.',
        options: ['On the receipt', 'On the guest', 'Only on the router', 'Not available'],
        correctIndex: 0,
        explanation: 'Password on receipt.',
      },
      {
        conceptKey: 'en.a2.read_queue',
        stem: 'Notice: "Take a number and wait." What should you do first?',
        prompt: 'Choose the best answer.',
        options: ['Take a number', 'Wait without a number', 'Leave immediately', 'Call a manager'],
        correctIndex: 0,
        explanation: 'Take a number first.',
      },
    ],
    B1: [
      {
        conceptKey: 'en.b1.read_refund_policy',
        stem: 'Policy: "Unused tickets can be refunded within 48 hours of purchase." When is a refund possible?',
        prompt: 'Choose the best answer.',
        options: [
          'Within two days of buying, if unused',
          'Any time after the event',
          'Only before purchase',
          'Never for unused tickets',
        ],
        correctIndex: 0,
        explanation: '48 hours + unused.',
      },
      {
        conceptKey: 'en.b1.read_shift_swap',
        stem: 'Chat: "Can you cover my Thursday shift if I take your Monday?" What is offered?',
        prompt: 'Choose the best answer.',
        options: ['A swap of shifts', 'An extra day off for both', 'A resignation', 'A pay cut'],
        correctIndex: 0,
        explanation: 'Shift swap proposal.',
      },
    ],
    B2: [
      {
        conceptKey: 'en.b2.read_cautious_forecast',
        stem: 'Brief: "Growth is likely, though supply risks remain material." What stance does the writer take?',
        prompt: 'Choose the best answer.',
        options: ['Optimistic but hedged', 'Certain collapse', 'No opinion', 'Pure celebration'],
        correctIndex: 0,
        explanation: 'Likely + though = hedged optimism.',
      },
      {
        conceptKey: 'en.b2.read_implied_reject',
        stem: 'Email: "We admire the concept; timing is the obstacle." What is implied?',
        prompt: 'Choose the best answer.',
        options: [
          'A soft no for now',
          'Immediate approval',
          'A request for payment',
          'Praise without reservation',
        ],
        correctIndex: 0,
        explanation: 'Timing obstacle = deferral/refusal.',
      },
    ],
    C1: [
      {
        conceptKey: 'en.c1.read_understate_criticism',
        stem:
          'Peer review note: "The paper is carefully organised and the prose is controlled. Still, the central claim leans on a premise that the authors leave largely unexamined, which weakens the force of the later recommendations." What is the main critique?',
        prompt: 'Choose the best answer.',
        options: [
          'The foundation of the claim is insufficiently scrutinised',
          'The writing is untidy and uncontrolled',
          'There is no argument at all',
          'The premise is already proven beyond doubt',
        ],
        correctIndex: 0,
        explanation: 'Unexamined premise = soft but substantive critique.',
      },
      {
        conceptKey: 'en.c1.read_discourse_contrast',
        stem:
          'Quarterly note: "Unit costs fell again in Q2 after the supplier switch. Nonetheless, the hiring freeze stayed in place, and several teams reported capacity strain." What discourse relation does "Nonetheless" mark?',
        prompt: 'Choose the best answer.',
        options: [
          'Contrast / unexpected continuation',
          'Cause of the hiring freeze',
          'Definition of Q2 results',
          'A list of synonyms',
        ],
        correctIndex: 0,
        explanation: 'Nonetheless marks contrast with prior positive news.',
      },
    ],
    C2: [
      {
        conceptKey: 'en.c2.read_pragmatic_implicature',
        stem:
          'Committee minutes: "Members thanked the authors for circulating the draft. The committee noted the proposal with interest and then moved promptly to other business without requesting a follow-up paper or a vote." What is the most likely pragmatic reading?',
        prompt: 'Choose the best answer.',
        options: [
          'Polite non-commitment rather than endorsement',
          'Unanimous approval of funding',
          'A request for immediate implementation',
          'A clerical error in the minutes',
        ],
        correctIndex: 0,
        explanation: 'Noted with interest + no follow-up ≈ shelving.',
      },
      {
        conceptKey: 'en.c2.read_ambiguity_resolve',
        stem:
          'Contract clause: "Participants may withdraw after notice, which must be written and delivered to the secretariat at least ten days before the effective date." What must be written?',
        prompt: 'Choose the best answer.',
        options: [
          'The notice',
          'The withdrawal only after the event',
          'The participants themselves',
          'Nothing in particular',
        ],
        correctIndex: 0,
        explanation: 'Which attaches to notice.',
      },
    ],
  },
  functional: {
    A1: [
      {
        conceptKey: 'en.a1.func_ask_price',
        stem: 'In a shop you want the price. What do you say?',
        prompt: 'Choose the best response.',
        options: ['How much is this?', 'How many is this?', 'What time is this?', 'Where is the toilet?'],
        correctIndex: 0,
        explanation: 'How much asks for price.',
      },
      {
        conceptKey: 'en.a1.func_thanks',
        stem: 'Someone holds the door for you. What do you say?',
        prompt: 'Choose the best response.',
        options: ['Thank you.', 'Excuse me.', 'Good morning.', "You're welcome."],
        correctIndex: 0,
        explanation: 'Thanks is the appropriate response.',
      },
    ],
    A2: [
      {
        conceptKey: 'en.a2.func_ask_repeat',
        stem: 'You did not hear an address clearly. What do you say?',
        prompt: 'Choose the best response.',
        options: [
          'Could you say that again, please?',
          'Could you speak more quietly, please?',
          'Where is the nearest station?',
          'How much does it cost?',
        ],
        correctIndex: 0,
        explanation: 'Polite request to repeat.',
      },
      {
        conceptKey: 'en.a2.func_suggest_time',
        stem: 'You want to suggest meeting at 6. What do you say?',
        prompt: 'Choose the best response.',
        options: [
          'Shall we meet at 6?',
          'We met at 6 yesterday.',
          'Sorry, I am busy right now.',
          'How much does the ticket cost?',
        ],
        correctIndex: 0,
        explanation: 'Shall we… is a suggestion.',
      },
    ],
    B1: [
      {
        conceptKey: 'en.b1.func_soft_refuse',
        stem: 'A colleague invites you out tonight; you already have plans. What do you say?',
        prompt: 'Choose the best response.',
        options: [
          'I would love to, but I already have plans.',
          'Yes, I can come at any time.',
          'Why are you asking me that?',
          'Please send me the invoice.',
        ],
        correctIndex: 0,
        explanation: 'Soft refuse with a reason.',
      },
      {
        conceptKey: 'en.b1.func_clarify_deadline',
        stem: 'You need to confirm whether Friday is still the due date. What do you say?',
        prompt: 'Choose the best response.',
        options: [
          'Just to confirm — is Friday still the deadline?',
          'Please cancel the whole project today.',
          'I will ignore the deadline for now.',
          'Can you lend me your laptop?',
        ],
        correctIndex: 0,
        explanation: 'Polite confirmation check.',
      },
    ],
    B2: [
      {
        conceptKey: 'en.b2.func_hedge_disagreement',
        stem: 'In a meeting you partly disagree with a risk assessment. What do you say?',
        prompt: 'Choose the best response.',
        options: [
          'I take your point, though I would weigh the risks differently.',
          'You are completely wrong about everything.',
          'I agree with every detail without reservation.',
          'Let us change the subject to lunch plans.',
        ],
        correctIndex: 0,
        explanation: 'Hedged disagreement.',
      },
      {
        conceptKey: 'en.b2.func_request_extension',
        stem: 'You need two more days to finish a report. What do you say?',
        prompt: 'Choose the best response.',
        options: [
          'Would it be possible to extend the deadline by two days?',
          'I am quitting the project immediately.',
          'Please delete the report from the shared drive.',
          'The deadline was never important.',
        ],
        correctIndex: 0,
        explanation: 'Polite extension request.',
      },
    ],
    C1: [
      {
        conceptKey: 'en.c1.func_diplomatic_pushback',
        stem:
          'A client pushes an aggressive launch date that would force unsafe shortcuts. What do you say?',
        prompt: 'Choose the best response.',
        options: [
          'We can aim for that date if scope is reduced; otherwise quality would suffer.',
          'That date is fine; we will ignore testing entirely.',
          'We refuse because you are always wrong.',
          'Please decide alone and email us the result.',
        ],
        correctIndex: 0,
        explanation: 'Conditional, diplomatic pushback.',
      },
      {
        conceptKey: 'en.c1.func_close_conflict',
        stem:
          'A planning discussion is getting heated and unproductive. What do you say to reset it?',
        prompt: 'Choose the best response.',
        options: [
          'Perhaps we park the contentious points and list what we already agree on.',
          'Stop talking; I have already decided for everyone.',
          'We should ignore disagreement and pretend it never happened.',
          'Heated talk means the meeting must end with no notes.',
        ],
        correctIndex: 0,
        explanation: 'De-escalation and structure.',
      },
    ],
    C2: [
      {
        conceptKey: 'en.c2.func_implicature_decline',
        stem:
          'You want to decline a proposal without a blunt refusal, leaving the relationship intact. What do you say?',
        prompt: 'Choose the best response.',
        options: [
          'That direction is intriguing; it may sit better in a later phase.',
          'No, and do not contact us again about this.',
          'The idea is worthless and should be abandoned today.',
          'We approve the proposal in full with immediate funding.',
        ],
        correctIndex: 0,
        explanation: 'Indirect deferral via implicature.',
      },
      {
        conceptKey: 'en.c2.func_stance_align',
        stem:
          'You want to show partial alignment with a strategy without giving full endorsement. What do you say?',
        prompt: 'Choose the best response.',
        options: [
          'I am sympathetic to the aim, pending clearer success metrics.',
          'I approve every detail without any conditions.',
          'I reject the aim but praise the metrics loudly.',
          'Sympathy here equals a signed legal commitment.',
        ],
        correctIndex: 0,
        explanation: 'Conditional / partial alignment.',
      },
    ],
  },
};
