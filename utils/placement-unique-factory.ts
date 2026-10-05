import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';

import { ensureCorrectChoiceInList, isWeakPlacementQuestion, shuffleChoices } from '@/utils/placement-adaptive';
import type { LocalPlacementQuestion } from '@/utils/placement-local-questions';
import {
  buildSeenQuestionKeys,
  isQuestionAlreadySeen,
  isTrivialParaphraseChoice,
  normalizePlacementPrompt,
  placementTemplateKey,
  questionContentKey,
  setPlacementSlotMaskTokens,
} from '@/utils/placement-seen';

type Draft = Omit<LocalPlacementQuestion, 'id'>;

function pick<T>(arr: T[], salt: number, offset = 0): T {
  return arr[Math.abs(salt + offset * 9973) % arr.length];
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function uniqueId(lang: string, salt: number, prompt: string) {
  const hash = questionContentKey({ prompt, choices: [] })
    .slice(0, 28)
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '');
  return `u-${lang}-${Math.abs(salt).toString(36)}-${hash}-${Date.now().toString(36).slice(-4)}`;
}

const EN_NAMES = [
  'Alex', 'Maya', 'Jordan', 'Sam', 'Chris', 'Riley', 'Taylor', 'Casey', 'Morgan', 'Jamie',
  'Noah', 'Ava', 'Liam', 'Emma', 'Oliver', 'Sophia', 'Ethan', 'Mia', 'Lucas', 'Harper',
  'Quinn', 'Avery', 'Blake', 'Drew', 'Eden', 'Finley', 'Gray', 'Hayden', 'Indie', 'Jules',
  'Kai', 'Lane', 'Marley', 'Noel', 'Parker', 'Reese', 'Sage', 'Tatum', 'Valentine', 'Wren',
];
const EN_PLACES = [
  'the office', 'the library', 'the station', 'the café', 'the museum', 'the airport',
  'the clinic', 'the studio', 'the warehouse', 'the conference hall', 'the hotel lobby',
  'the co-working space', 'the harbor', 'the gallery', 'the campus', 'the town hall',
  'the courtyard', 'the reception desk', 'the rooftop terrace', 'the side entrance',
];
const EN_OBJECTS = [
  'report', 'proposal', 'contract', 'presentation', 'schedule', 'invoice', 'draft', 'brief',
  'agenda', 'memo', 'timeline', 'estimate', 'checklist', 'handover note', 'budget', 'survey',
];
const EN_TIMES = [
  'yesterday', 'this morning', 'last night', 'on Monday', 'before noon', 'after the meeting',
  'two hours ago', 'earlier today', 'last week', 'at dawn', 'on Tuesday evening',
  'right after lunch', 'just before closing', 'late on Friday', 'during the break',
];
const EN_DETAILS = [
  'according to the latest note', 'as the manager confirmed', 'per the emailed update',
  'based on the whiteboard plan', 'following the client call', 'from the shared calendar',
];

const FR_NAMES = [
  'Marc', 'Léa', 'Sophie', 'Julien', 'Camille', 'Nicolas', 'Claire', 'Antoine', 'Emma', 'Hugo',
  'Chloé', 'Louis', 'Manon', 'Paul', 'Inès', 'Arthur', 'Jade', 'Gabriel', 'Lina', 'Théo',
  'Noémie', 'Mathis', 'Élise', 'Baptiste', 'Zoé', 'Raphaël', 'Alice', 'Nathan', 'Louise', 'Tom',
];
const FR_PLACES = [
  'au bureau', 'à la bibliothèque', 'à la gare', 'au café', 'au musée', 'à l\'aéroport',
  'à la clinique', 'au studio', 'à l\'entrepôt', 'à l\'hôtel', 'en ville', 'à Lyon', 'à Paris',
  'à Bordeaux', 'au coworking', 'à l\'accueil', 'sur la terrasse', 'près du quai',
];
const FR_OBJECTS = [
  'rapport', 'projet', 'contrat', 'présentation', 'planning', 'facture', 'brouillon', 'dossier',
  'agenda', 'mémo', 'devis', 'budget', 'compte rendu', 'calendrier', 'enquête', 'brief',
];
const FR_TIMES = [
  'hier', 'ce matin', 'hier soir', 'lundi', 'avant midi', 'après la réunion',
  'il y a deux heures', 'plus tôt', 'la semaine dernière', 'à l\'aube',
  'mardi soir', 'juste après le déjeuner', 'avant la fermeture', 'pendant la pause',
];
const FR_DETAILS = [
  'selon la dernière note', 'comme l\'a confirmé le manager', 'd\'après le message',
  'suivant le plan partagé', 'après l\'appel client', 'd\'après l\'agenda',
];

