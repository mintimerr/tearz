/**
 * Parametric production expander — language-specific variants from seed families.
 * Does NOT translate EN→other languages. Distractors stay natural learner confusions.
 */

import { createHash } from 'node:crypto';

import type { GeneratedItem, ItemSpecification } from '../../items/types.js';
import { generationPromptVersionForLanguage } from '../../items/prompt-versions.js';
import type { AssessmentSkill, CefrLevel } from '../../types.js';
import type { BankLanguage } from '../types.js';
import type { BlueprintSlot } from './blueprint.js';
import type { PoolItem } from './pools-en.js';
import { EN_POOLS } from './pools-en.js';
import { FR_POOLS } from './pools-fr.js';
import { ZH_POOLS } from './pools-zh.js';
import { DE_POOLS } from './pools-de.js';
import { RU_POOLS } from './pools-ru.js';
import { generateCombinatorialPoolItem } from './production-combinatorial.js';
import { factoryConstructsFor } from './constructs.js';
import { cefrRank } from '../../scale.js';

export const PRODUCTION_MODEL_ID = 'tearz-offline-production-v1';

const BASE_POOLS: Record<
  BankLanguage,
  Record<AssessmentSkill, Partial<Record<CefrLevel, PoolItem[]>>>
> = {
  en: EN_POOLS,
  fr: FR_POOLS,
  zh: ZH_POOLS,
  de: DE_POOLS,
  ru: RU_POOLS,
};

type Lex = {
  names: string[];
  places: string[];
  times: string[];
  objects: string[];
  numbers: string[];
  days: string[];
};

const LEX: Record<BankLanguage, Lex> = {
  en: {
    names: ['Anna', 'Sam', 'Mia', 'Leo', 'Nora', 'Omar', 'Elena', 'Kai'],
    places: ['Canada', 'Spain', 'Japan', 'Brazil', 'Egypt', 'Korea', 'Italy', 'Kenya'],
    times: ['6', '7', '8', '9', '10', '11', 'noon', '3pm'],
    objects: ['ticket', 'bag', 'book', 'phone', 'key', 'map', 'pass', 'card'],
    numbers: ['two', 'three', 'four', 'five', 'six', 'seven'],
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  },
  fr: {
    names: ['Anna', 'Samir', 'Léa', 'Hugo', 'Nora', 'Amine', 'Claire', 'Yanis'],
    places: ['Canada', 'Espagne', 'Japon', 'Brésil', 'Égypte', 'Italie', 'Maroc', 'Belgique'],
    times: ['6 h', '7 h', '8 h', '9 h', '10 h', '18 h', 'midi', '15 h'],
    objects: ['billet', 'sac', 'livre', 'téléphone', 'clé', 'plan', 'pass', 'carte'],
    numbers: ['deux', 'trois', 'quatre', 'cinq', 'six', 'sept'],
    days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],
  },
  zh: {
    names: ['小王', '小李', '小陈', '小张', '小刘', '阿明', '小美', '阿杰'],
    places: ['北京', '上海', '广州', '深圳', '成都', '杭州', '南京', '西安'],
    times: ['六点', '七点', '八点', '九点', '十点', '中午', '下午三点', '晚上'],
    objects: ['票', '包', '书', '手机', '钥匙', '地图', '卡', '护照'],
    numbers: ['两', '三', '四', '五', '六', '七'],
    days: ['周一', '周二', '周三', '周四', '周五'],
  },
  de: {
    names: ['Anna', 'Sam', 'Mia', 'Leo', 'Nora', 'Omar', 'Elena', 'Kai'],
    places: ['Kanada', 'Spanien', 'Japan', 'Brasilien', 'Ägypten', 'Italien', 'Korea', 'Belgien'],
    times: ['6 Uhr', '7 Uhr', '8 Uhr', '9 Uhr', '10 Uhr', '18 Uhr', 'mittags', '15 Uhr'],
    objects: ['Fahrkarte', 'Tasche', 'Buch', 'Handy', 'Schlüssel', 'Stadtplan', 'Pass', 'Karte'],
    numbers: ['zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben'],
    days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'],
  },
  ru: {
    names: ['Анна', 'Саша', 'Мия', 'Лев', 'Нора', 'Омар', 'Елена', 'Кай'],
    places: ['Канада', 'Испания', 'Япония', 'Бразилия', 'Египет', 'Италия', 'Корея', 'Бельгия'],
    times: ['в 6', 'в 7', 'в 8', 'в 9', 'в 10', 'в полдень', 'в 15:00', 'вечером'],
    objects: ['билет', 'сумка', 'книга', 'телефон', 'ключ', 'карта', 'пропуск', 'карточка'],
    numbers: ['два', 'три', 'четыре', 'пять', 'шесть', 'семь'],
    days: ['понедельник', 'вторник', 'среда', 'четверг', 'пятница'],
  },
};

