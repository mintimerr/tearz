import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';

import { isWeakPlacementQuestion, shuffleChoices, stripPinyin } from '@/utils/placement-adaptive';
import type { LocalPlacementQuestion } from '@/utils/placement-local-questions';
import {
  buildSeenQuestionKeys,
  isQuestionAlreadySeen,
  normalizePlacementPrompt,
  questionContentKey,
} from '@/utils/placement-seen';

type Draft = Omit<LocalPlacementQuestion, 'id'>;

function pick<T>(arr: T[], salt: number): T {
  return arr[Math.abs(salt) % arr.length];
}

function hashSalt(base: number, attempt: number) {
  return base + attempt * 9973 + attempt * attempt * 131;
}

function finalizeQuestion(
  lang: CompanionChatApiLanguage,
  base: Draft,
  salt: number,
): LocalPlacementQuestion | null {
  let prompt = base.prompt;
  let choices = [...base.choices];
  let correctChoice = base.correctChoice;
  if (lang === 'chinese') {
    prompt = stripPinyin(prompt);
    choices = choices.map(stripPinyin);
    correctChoice = stripPinyin(correctChoice);
  }
  const shuffled = shuffleChoices({
    ...base,
    id: 'tmp',
    prompt,
    choices,
    correctChoice,
  });
  if (isWeakPlacementQuestion(shuffled.prompt, shuffled.choices, shuffled.kind)) return null;
  const id = `proc-${lang}-${Math.abs(salt).toString(36)}-${questionContentKey(shuffled)
    .slice(0, 24)
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '')}`;
  return { ...shuffled, id };
}

function mcq(
  s: number,
  items: { p: string; c: string; w: string[] }[],
  difficultyBase = 12,
): Draft {
  const item = pick(items, s);
  const shuffled = shuffleChoices({
    id: 'x',
    kind: 'multiple_choice',
    section: 'comprehension',
    difficulty: difficultyBase,
    instruction: '',
    prompt: item.p,
    correctChoice: item.c,
    choices: [item.c, ...item.w],
  });
  return {
    kind: 'multiple_choice',
    section: 'comprehension',
    difficulty: difficultyBase + (s % 8),
    instruction: 'Choose the closest meaning.',
    prompt: item.p,
    choices: shuffled.choices,
    correctChoice: shuffled.correctChoice,
  };
}

function blank(
  s: number,
  items: { prompt: string; c: string; w: string[] }[],
  difficultyBase = 8,
): Draft {
  const item = pick(items, s);
  const shuffled = shuffleChoices({
    id: 'x',
    kind: 'select_missing_word',
    section: 'grammar',
    difficulty: difficultyBase,
    instruction: '',
    prompt: item.prompt,
    correctChoice: item.c,
    choices: [item.c, ...item.w],
  });
  return {
    kind: 'select_missing_word',
    section: 'grammar',
    difficulty: difficultyBase + (s % 9),
    instruction: 'Pick the correct form.',
    prompt: item.prompt,
    choices: shuffled.choices,
    correctChoice: shuffled.correctChoice,
  };
}

const ENGLISH_GRAMMAR = [
  { prompt: 'She ___ to the office every day.', c: 'goes', w: ['go', 'going', 'gone'] },
  { prompt: 'They ___ dinner when I called.', c: 'were having', w: ['have', 'had', 'has'] },
  { prompt: 'We ___ already finished the report.', c: 'have', w: ['has', 'had', 'having'] },
  { prompt: 'He ___ in Berlin since 2019.', c: 'has lived', w: ['lives', 'live', 'living'] },
  { prompt: 'If I ___ more time, I would travel more.', c: 'had', w: ['have', 'has', 'having'] },
  { prompt: 'By the time we arrived, the movie ___ started.', c: 'had', w: ['has', 'was', 'is'] },
  { prompt: 'She suggested that he ___ a doctor.', c: 'see', w: ['sees', 'saw', 'seeing'] },
  { prompt: 'Neither the manager nor the employees ___ satisfied.', c: 'are', w: ['is', 'was', 'be'] },
];