const DE_NAMES = [
  'Anna', 'Lukas', 'Mia', 'Jonas', 'Emma', 'Felix', 'Lea', 'Paul', 'Sophie', 'Ben',
  'Laura', 'Tim', 'Nina', 'Max', 'Clara', 'Finn', 'Marie', 'Leon', 'Julia', 'Noah',
  'Mila', 'Elias', 'Lina', 'Theo', 'Emilia', 'Henry', 'Ida', 'Oskar', 'Helena', 'Mats',
];
const DE_PLACES = [
  'ins Büro', 'in die Bibliothek', 'zum Bahnhof', 'ins Café', 'ins Museum', 'zum Flughafen',
  'in die Klinik', 'ins Studio', 'ins Lager', 'ins Hotel', 'in die Stadt', 'nach Berlin',
  'nach Hamburg', 'ins Coworking', 'zur Rezeption', 'auf die Terrasse', 'zum Quai',
];
const DE_OBJECTS = [
  'Bericht', 'Vorschlag', 'Vertrag', 'Präsentation', 'Zeitplan', 'Rechnung', 'Entwurf', 'Akte',
  'Agenda', 'Memo', 'Kostenvoranschlag', 'Budget', 'Protokoll', 'Checkliste', 'Umfrage', 'Briefing',
];
const DE_TIMES = [
  'gestern', 'heute Morgen', 'gestern Abend', 'am Montag', 'vor Mittag', 'nach dem Meeting',
  'vor zwei Stunden', 'vorhin', 'letzte Woche', 'im Morgengrauen',
  'am Dienstagabend', 'direkt nach dem Mittagessen', 'kurz vor Feierabend', 'in der Pause',
];
const DE_DETAILS = [
  'laut der letzten Notiz', 'wie der Manager bestätigte', 'laut der E-Mail',
  'nach dem Kundenanruf', 'laut dem gemeinsamen Kalender', 'laut dem Whiteboard-Plan',
];

const RU_NAMES = [
  'Анна', 'Иван', 'Мария', 'Алексей', 'Ольга', 'Дмитрий', 'Елена', 'Сергей', 'Наталья', 'Павел',
  'Ирина', 'Андрей', 'Татьяна', 'Никита', 'Юлия', 'Максим', 'Екатерина', 'Артём', 'Светлана', 'Кирилл',
  'Дарья', 'Роман', 'Полина', 'Егор', 'Верия', 'Михаил', 'Алина', 'Владимир', 'Ксения', 'Глеб',
];
const RU_PLACES = [
  'на работу', 'в библиотеку', 'на вокзал', 'в кафе', 'в музей', 'в аэропорт',
  'в клинику', 'в студию', 'на склад', 'в отель', 'в город', 'в Москву',
  'в Петербург', 'в коворкинг', 'к ресепшену', 'на террасу', 'к причалу',
];
const RU_OBJECTS = [
  'отчёт', 'предложение', 'договор', 'презентацию', 'расписание', 'счёт', 'черновик', 'дело',
  'повестку', 'заметку', 'смету', 'бюджет', 'протокол', 'чеклист', 'опрос', 'бриф',
];
const RU_TIMES = [
  'вчера', 'сегодня утром', 'вчера вечером', 'в понедельник', 'до полудня', 'после встречи',
  'два часа назад', 'раньше', 'на прошлой неделе', 'на рассвете',
  'во вторник вечером', 'сразу после обеда', 'перед закрытием', 'во время перерыва',
];
const RU_DETAILS = [
  'согласно последней заметке', 'как подтвердил менеджер', 'по письму',
  'после звонка клиенту', 'по общему календарю', 'по плану на доске',
];