function pick<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length]!;
}

function rotateOptions(
  options: [string, string, string, string],
  correctIndex: number,
  targetPos: number,
): { options: [string, string, string, string]; correctIndex: number } {
  const correct = options[correctIndex]!;
  const wrongs = options.filter((_, i) => i !== correctIndex);
  const out: string[] = ['', '', '', ''];
  out[targetPos] = correct;
  let w = 0;
  for (let i = 0; i < 4; i++) {
    if (i === targetPos) continue;
    out[i] = wrongs[w++]!;
  }
  return { options: out as [string, string, string, string], correctIndex: targetPos };
}

/** Expand a base pool item into a unique variant for production slot. */
export function expandPoolItem(
  lang: BankLanguage,
  skill: AssessmentSkill,
  level: CefrLevel,
  variantIndex: number,
): PoolItem {
  const pool = BASE_POOLS[lang][skill][level] ?? [];
  if (pool.length === 0) {
    throw new Error(`No pool for ${lang}.${skill}.${level}`);
  }
  const base = pool[variantIndex % pool.length]!;
  const lex = LEX[lang];
  const n = pick(lex.names, variantIndex);
  const p = pick(lex.places, variantIndex + 1);
  const t = pick(lex.times, variantIndex + 2);
  const o = pick(lex.objects, variantIndex + 3);
  const num = pick(lex.numbers, variantIndex + 4);
  const day = pick(lex.days, variantIndex + 5);

  let stem = base.stem;
  let options = [...base.options] as [string, string, string, string];
  let explanation = base.explanation;

  // Language-specific light entity swaps that preserve grammar/key
  if (lang === 'en') {
    stem = stem
      .replace(/\bCanada\b/g, p)
      .replace(/\bShe\b/g, variantIndex % 2 === 0 ? 'She' : 'He')
      .replace(/\b6\b/g, t.replace(/pm|noon/i, '').trim() || '6')
      .replace(/\bFriday\b/g, day)
      .replace(/\btwo\b/gi, num);
    if (skill === 'vocabulary' && level === 'A1' && /ticket|breakfast|bag|book/i.test(stem)) {
      // keep structure; vary concrete noun in stem where blank sits elsewhere
      stem = stem.replace(/\bcinema\b/g, pick(['cinema', 'museum', 'concert', 'match'], variantIndex));
    }
  } else if (lang === 'fr') {
    stem = stem
      .replace(/\bCanada\b/g, p)
      .replace(/\b18 h\b/g, t)
      .replace(/\bvendredi\b/gi, day)
      .replace(/\bdeux\b/gi, num);
  } else if (lang === 'de') {
    stem = stem
      .replace(/\bKanada\b/g, p)
      .replace(/\bBerlin\b/g, pick(['Berlin', 'Hamburg', 'München', 'Köln'], variantIndex))
      .replace(/\bFreitag\b/g, day)
      .replace(/\b18 Uhr\b/g, t);
  } else if (lang === 'ru') {
    stem = stem
      .replace(/\bКанада\b/g, p)
      .replace(/\bпятниц/gi, day.slice(0, 5))
      .replace(/\bшесть\b/g, t.includes('6') ? 'шесть' : pick(['шесть', 'семь', 'восемь'], variantIndex));
  } else if (lang === 'zh') {
    stem = stem
      .replace(/北京/g, p)
      .replace(/周五/g, day)
      .replace(/六点/g, t)
      .replace(/小王|小李/g, n);
  }

  // Inject name into functional stems when generic
  if (skill === 'functional' && variantIndex > 0) {
    if (lang === 'en' && /colleague|Someone|You want/i.test(stem)) {
      stem = stem.replace(/\bA colleague\b/g, `${n}`).replace(/\bSomeone\b/g, `${n}`);
    }
    if (lang === 'zh' && /同事|有人/.test(stem)) {
      stem = stem.replace(/同事/g, n).replace(/有人/g, n);
    }
  }

  // Reading: vary hours on A1 notice-like stems
  if (skill === 'reading' && (level === 'A1' || level === 'A2')) {
    const h1 = 11 + (variantIndex % 3);
    const h2 = h1 + 1;
    stem = stem
      .replace(/13:00/g, `${h1}:00`)
      .replace(/14:00/g, `${h2}:00`)
      .replace(/13 h/g, `${h1} h`)
      .replace(/14 h/g, `${h2} h`)
      .replace(/13:00–14:00/g, `${h1}:00–${h2}:00`);
    // Keep option text aligned for shop-hours family
    if (/Before 13:00|Avant 13|Vor 13|До 13|13:00前/.test(options[0]!)) {
      if (lang === 'en') options[0] = `Before ${h1}:00 or after ${h2}:00`;
      if (lang === 'fr') options[0] = `Avant ${h1} h ou après ${h2} h`;
      if (lang === 'de') options[0] = `Vor ${h1}:00 oder nach ${h2}:00`;
      if (lang === 'ru') options[0] = `До ${h1}:00 или после ${h2}:00`;
      if (lang === 'zh') options[0] = `${h1}:00前或${h2}:00后`;
      if (lang === 'en') options[1] = `Only at ${h1}:00`;
      if (lang === 'fr') options[1] = `Seulement à ${h1} h`;
      if (lang === 'de') options[1] = `Nur um ${h1}:00`;
      if (lang === 'ru') options[1] = `Только в ${h1}:00`;
      if (lang === 'zh') options[1] = `只在${h1}:00`;
    }
  }

  void o;
  void explanation;

  const targetPos = variantIndex % 4;
  const rotated = rotateOptions(options, base.correctIndex, targetPos);
  return {
    conceptKey: `${base.conceptKey}.v${variantIndex}`,
    stem,
    prompt: base.prompt,
    options: rotated.options,
    correctIndex: rotated.correctIndex,
    explanation: base.explanation,
  };
}