const ENGLISH_MCQ = [
  {
    p: 'The contract expires at the end of the month.',
    c: 'The agreement runs out this month.',
    w: ['They signed a new contract today.', 'The project was canceled.', 'The price increased suddenly.'],
  },
  {
    p: 'She backed out of the deal at the last minute.',
    c: 'She withdrew from the agreement suddenly.',
    w: ['She signed immediately.', 'She forgot the meeting.', 'She accepted all terms.'],
  },
  {
    p: 'They called off the launch due to technical issues.',
    c: 'They canceled the launch because of technical problems.',
    w: ['The launch was successful.', 'They hired more engineers.', 'The product sold out.'],
  },
  {
    p: 'I ran into an old friend at the conference.',
    c: 'I unexpectedly met an old friend at the conference.',
    w: ['I avoided my friend.', 'I left the conference early.', 'I forgot about the event.'],
  },
];

const FRENCH_GRAMMAR = [
  { prompt: 'Je ___ au bureau demain.', c: 'vais', w: ['va', 'allons', 'allez'] },
  { prompt: 'Tu ___ français très bien.', c: 'parles', w: ['parle', 'parlons', 'parlez'] },
  { prompt: 'Nous ___ à la bibliothèque.', c: 'allons', w: ['vais', 'va', 'allez'] },
  { prompt: 'Elle ___ ses devoirs avant le dîner.', c: 'finit', w: ['finis', 'finissez', 'finir'] },
  { prompt: 'Ils ___ depuis deux heures.', c: 'attendent', w: ['attend', 'attendez', 'attendre'] },
  { prompt: 'Vous ___ le train à 8 heures.', c: 'prenez', w: ['prend', 'prenons', 'prendre'] },
  { prompt: 'Hier, nous ___ au cinéma.', c: 'sommes allés', w: ['allons', 'irons', 'allions'] },
  { prompt: 'Si j\'avais su, je ___ plus tôt.', c: 'serais parti', w: ['partirais', 'partais', 'suis parti'] },
  { prompt: 'C\'est le livre ___ je t\'ai parlé.', c: 'dont', w: ['que', 'où', 'qui'] },
  { prompt: 'Il faut que tu ___ à l\'heure.', c: 'arrives', w: ['arrive', 'arriveras', 'es arrivé'] },
];

const FRENCH_MCQ = [
  {
    p: 'Il a remis la décision à la semaine prochaine.',
    c: 'He postponed the decision until next week.',
    w: ['He made the decision today.', 'He rejected the proposal.', 'He forgot the meeting.'],
  },
  {
    p: 'Elle a refusé poliment l\'invitation.',
    c: 'She politely declined the invitation.',
    w: ['She accepted immediately.', 'She did not receive it.', 'She arrived late.'],
  },
  {
    p: 'Le train a du retard à cause des travaux.',
    c: 'The train is delayed because of construction work.',
    w: ['The train left early.', 'They canceled all trains forever.', 'The station is closed today only for tourists.'],
  },
  {
    p: 'Nous avons fini par trouver un compromis.',
    c: 'We eventually reached a compromise.',
    w: ['We never discussed the problem.', 'We refused to meet.', 'We canceled the project completely.'],
  },
  {
    p: 'Il s\'en est fallu de peu qu\'il rate son train.',
    c: 'He almost missed his train.',
    w: ['He missed every train this week.', 'He arrived two hours early.', 'He never takes the train.'],
  },
  {
    p: 'Bien qu\'il soit fatigué, il a terminé le projet.',
    c: 'He finished the project despite being tired.',
    w: ['He stopped because he was tired.', 'He was not tired at all.', 'He did not finish the project.'],
  },
  {
    p: 'Elle vient d\'arriver à la gare.',
    c: 'She has just arrived at the station.',
    w: ['She left the station yesterday.', 'She will arrive next week.', 'She never goes to the station.'],
  },
  {
    p: 'On m\'a conseillé de revoir mon planning.',
    c: 'Someone advised me to revise my schedule.',
    w: ['I canceled my schedule completely.', 'Nobody talked about planning.', 'I finished the project early.'],
  },
];