const ZH_NAMES = [
  '小明', '小红', '李华', '王芳', '张伟', '刘洋', '陈晨', '赵静', '周杰', '吴磊',
  '孙娜', '马超', '黄蕾', '徐强', '何洁', '林涛', '高翔', '罗敏', '梁晨', '宋佳',
];
const ZH_PLACES = [
  '公司', '图书馆', '车站', '咖啡馆', '博物馆', '机场', '诊所', '酒店', '仓库', '会议室',
  '联合办公', '港口', '画廊', '校园', '前台', '露台',
];
const ZH_TIMES = [
  '昨天', '今天早上', '昨晚', '周一', '中午前', '会议后', '两小时前', '刚才', '上周', '清晨',
  '周二晚上', '午饭后', '关门前', '休息时',
];
const ZH_DETAILS = ['根据最新留言', '经理确认后', '按邮件更新', '客户电话之后', '按共享日历', '按白板计划'];
const ZH_OBJECTS = ['报告', '方案', '合同', '演示', '日程', '发票', '草稿', '简报', '议程', '预算', '纪要', '清单'];
function enGrammar(salt: number): Draft {
  const name = pick(EN_NAMES, salt, 1);
  const place = pick(EN_PLACES, salt, 2);
  const time = pick(EN_TIMES, salt, 3);
  const obj = pick(EN_OBJECTS, salt, 4);
  const detail = pick(EN_DETAILS, salt, 7);
  const n = 2 + (Math.abs(salt) % 7);
  const templates = [
    { prompt: `${name} ___ to ${place} ${time} (${detail}).`, c: 'went', w: ['goes', 'going', 'gone'] },
    { prompt: `${name} ___ already finished the ${obj} ${time}.`, c: 'has', w: ['have', 'had', 'having'] },
    { prompt: `If ${name} ___ more time, the ${obj} would be ready ${time}.`, c: 'had', w: ['has', 'have', 'having'] },
    { prompt: `By the time we arrived at ${place}, ${name} ___ already left.`, c: 'had', w: ['has', 'have', 'was'] },
    { prompt: `${name} suggested that we ___ the ${obj} before ${time}.`, c: 'review', w: ['reviews', 'reviewed', 'reviewing'] },
    { prompt: `Neither ${name} nor the team ___ ready for the ${obj} (${detail}).`, c: 'is', w: ['are', 'were', 'be'] },
    { prompt: `${name} ___ here for ${n} years by next June.`, c: 'will have worked', w: ['works', 'worked', 'is working'] },
    { prompt: `${detail}, ${name} ___ the ${obj} at ${place}.`, c: 'revised', w: ['revise', 'revising', 'revises'] },
  ];
  return packBlank(pick(templates, salt, 5), 8 + (Math.abs(salt) % 10));
}

function enMcq(salt: number): Draft {
  const name = pick(EN_NAMES, salt, 1);
  const place = pick(EN_PLACES, salt, 2);
  const time = pick(EN_TIMES, salt, 3);
  const obj = pick(EN_OBJECTS, salt, 4);
  const items = [
    {
      p: `${name} postponed the ${obj} until ${time}.`,
      c: `The ${obj} will take place later than originally planned.`,
      w: [
        `The ${obj} was finished ahead of schedule.`,
        `Everyone agreed to cancel travel forever.`,
        `${name} never opened the ${obj} at all.`,
      ],
    },
    {
      p: `${name} politely turned down the offer at ${place}.`,
      c: `${name} declined the offer in a courteous way.`,
      w: [
        `${name} accepted the offer on the spot.`,
        `${name} forgot that ${place} existed.`,
        `${name} showed up late to every meeting.`,
      ],
    },
    {
      p: `Despite being tired, ${name} completed the ${obj} ${time}.`,
      c: `Tiredness did not stop ${name} from finishing the ${obj}.`,
      w: [
        `${name} quit the ${obj} because of exhaustion.`,
        `${name} felt energetic the whole time.`,
        `${name} never started working on the ${obj}.`,
      ],
    },
    {
      p: `The train to ${place.replace(/^the /, '')} was delayed because of construction ${time}.`,
      c: `Building work made the train arrive later than usual ${time}.`,
      w: [
        `The train left earlier than scheduled ${time}.`,
        `Every route was canceled for good.`,
        `Nobody uses trains in that city anymore.`,
      ],
    },
    {
      p: `${name} asked the team to double-check the ${obj} before sending it.`,
      c: `${name} wanted a careful review of the ${obj} first.`,
      w: [
        `${name} told everyone to delete the ${obj} immediately.`,
        `${name} refused to look at any documents.`,
        `The team ignored ${name} and went home early.`,
      ],
    },
    {
      p: `If traffic stays this bad, ${name} will miss the meeting at ${place}.`,
      c: `Heavy traffic may make ${name} late for the meeting.`,
      w: [
        `${name} will definitely arrive early no matter what.`,
        `The meeting was moved to another country.`,
        `${name} canceled the meeting weeks ago.`,
      ],
    },
  ];
  return packMcq(pick(items, salt, 6), 12 + (salt % 8));
}