/** Extra high-level unique stems when pool cycling alone is insufficient. */
export function synthesizeHighLevelVariant(
  lang: BankLanguage,
  skill: AssessmentSkill,
  level: 'C1' | 'C2',
  variantIndex: number,
): PoolItem | null {
  if (level !== 'C1' && level !== 'C2') return null;
  const lex = LEX[lang];
  const org = pick(
    lang === 'zh'
      ? ['法务部', '合规组', '产品委员会', '风险小组']
      : lang === 'fr'
        ? ['le comité', 'la direction', 'l’équipe juridique', 'le conseil']
        : lang === 'de'
          ? ['der Ausschuss', 'die Leitung', 'das Legal-Team', 'der Rat']
          : lang === 'ru'
            ? ['комитет', 'руководство', 'юротдел', 'совет']
            : ['the committee', 'leadership', 'the legal team', 'the board'],
    variantIndex,
  );
  const topic = pick(
    lang === 'zh'
      ? ['上线日期', '试点范围', '退款条款', '招聘冻结']
      : lang === 'fr'
        ? ['la date de lancement', 'le périmètre pilote', 'la clause de remboursement', 'le gel des embauches']
        : lang === 'de'
          ? ['das Launch-Datum', 'den Pilotumfang', 'die Erstattungsklausel', 'den Einstellungsstopp']
          : lang === 'ru'
            ? ['дату запуска', 'рамки пилота', 'пункт о возврате', 'заморозку найма']
            : ['the launch date', 'the pilot scope', 'the refund clause', 'the hiring freeze'],
    variantIndex + 1,
  );

  if (skill === 'functional') {
    const families: PoolItem[] =
      lang === 'en'
        ? [
            {
              conceptKey: `en.${level}.func_synth_defer`,
              stem: `${pick(lex.names, variantIndex)} pushes for an aggressive decision on ${topic}. You want to defer without a blunt no. What do you say?`,
              prompt: 'Choose the best response.',
              options: [
                'That direction is interesting; it may sit better after we have clearer evidence.',
                'No, and do not raise this again.',
                'The idea is worthless and should be dropped today.',
                'We approve everything immediately with full funding.',
              ],
              correctIndex: 0,
              explanation: 'Indirect deferral.',
            },
            {
              conceptKey: `en.${level}.func_synth_align`,
              stem: `In a meeting with ${org}, you partly support the aim behind ${topic} but will not endorse unchecked delivery. What do you say?`,
              prompt: 'Choose the best response.',
              options: [
                'I am sympathetic to the aim, pending clearer success metrics.',
                'I approve every detail without conditions.',
                'I reject the aim but praise the metrics loudly.',
                'Sympathy equals a signed legal commitment.',
              ],
              correctIndex: 0,
              explanation: 'Conditional alignment.',
            },
          ]
        : lang === 'zh'
          ? [
              {
                conceptKey: `zh.${level}.func_synth_defer`,
                stem: `${pick(lex.names, variantIndex)}坚持立刻敲定${topic}。你想婉拒又不伤关系。你说？`,
                prompt: '选择最合适的回答。',
                options: [
                  '这个方向值得看，或许更适合证据更充分后再定。',
                  '不行，以后别再提这件事。',
                  '这个想法毫无价值，今天就该放弃。',
                  '我们现在全盘批准并立即拨款。',
                ],
                correctIndex: 0,
                explanation: '间接推迟。',
              },
              {
                conceptKey: `zh.${level}.func_synth_align`,
                stem: `与${org}讨论时，你认同目标方向，但不能无条件背书${topic}的执行细节。你说？`,
                prompt: '选择最合适的回答。',
                options: [
                  '我认同目标，但需要更清晰的成功指标后再谈承诺。',
                  '我无条件批准每一个细节。',
                  '我否定目标，却大力称赞指标。',
                  '这种认同等于已签署的法律承诺。',
                ],
                correctIndex: 0,
                explanation: '有条件认同。',
              },
            ]
          : lang === 'fr'
            ? [
                {
                  conceptKey: `fr.${level}.func_synth_defer`,
                  stem: `On vous presse sur ${topic}. Vous voulez différer sans refus brutal. Que dites-vous ?`,
                  prompt: 'Choisissez la meilleure réponse.',
                  options: [
                    'La piste est intéressante ; elle trouverait mieux sa place avec des preuves plus claires.',
                    'Non, et n’en reparlez plus.',
                    'L’idée ne vaut rien et doit être abandonnée aujourd’hui.',
                    'Nous approuvons tout immédiatement avec financement.',
                  ],
                  correctIndex: 0,
                  explanation: 'Report indirect.',
                },
              ]
            : lang === 'de'
              ? [
                  {
                    conceptKey: `de.${level}.func_synth_defer`,
                    stem: `Man drängt Sie zu einer schnellen Entscheidung über ${topic}. Sie wollen aufschieben ohne harte Absage. Was sagen Sie?`,
                    prompt: 'Wählen Sie die beste Antwort.',
                    options: [
                      'Die Richtung ist interessant; sie passt besser, wenn die Beleglage klarer ist.',
                      'Nein, und bringen Sie das nicht wieder vor.',
                      'Die Idee ist wertlos und sollte heute fallen.',
                      'Wir genehmigen alles sofort mit voller Finanzierung.',
                    ],
                    correctIndex: 0,
                    explanation: 'Indirekte Verschiebung.',
                  },
                ]
              : [
                  {
                    conceptKey: `ru.${level}.func_synth_defer`,
                    stem: `Вас торопят с решением по поводу ${topic}. Нужно отложить без резкого отказа. Что сказать?`,
                    prompt: 'Выберите лучший ответ.',
                    options: [
                      'Направление интересное; лучше вернуться к нему, когда будут более ясные доказательства.',
                      'Нет, и больше не поднимайте это.',
                      'Идея ничего не стоит и её надо бросить сегодня.',
                      'Мы всё одобряем немедленно с полным финансированием.',
                    ],
                    correctIndex: 0,
                    explanation: 'Косвенный перенос.',
                  },
                ];
    const item = families[variantIndex % families.length]!;
    const rot = rotateOptions(item.options, item.correctIndex, variantIndex % 4);
    return { ...item, options: rot.options, correctIndex: rot.correctIndex, conceptKey: `${item.conceptKey}.v${variantIndex}` };
  }

  if (skill === 'reading') {
    const item: PoolItem =
      lang === 'en'
        ? {
            conceptKey: `en.${level}.read_synth_minutes`,
            stem: `Minutes from ${org}: "Members thanked the authors for the draft on ${topic}. The group noted the proposal with interest and moved to other business without a vote or a request for follow-up." What is the most likely pragmatic reading?`,
            prompt: 'Choose the best answer.',
            options: [
              'Polite non-commitment rather than endorsement',
              'Unanimous approval of funding',
              'A request for immediate implementation',
              'A clerical error in the minutes',
            ],
            correctIndex: 0,
            explanation: 'Interest + no follow-up ≈ shelving.',
          }
        : lang === 'zh'
          ? {
              conceptKey: `zh.${level}.read_synth_minutes`,
              stem: `${org}纪要：「委员感谢作者分发关于${topic}的草案。会议表示兴趣并记录在案，随后未要求后续材料也未表决，便转入其他议题。」最可能的语用解读是？`,
              prompt: '选择最佳答案。',
              options: [
                '礼貌地不表态，而非批准',
                '一致通过拨款',
                '要求立即实施',
                '秘书记录错误',
              ],
              correctIndex: 0,
              explanation: '兴趣+无后续≈搁置。',
            }
          : lang === 'fr'
            ? {
                conceptKey: `fr.${level}.read_synth_minutes`,
                stem: `Procès-verbal de ${org} : « Les membres ont remercié les auteurs pour le projet sur ${topic}. Le groupe a pris note avec intérêt, puis est passé aux autres points sans vote ni suite demandée. » Lecture pragmatique la plus probable ?`,
                prompt: 'Choisissez la meilleure réponse.',
                options: [
                  'Non-engagement poli plutôt qu’approbation',
                  'Approbation unanime du financement',
                  'Demande de mise en œuvre immédiate',
                  'Erreur de secrétariat',
                ],
                correctIndex: 0,
                explanation: 'Intérêt + pas de suite ≈ mise de côté.',
              }
            : lang === 'de'
              ? {
                  conceptKey: `de.${level}.read_synth_minutes`,
                  stem: `Protokoll von ${org}: „Die Mitglieder dankten für den Entwurf zu ${topic}. Die Gruppe nahm ihn mit Interesse zur Kenntnis und ging ohne Abstimmung und ohne Nachforderung zu anderen Punkten über.“ Wahrscheinlichste Lesart?`,
                  prompt: 'Wählen Sie die beste Antwort.',
                  options: [
                    'Höfliche Nichtfestlegung statt Zustimmung',
                    'Einstimmige Mittelbewilligung',
                    'Bitte um sofortige Umsetzung',
                    'Ein Protokollfehler',
                  ],
                  correctIndex: 0,
                  explanation: 'Interesse + kein Follow-up ≈ Beiseitelegen.',
                }
              : {
                  conceptKey: `ru.${level}.read_synth_minutes`,
                  stem: `Протокол ${org}: «Члены поблагодарили авторов за проект по теме «${topic}». Группа приняла предложение к сведению с интересом и без голосования и без запроса продолжения перешла к другим вопросам.» Наиболее вероятное прочтение?`,
                  prompt: 'Выберите лучший ответ.',
                  options: [
                    'Вежливое неучастие, а не одобрение',
                    'Единогласное финансирование',
                    'Просьба о немедленном внедрении',
                    'Ошибка секретаря',
                  ],
                  correctIndex: 0,
                  explanation: 'Интерес + нет follow-up ≈ откладывание.',
                };
    const rot = rotateOptions(item.options, 0, variantIndex % 4);
    return { ...item, options: rot.options, correctIndex: rot.correctIndex, conceptKey: `${item.conceptKey}.v${variantIndex}` };
  }

  if (skill === 'vocabulary') {
    const item: PoolItem =
      lang === 'en'
        ? {
            conceptKey: `en.${level}.vocab_synth_stance`,
            stem: `In the note to investors about ${topic}, the authors try to ____ residual concerns without promising refunds or a revised timeline.`,
            prompt: 'Choose the best word.',
            options: ['mitigate', 'amplify', 'ignore', 'celebrate'],
            correctIndex: 0,
            explanation: 'Mitigate = reduce force of concerns.',
          }
        : lang === 'zh'
          ? {
              conceptKey: `zh.${level}.vocab_synth_stance`,
              stem: `在给投资者的说明里，作者试图 ____ 对${topic}的剩余顾虑，但并未承诺退款或新的时间表。`,
              prompt: '选择最合适的词。',
              options: ['缓解', '放大', '忽视', '庆祝'],
              correctIndex: 0,
              explanation: '缓解顾虑。',
            }
          : lang === 'fr'
            ? {
                conceptKey: `fr.${level}.vocab_synth_stance`,
                stem: `Dans la note aux investisseurs sur ${topic}, les auteurs cherchent à ____ les inquiétudes restantes sans promettre de remboursement ni de nouveau calendrier.`,
                prompt: 'Choisissez le meilleur mot.',
                options: ['atténuer', 'amplifier', 'ignorer', 'célébrer'],
                correctIndex: 0,
                explanation: 'Atténuer les inquiétudes.',
              }
            : lang === 'de'
              ? {
                  conceptKey: `de.${level}.vocab_synth_stance`,
                  stem: `Im Memo an Investoren zu ${topic} versuchen die Autoren, Restbedenken zu ____, ohne Erstattung oder neuen Zeitplan zuzusagen.`,
                  prompt: 'Wählen Sie das beste Wort.',
                  options: ['abmildern', 'verstärken', 'ignorieren', 'feiern'],
                  correctIndex: 0,
                  explanation: 'Abmildern = reduzieren.',
                }
              : {
                  conceptKey: `ru.${level}.vocab_synth_stance`,
                  stem: `В записке для инвесторов о «${topic}» авторы пытаются ____ оставшиеся опасения, не обещая возврат денег и не предлагая новый график.`,
                  prompt: 'Выберите лучшее слово.',
                  options: ['смягчить', 'усилить', 'игнорировать', 'отметить'],
                  correctIndex: 0,
                  explanation: 'Смягчить опасения.',
                };
    const rot = rotateOptions(item.options, 0, variantIndex % 4);
    return { ...item, options: rot.options, correctIndex: rot.correctIndex, conceptKey: `${item.conceptKey}.v${variantIndex}` };
  }

  // grammar high-level: reuse expand from pool primarily
  return null;
}