const GERMAN_GRAMMAR = [
  { prompt: 'Ich ___ morgen ins Büro.', c: 'gehe', w: ['geht', 'gehen', 'ging'] },
  { prompt: 'Du ___ sehr gut Deutsch.', c: 'sprichst', w: ['spreche', 'sprechen', 'sprach'] },
  { prompt: 'Wir ___ in die Stadt.', c: 'fahren', w: ['fährt', 'fahre', 'fuhr'] },
  { prompt: 'Er ___ schon seit zehn Jahren hier.', c: 'arbeitet', w: ['arbeiten', 'arbeitete', 'gearbeitet'] },
  { prompt: 'Wenn ich Zeit ___, würde ich mehr lesen.', c: 'hätte', w: ['habe', 'hatte', 'haben'] },
  { prompt: 'Gestern ___ wir lange im Park spazieren.', c: 'sind', w: ['haben', 'war', 'wird'] },
];

const GERMAN_MCQ = [
  {
    p: 'Er hat das Angebot höflich abgelehnt.',
    c: 'He politely rejected the offer.',
    w: ['He accepted the offer.', 'He ignored the email.', 'He forgot the appointment.'],
  },
  {
    p: 'Die Besprechung wurde kurzfristig verschoben.',
    c: 'The meeting was moved at short notice.',
    w: ['The meeting was canceled forever.', 'The meeting started early.', 'Nobody came.'],
  },
  {
    p: 'Obwohl sie müde war, hat sie die Arbeit beendet.',
    c: 'She finished the work even though she was tired.',
    w: ['She stopped because she was tired.', 'She was not tired.', 'She never started the work.'],
  },
  {
    p: 'Der Zug hat wegen Bauarbeiten Verspätung.',
    c: 'The train is delayed because of construction.',
    w: ['The train left early.', 'All trains were canceled permanently.', 'The station is closed for tourists only.'],
  },
];

const RUSSIAN_GRAMMAR = [
  { prompt: 'Я завтра ___ на работу.', c: 'иду', w: ['идёт', 'идём', 'идут'] },
  { prompt: 'Он хорошо ___ по-русски.', c: 'говорит', w: ['говорю', 'говорим', 'говорят'] },
  { prompt: 'Мы ___ в школу каждый день.', c: 'ходим', w: ['хожу', 'ходит', 'ходят'] },
  { prompt: 'Она ___ здесь уже пять лет.', c: 'работает', w: ['работала', 'будет работать', 'работать'] },
  { prompt: 'Если бы у меня было время, я ___ больше.', c: 'читал', w: ['читаю', 'прочитаю', 'читать'] },
  { prompt: 'Вчера мы ___ в новый ресторан.', c: 'ходили', w: ['ходим', 'пойдём', 'ходил'] },
];

const RUSSIAN_MCQ = [
  {
    p: 'Он вежливо отказался от предложения.',
    c: 'He politely declined the offer.',
    w: ['He accepted immediately.', 'He did not hear it.', 'He arrived late.'],
  },
  {
    p: 'Встречу перенесли в последний момент.',
    c: 'The meeting was postponed at the last minute.',
    w: ['The meeting ended early.', 'Nobody attended.', 'They canceled the project forever.'],
  },
  {
    p: 'Несмотря на усталость, она закончила работу.',
    c: 'She finished the work despite being tired.',
    w: ['She stopped because she was tired.', 'She was not tired.', 'She never started.'],
  },
  {
    p: 'Поезд задерживается из-за ремонта путей.',
    c: 'The train is delayed because of track repairs.',
    w: ['The train left early.', 'All trains were canceled forever.', 'The station is closed for tourists only.'],
  },
];

const CHINESE_GRAMMAR = [
  { prompt: '我明天要去___。', c: '北京', w: ['北京吗', '北京的', '北京了'] },
  { prompt: '他已经___三个小时了。', c: '等', w: ['等了', '等着', '等过'] },
  { prompt: '这个问题比我想的___。', c: '难得多', w: ['很难吗', '一样难', '不难'] },
  { prompt: '要是你早点告诉我，我___准备。', c: '就会', w: ['才', '又', '还'] },
  { prompt: '我___学生。', c: '是', w: ['有', '在', '去'] },
  { prompt: '一___书', c: '本', w: ['个', '张', '条'] },
];