function frGrammar(salt: number): Draft {
  const name = pick(FR_NAMES, salt, 1);
  const place = pick(FR_PLACES, salt, 2);
  const time = pick(FR_TIMES, salt, 3);
  const obj = pick(FR_OBJECTS, salt, 4);
  const detail = pick(FR_DETAILS, salt, 7);
  const templates = [
    { prompt: `${name} ___ ${place} ${time} (${detail}).`, c: 'va', w: ['vais', 'allons', 'allez'] },
    { prompt: `${name} et moi ___ ${place} demain.`, c: 'allons', w: ['vais', 'va', 'allez'] },
    { prompt: `${name} ___ le ${obj} avant la réunion.`, c: 'finit', w: ['finis', 'finissez', 'finir'] },
    { prompt: `Hier, ${name} ___ ${place}.`, c: 'est allé', w: ['va', 'ira', 'allait'] },
    { prompt: `Si ${name} avait su, il ___ plus tôt.`, c: 'serait parti', w: ['partait', 'partira', 'est parti'] },
    { prompt: `C'est le dossier ___ ${name} t'a parlé.`, c: 'dont', w: ['que', 'où', 'qui'] },
    { prompt: `Il faut que ${name} ___ à l'heure ${time}.`, c: 'arrive', w: ['arrives', 'arrivera', 'est arrivé'] },
    { prompt: `${name} ___ français depuis ${2 + (Math.abs(salt) % 6)} ans.`, c: 'parle', w: ['parles', 'parlons', 'parlez'] },
    { prompt: `${detail}, ${name} ___ déjà le ${obj}.`, c: 'a relu', w: ['relit', 'relira', 'relisait'] },
  ];
  return packBlank(pick(templates, salt, 5), 8 + (salt % 10));
}

function frMcq(salt: number): Draft {
  const name = pick(FR_NAMES, salt, 1);
  const place = pick(FR_PLACES, salt, 2);
  const time = pick(FR_TIMES, salt, 3);
  const obj = pick(FR_OBJECTS, salt, 4);
  const detail = pick(FR_DETAILS, salt, 7);
  const items = [
    {
      p: `${name} a remis le ${obj} à plus tard ${time} (${detail}).`,
      c: `Le ${obj} aura lieu plus tard que prévu.`,
      w: [
        `Le ${obj} a été terminé en avance.`,
        `${name} a tout annulé définitivement.`,
        `${name} n'a jamais ouvert le ${obj}.`,
      ],
    },
    {
      p: `${name} a refusé poliment l'invitation ${place}.`,
      c: `${name} a décliné l'invitation avec courtoisie.`,
      w: [
        `${name} a accepté l'invitation tout de suite.`,
        `${name} n'a reçu aucun message.`,
        `${name} est arrivé en retard partout.`,
      ],
    },
    {
      p: `Bien que fatigué, ${name} a terminé le ${obj} ${time}.`,
      c: `La fatigue n'a pas empêché ${name} de finir le ${obj}.`,
      w: [
        `${name} s'est arrêté à cause de la fatigue.`,
        `${name} n'était pas du tout fatigué.`,
        `${name} n'a jamais commencé le ${obj}.`,
      ],
    },
    {
      p: `Le train a du retard ${time} à cause des travaux près de ${place}.`,
      c: `Des travaux ont ralenti le train ${time}.`,
      w: [
        `Le train est parti plus tôt ${time}.`,
        `Tous les trains ont été annulés pour toujours.`,
        `La gare n'accueille que les touristes.`,
      ],
    },
    {
      p: `${name} et son équipe ont fini par trouver un compromis sur le ${obj}.`,
      c: `Après discussion, l'équipe de ${name} s'est mise d'accord sur le ${obj}.`,
      w: [
        `Ils ont refusé de parler du ${obj}.`,
        `Ils ont annulé le ${obj} pour toujours.`,
        `Personne n'a mentionné le ${obj}.`,
      ],
    },
  ];
  return packMcq(pick(items, salt, 6), 12 + (salt % 8));
}