function resolveConstructId(
  slot: BlueprintSlot,
  stem: string,
  answer: string,
  explanation: string,
): string {
  const blob = `${stem} ${answer} ${explanation}`.toLowerCase();
  const rank = cefrRank(slot.level);
  const constructs = factoryConstructsFor(slot.language).filter(
    (c) =>
      c.skill === slot.skill &&
      cefrRank(c.minLevel) <= rank &&
      cefrRank(c.maxLevel) >= rank,
  );
  if (!constructs.length) return slot.specification.construct;

  const cues: Array<{ keys: string[]; re: RegExp }> = [
    { keys: ['present_perfect', 'perfekt', 'passe_compose'], re: /\b(have|has|had|already|since|for )\b|已经|了|过|уже/i },
    { keys: ['conditional', 'conditionals', 'konjunktiv'], re: /\b(if |would|were |si |wenn|если|如果)\b/i },
    { keys: ['relative', 'relatives'], re: /\b(who|which|that|whose|qui|que|dessen|который)\b/i },
    { keys: ['reported', 'reported_verb'], re: /\b(said|told|claimed|insisted|reported)\b/i },
    { keys: ['passive', 'passiv'], re: /\b(was |were |been |wurde|worden|被)\b/i },
    { keys: ['subjunctive', 'subjonctif', 'insist'], re: /\b(insist|remain|require that|que )\b/i },
  ];

  for (const cue of cues) {
    if (!cue.re.test(blob)) continue;
    const hit = constructs.find((c) => cue.keys.some((k) => c.id.toLowerCase().includes(k)));
    if (hit) return hit.id;
  }

  // Prefer constructs that do not impose unmet relative/conditional cues
  const safe = constructs.find((c) => {
    const id = c.id.toLowerCase();
    if (/relative/.test(id) && !/\b(who|which|that|whose|qui|que|dessen|который)\b/i.test(blob)) return false;
    if (/conditional/.test(id) && !/\b(if |would|si |wenn|если|如果)\b/i.test(blob)) return false;
    return true;
  });
  return safe?.id ?? constructs[0]!.id;
}