const CHINESE_MCQ = [
  {
    p: '会议在最后一刻被推迟了。',
    c: 'The meeting was postponed at the last minute.',
    w: ['The meeting started early.', 'Nobody came to the meeting.', 'The project was canceled forever.'],
  },
  {
    p: '她礼貌地拒绝了邀请。',
    c: 'She politely declined the invitation.',
    w: ['She accepted immediately.', 'She forgot the invitation.', 'She arrived late.'],
  },
  {
    p: '虽然很累，他还是完成了项目。',
    c: 'He finished the project even though he was tired.',
    w: ['He stopped because he was tired.', 'He was not tired.', 'He never started the project.'],
  },
  {
    p: '火车因为施工晚点了。',
    c: 'The train is delayed because of construction.',
    w: ['The train left early.', 'All trains were canceled forever.', 'The station is closed for tourists only.'],
  },
];

function packsFor(lang: CompanionChatApiLanguage) {
  if (lang === 'french') return { grammar: FRENCH_GRAMMAR, mcq: FRENCH_MCQ };
  if (lang === 'german') return { grammar: GERMAN_GRAMMAR, mcq: GERMAN_MCQ };
  if (lang === 'russian') return { grammar: RUSSIAN_GRAMMAR, mcq: RUSSIAN_MCQ };
  if (lang === 'chinese') return { grammar: CHINESE_GRAMMAR, mcq: CHINESE_MCQ };
  return { grammar: ENGLISH_GRAMMAR, mcq: ENGLISH_MCQ };
}

function buildForSection(
  lang: CompanionChatApiLanguage,
  section: string,
  salt: number,
): Draft | null {
  const packs = packsFor(lang);
  const wantGrammar = section === 'grammar' || section === 'structure';
  const wantMcq = section === 'comprehension' || section === 'phrases' || section === 'dialogue';
  if (wantGrammar) return blank(salt, packs.grammar);
  if (wantMcq) return mcq(salt, packs.mcq);
  return salt % 2 === 0 ? blank(salt, packs.grammar) : mcq(salt, packs.mcq);
}

export function generateProceduralQuestion(
  lang: CompanionChatApiLanguage,
  targetDifficulty: number,
  section: string,
  seen: ReturnType<typeof buildSeenQuestionKeys>,
  sessionSalt: number,
  attempt: number,
): LocalPlacementQuestion | null {
  const salt = hashSalt(sessionSalt + targetDifficulty + attempt * 41, attempt);
  const built = buildForSection(lang, section, salt);
  if (!built) return null;
  const q = finalizeQuestion(lang, built, salt);
  if (!q) return null;
  if (!isQuestionAlreadySeen(q, seen)) return q;
  return null;
}

/**
 * Always returns a question. Prefers unseen vs lifetime; then vs session-only;
 * then recycles with a unique id so the test never hard-fails.
 */
export function generateFreshProceduralQuestion(
  lang: CompanionChatApiLanguage,
  targetDifficulty: number,
  section: string,
  seenIds: string[],
  seenPrompts: string[],
  seenContentKeys: string[],
  sessionSalt: number,
  sessionOnlyPrompts: string[] = [],
): LocalPlacementQuestion {
  const fullSeen = buildSeenQuestionKeys([]);
  for (const id of seenIds) fullSeen.ids.add(id);
  for (const prompt of seenPrompts) fullSeen.prompts.add(normalizePlacementPrompt(prompt));
  for (const key of seenContentKeys) fullSeen.contents.add(key);

  for (let attempt = 0; attempt < 160; attempt += 1) {
    const q = generateProceduralQuestion(
      lang,
      targetDifficulty + (attempt % 9) - 4,
      section,
      fullSeen,
      sessionSalt,
      attempt,
    );
    if (q) return q;
  }

  const sessionSeen = buildSeenQuestionKeys([]);
  for (const prompt of sessionOnlyPrompts) sessionSeen.prompts.add(normalizePlacementPrompt(prompt));

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const q = generateProceduralQuestion(
      lang,
      targetDifficulty,
      section,
      sessionSeen,
      sessionSalt + 50_000,
      attempt + 200,
    );
    if (q) return q;
  }

  // Absolute fallback — never throw; unique id keeps the UI moving.
  const salt = hashSalt(sessionSalt, Date.now() % 10_000);
  const draft = buildForSection(lang, section, salt) ?? blank(salt, packsFor(lang).grammar);
  const forced = finalizeQuestion(lang, draft, salt) ?? {
    ...draft,
    id: `proc-fallback-${lang}-${Math.abs(salt).toString(36)}`,
  };
  return shuffleChoices(forced);
}