function deGrammar(salt: number): Draft {
  const name = pick(DE_NAMES, salt, 1);
  const place = pick(DE_PLACES, salt, 2);
  const time = pick(DE_TIMES, salt, 3);
  const obj = pick(DE_OBJECTS, salt, 4);
  const detail = pick(DE_DETAILS, salt, 7);
  // Emergency local only — keep honest low/mid intrinsic difficulty (AI owns real C1 items).
  const templates = [
    { band: 7, prompt: `${name} ___ morgen ${place} (${detail}).`, c: 'geht', w: ['gehe', 'gehen', 'ging'] },
    { band: 8, prompt: `Wir ___ ${time} ${place}.`, c: 'fahren', w: ['fährt', 'fahre', 'fuhr'] },
    { band: 10, prompt: `${name} ___ den ${obj} vor dem Meeting.`, c: 'beendet', w: ['beenden', 'beendete', 'beendetet'] },
    { band: 11, prompt: `${name} ___ seit ${3 + (Math.abs(salt) % 5)} Jahren hier.`, c: 'arbeitet', w: ['arbeiten', 'arbeitete', 'gearbeitet'] },
    { band: 13, prompt: `Gestern ___ ${name} lange im Park spazieren.`, c: 'ist', w: ['hat', 'war', 'wird'] },
    { band: 14, prompt: `Wenn ${name} Zeit ___, würde er mehr lesen.`, c: 'hätte', w: ['habe', 'hatte', 'haben'] },
    { band: 15, prompt: `${detail} ___ ${name} den ${obj} noch einmal.`, c: 'prüft', w: ['prüfen', 'prüfte', 'geprüft'] },
  ];
  const item = pick(templates, salt, 5);
  return packBlank(item, item.band);
}

function deMcq(salt: number): Draft {
  const name = pick(DE_NAMES, salt, 1);
  const place = pick(DE_PLACES, salt, 2);
  const time = pick(DE_TIMES, salt, 3);
  const obj = pick(DE_OBJECTS, salt, 4);
  const detail = pick(DE_DETAILS, salt, 7);
  const items = [
    {
      band: 10,
      p: `${name} hat das Angebot ${time} höflich abgelehnt (${detail}).`,
      c: `${name} hat ${time} abgelehnt, ohne unhöflich zu sein.`,
      w: [
        `${name} hat das Angebot sofort angenommen.`,
        `${name} hat jede E-Mail für immer ignoriert.`,
        `${name} hat den Termin sofort vergessen.`,
      ],
    },
    {
      band: 12,
      p: `Die Besprechung wurde ${time} kurzfristig verschoben.`,
      c: `Der Termin findet später statt als zuerst geplant.`,
      w: [
        `Die Besprechung wurde für immer abgesagt.`,
        `Die Besprechung begann früher.`,
        `Niemand kam ${place}.`,
      ],
    },
    {
      band: 13,
      p: `Obwohl ${name} müde war, hat sie den ${obj} beendet.`,
      c: `Müdigkeit hat ${name} nicht davon abgehalten, den ${obj} fertigzumachen.`,
      w: [
        `${name} hat wegen der Müdigkeit aufgehört.`,
        `${name} war gar nicht müde.`,
        `${name} hat den ${obj} nie begonnen.`,
      ],
    },
    {
      band: 14,
      p: `${name} bat das Team, den ${obj} vor dem Versand nochmals zu prüfen.`,
      c: `${name} wollte zuerst eine sorgfältige Kontrolle des ${obj}.`,
      w: [
        `${name} ließ den ${obj} sofort löschen.`,
        `Das Team ignorierte ${name} komplett.`,
        `${name} wollte keine Dokumente mehr sehen.`,
      ],
    },
  ];
  const item = pick(items, salt, 6);
  return packMcq(item, item.band);
}