export function generateProductionCandidate(slot: BlueprintSlot, attempt: number): GeneratedItem {
  const { language, skill, level } = slot;
  const variantIndex = slot.slotIndex * 31 + attempt * 7 + (level.charCodeAt(1) || 0) * 13;

  // Prefer combinatorial families (large unique space); fall back to pool expand / high-level synth.
  let tpl: PoolItem | null = generateCombinatorialPoolItem(language, skill, level, variantIndex);
  if (!tpl && (level === 'C1' || level === 'C2') && (skill === 'functional' || skill === 'reading' || skill === 'vocabulary')) {
    tpl = synthesizeHighLevelVariant(language, skill, level, variantIndex);
  }
  if (!tpl) {
    tpl = expandPoolItem(language, skill, level, variantIndex);
  }

  if (attempt > 0) {
    const v2 = variantIndex + attempt * 19;
    tpl =
      generateCombinatorialPoolItem(language, skill, level, v2) ??
      ((level === 'C1' || level === 'C2') &&
      (skill === 'functional' || skill === 'reading' || skill === 'vocabulary')
        ? synthesizeHighLevelVariant(language, skill, level, v2)
        : null) ??
      expandPoolItem(language, skill, level, v2);
  }

  // Final answer-position rotation (deterministic by variantIndex)
  const rotated = rotateOptions(tpl.options, tpl.correctIndex, variantIndex % 4);
  tpl = { ...tpl, options: rotated.options, correctIndex: rotated.correctIndex };

  const spec: ItemSpecification = {
    ...slot.specification,
    construct: resolveConstructId(slot, tpl.stem, tpl.options[tpl.correctIndex]!, tpl.explanation),
  };
  const options = tpl.options.map((text, i) => ({
    id: String.fromCharCode(65 + i),
    text,
    isCorrect: i === tpl.correctIndex,
  }));
  const raw = `${slot.slotKey}|${attempt}|${tpl.conceptKey}|prod-v1`;
  const h = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return {
    id: `bank.${language}.${skill}.${level}.${slot.slotIndex}.p${attempt}.${h}`,
    specificationId: spec.id ?? slot.slotKey,
    language,
    stem: tpl.stem,
    prompt: tpl.prompt,
    options,
    correctAnswer: options[tpl.correctIndex]!.text,
    explanation: tpl.explanation,
    generationModel: PRODUCTION_MODEL_ID,
    generationPromptVersion: generationPromptVersionForLanguage(language),
    generatedAt: Date.now(),
    calibrationStatus: 'provisional',
    specification: spec,
  };
}