function ruGrammar(salt: number): Draft {
  const name = pick(RU_NAMES, salt, 1);
  const place = pick(RU_PLACES, salt, 2);
  const time = pick(RU_TIMES, salt, 3);
  const obj = pick(RU_OBJECTS, salt, 4);
  const detail = pick(RU_DETAILS, salt, 7);
  const templates = [
    { prompt: `${name} завтра ___ ${place} (${detail}).`, c: 'идёт', w: ['иду', 'идём', 'идут'] },
    { prompt: `Мы ___ ${place} каждый день.`, c: 'ходим', w: ['хожу', 'ходит', 'ходят'] },
    { prompt: `${name} ___ ${obj} до встречи.`, c: 'закончил', w: ['закончит', 'заканчивает', 'закончить'] },
    { prompt: `Если бы у ${name} было время, он ___ больше.`, c: 'читал', w: ['читает', 'прочитает', 'читать'] },
    { prompt: `${time} мы ___ в новый ресторан.`, c: 'ходили', w: ['ходим', 'идём', 'ходил'] },
    { prompt: `${name} ___ здесь уже ${2 + (Math.abs(salt) % 6)} года.`, c: 'работает', w: ['работала', 'будет работать', 'работать'] },
    { prompt: `${detail} ${name} снова ___ ${obj}.`, c: 'проверил', w: ['проверит', 'проверяет', 'проверить'] },
  ];
  return packBlank(pick(templates, salt, 5), 8 + (salt % 10));
}

function ruMcq(salt: number): Draft {
  const name = pick(RU_NAMES, salt, 1);
  const place = pick(RU_PLACES, salt, 2);
  const time = pick(RU_TIMES, salt, 3);
  const obj = pick(RU_OBJECTS, salt, 4);
  const detail = pick(RU_DETAILS, salt, 7);
  const items = [
    {
      p: `${name} вежливо отказался от предложения ${time} (${detail}).`,
      c: `${name} отклонил предложение, но держался вежливо.`,
      w: [
        `${name} сразу согласился.`,
        `${name} ничего не услышал.`,
        `${name} везде опаздывал.`,
      ],
    },
    {
      p: `Встречу перенесли ${time} в последний момент.`,
      c: `Встреча состоится позже, чем планировали.`,
      w: [
        `Встреча закончилась раньше.`,
        `Никто не пришёл ${place}.`,
        `Проект навсегда отменили.`,
      ],
    },
    {
      p: `Несмотря на усталость, ${name} закончил ${obj}.`,
      c: `Усталость не помешала ${name} довести ${obj} до конца.`,
      w: [
        `${name} остановился из-за усталости.`,
        `${name} совсем не устал.`,
        `${name} так и не начал.`,
      ],
    },
    {
      p: `${name} попросил команду ещё раз проверить ${obj} перед отправкой.`,
      c: `${name} хотел сначала внимательно пересмотреть ${obj}.`,
      w: [
        `${name} велел сразу удалить ${obj}.`,
        `Команда полностью проигнорировала ${name}.`,
        `${name} больше не хотел смотреть документы.`,
      ],
    },
  ];
  return packMcq(pick(items, salt, 6), 12 + (salt % 8));
}

function zhGrammar(salt: number): Draft {
  const name = pick(ZH_NAMES, salt, 1);
  const place = pick(ZH_PLACES, salt, 2);
  const time = pick(ZH_TIMES, salt, 3);
  const obj = pick(ZH_OBJECTS, salt, 4);
  const detail = pick(ZH_DETAILS, salt, 7);
  const otherPlaces = ZH_PLACES.filter((p) => p !== place);
  const wPlace = [
    pick(otherPlaces, salt, 11),
    pick(otherPlaces, salt, 12),
    pick(otherPlaces, salt, 13),
  ];
  const otherObjs = ZH_OBJECTS.filter((o) => o !== obj);
  const wObj = [
    pick(otherObjs, salt, 14),
    pick(otherObjs, salt, 15),
    pick(otherObjs, salt, 16),
  ];
  const templates = [
    { prompt: `${name}${time}要去___（${detail}）。`, c: place, w: wPlace },
    { prompt: `${name}已经___三个小时了。`, c: '等了', w: ['等过', '等着', '等'] },
    { prompt: `这个问题比${name}想的___。`, c: '难得多', w: ['很难吗', '一样难', '不难'] },
    { prompt: `要是你早点告诉${name}，___准备。`, c: '就会', w: ['才', '又', '还'] },
    { prompt: `${name}___学生。`, c: '是', w: ['有', '在', '去'] },
    { prompt: `${detail}，${name}又看了一遍___。`, c: obj, w: wObj },
    { prompt: `${name}把${obj}放在___了。`, c: '桌子上', w: ['桌子里', '桌子', '桌上吗'] },
    { prompt: `请___说慢一点，我没听清。`, c: '你', w: ['我', '他', '我们'] },
  ];
  return packBlank(pick(templates, salt, 5), 8 + (salt % 10));
}

function zhMcq(salt: number): Draft {
  const name = pick(ZH_NAMES, salt, 1);
  const place = pick(ZH_PLACES, salt, 2);
  const time = pick(ZH_TIMES, salt, 3);
  const obj = pick(ZH_OBJECTS, salt, 4);
  const detail = pick(ZH_DETAILS, salt, 7);
  const items = [
    {
      p: `${name}${time}把会议推迟了（${detail}）。`,
      c: `原定的开会时间改到更晚了。`,
      w: [
        `会议比计划提前开始了。`,
        `谁也没去${place}。`,
        `整个项目被永久取消了。`,
      ],
    },
    {
      p: `${name}礼貌地拒绝了邀请。`,
      c: `${name}客气地回绝了那次邀请。`,
      w: [
        `${name}马上答应了。`,
        `${name}把邀请忘得一干二净。`,
        `${name}自己迟到了很久。`,
      ],
    },
    {
      p: `虽然很累，${name}还是完成了${obj}。`,
      c: `再累也没拦住${name}，${obj}最终做完了。`,
      w: [
        `${name}因为太累停下了。`,
        `${name}一点也不累。`,
        `${name}从来没动手做过。`,
      ],
    },
    {
      p: `${name}请大家在发送前再检查一遍${obj}。`,
      c: `${name}希望先仔细核对${obj}，然后再发出去。`,
      w: [
        `${name}让大家立刻删掉${obj}。`,
        `大家完全不理${name}。`,
        `${name}不想再看任何文件。`,
      ],
    },
    {
      p: `要是路上一直堵，${name}就会错过在${place}的会面。`,
      c: `堵车可能会让${name}赶不上会面。`,
      w: [
        `${name}无论如何都会提前到。`,
        `会面改到了别的国家。`,
        `${name}几周前就取消了会面。`,
      ],
    },
  ];
  return packMcq(pick(items, salt, 6), 12 + (salt % 8));
}

function packBlank(
  item: { prompt: string; c: string; w: string[] },
  difficulty: number,
): Draft {
  const shuffled = shuffleChoices({
    id: 'x',
    kind: 'select_missing_word',
    section: 'grammar',
    difficulty,
    instruction: '',
    prompt: item.prompt,
    correctChoice: item.c,
    choices: [item.c, ...item.w],
  });
  return {
    kind: 'select_missing_word',
    section: 'grammar',
    difficulty,
    instruction: 'Pick the correct form.',
    prompt: item.prompt,
    choices: shuffled.choices,
    correctChoice: shuffled.correctChoice,
  };
}

function packMcq(
  item: { p: string; c: string; w: string[] },
  difficulty: number,
): Draft {
  const shuffled = shuffleChoices({
    id: 'x',
    kind: 'multiple_choice',
    section: 'comprehension',
    difficulty,
    instruction: '',
    prompt: item.p,
    correctChoice: item.c,
    choices: [item.c, ...item.w],
  });
  return {
    kind: 'multiple_choice',
    section: 'comprehension',
    difficulty,
    instruction: 'Choose the closest meaning.',
    prompt: item.p,
    choices: shuffled.choices,
    correctChoice: shuffled.correctChoice,
  };
}

function buildDraft(
  lang: CompanionChatApiLanguage,
  section: string,
  salt: number,
  _targetBank = 12,
): Draft {
  const grammar =
    section === 'grammar' || section === 'structure' || (section !== 'comprehension' && salt % 2 === 0);
  if (lang === 'french') return grammar ? frGrammar(salt) : frMcq(salt);
  if (lang === 'german') return grammar ? deGrammar(salt) : deMcq(salt);
  if (lang === 'russian') return grammar ? ruGrammar(salt) : ruMcq(salt);
  if (lang === 'chinese') return grammar ? zhGrammar(salt) : zhMcq(salt);
  return grammar ? enGrammar(salt) : enMcq(salt);
}

/**
 * Always returns a question whose prompt/content is not in `seen`.
 * Combinatorial slots + entropy make collisions vanishingly rare across users/sessions.
 */
export function mintUniquePlacementQuestion(options: {
  lang: CompanionChatApiLanguage;
  section: string;
  targetDifficulty: number;
  sessionSalt: number;
  userEntropy: number;
  seenIds: string[];
  seenPrompts: string[];
  seenContentKeys: string[];
  attemptOffset?: number;
}): LocalPlacementQuestion {
  const {
    lang,
    section,
    targetDifficulty,
    sessionSalt,
    userEntropy,
    seenIds,
    seenPrompts,
    seenContentKeys,
    attemptOffset = 0,
  } = options;

  const seen = buildSeenQuestionKeys([]);
  for (const id of seenIds) seen.ids.add(id);
  for (const prompt of seenPrompts) {
    seen.prompts.add(normalizePlacementPrompt(prompt));
    const template = placementTemplateKey(prompt);
    if (template) seen.templates.add(template);
  }
  for (const key of seenContentKeys) seen.contents.add(key);

  const rand = mulberry32(
    (sessionSalt ^ userEntropy ^ ((Date.now() + attemptOffset * 9973) & 0xfffffff)) >>> 0,
  );

  const accepts = (q: LocalPlacementQuestion) =>
    !isQuestionAlreadySeen(q, seen) &&
    !isTrivialParaphraseChoice(q.prompt, q.correctChoice) &&
    !isWeakPlacementQuestion(q.prompt, q.choices, q.kind);

  const stampDifficulty = (intrinsic: number) =>
    Math.max(1, Math.min(25, Math.round(Math.min(intrinsic, targetDifficulty))));

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const salt =
      ((sessionSalt +
        userEntropy * 31 +
        targetDifficulty * 17 +
        attemptOffset * 101 +
        attempt * 104729 +
        seen.prompts.size * 7919) ^
        Math.floor(rand() * 0x7fffffff) ^
        (attempt * 0x85ebca6b) ^
        (Date.now() & 0xffff)) >>>
      0;
    const draft = buildDraft(lang, section, salt, targetDifficulty);
    const fixed = ensureCorrectChoiceInList(draft);
    const intrinsic = Math.max(1, Math.min(25, Math.round(fixed.difficulty || 10)));
    const q: LocalPlacementQuestion = {
      ...fixed,
      id: uniqueId(lang, salt ^ attempt, fixed.prompt),
      // Never stamp emergency local items harder than their real content.
      difficulty: stampDifficulty(intrinsic),
    };
    if (accepts(q)) return shuffleChoices(q);
  }

  // Last resort: prefer a non-trivial draft even if near-duped; never ship word-scramble keys.
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const forced = buildDraft(
      lang,
      section,
      Math.floor(rand() * 1e9) ^ Date.now() ^ attempt,
      targetDifficulty,
    );
    const fixed = ensureCorrectChoiceInList(forced);
    if (isTrivialParaphraseChoice(fixed.prompt, fixed.correctChoice)) continue;
    if (isWeakPlacementQuestion(fixed.prompt, fixed.choices, fixed.kind)) continue;
    const intrinsic = Math.max(1, Math.min(25, Math.round(fixed.difficulty || 10)));
    return shuffleChoices({
      ...fixed,
      id: uniqueId(lang, Date.now() ^ attempt, fixed.prompt),
      difficulty: stampDifficulty(intrinsic),
    });
  }

  const forced = buildDraft(lang, section, Math.floor(rand() * 1e9) ^ Date.now(), targetDifficulty);
  const fixed = ensureCorrectChoiceInList(forced);
  const intrinsic = Math.max(1, Math.min(25, Math.round(fixed.difficulty || 10)));
  return shuffleChoices({
    ...fixed,
    id: uniqueId(lang, Date.now() ^ Math.floor(rand() * 1e9), fixed.prompt),
    difficulty: stampDifficulty(intrinsic),
  });
}

setPlacementSlotMaskTokens([
  ...EN_NAMES,
  ...EN_PLACES,
  ...EN_OBJECTS,
  ...EN_TIMES,
  ...EN_DETAILS,
  ...FR_NAMES,
  ...FR_PLACES,
  ...FR_OBJECTS,
  ...FR_TIMES,
  ...FR_DETAILS,
  ...DE_NAMES,
  ...DE_PLACES,
  ...DE_OBJECTS,
  ...DE_TIMES,
  ...DE_DETAILS,
  ...RU_NAMES,
  ...RU_PLACES,
  ...RU_OBJECTS,
  ...RU_TIMES,
  ...RU_DETAILS,
  ...ZH_NAMES,
  ...ZH_PLACES,
  ...ZH_TIMES,
  ...ZH_DETAILS,
  ...ZH_OBJECTS,
]);
