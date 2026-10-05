import type { CompanionChatApiLanguage, TeacherVocabWordCard } from '@/types/companion-chat-api';

/** Meta / hollow frames that teach nothing about real usage. */
const BAD_L2_RE =
  /经常想到|你知道.+吗|这就是|这里可以说|刚才聊天提到|自然地用了|别乱用|带.+的句子|换个场景再说|用得很自然|帮我.+一下这件事|别在客人面前.+等会儿私下|终于决定.，大家松了口气|先别急着.，我们再确认|老板让我明天再.+一次给他看|In this (chat|message)|fits the situation|sounds? (odd|natural|fitting|perfect)|Don't force|make your own sentence|Native speakers use|Dans ce message|sonne très naturel|N'utilise pas|Tu peux inventer|On entend surtout|In diesem Chat|passt perfekt|klingt seltsam|Kannst du einen eigenen|Muttersprachler nutzen|В этом (сообщении|чате|диалоге)|звучит (уместно|странно|естественно|очень)|Не (пихай|используй)|Составь сво|придумать фраз|слышишь чаще|как раз к месту|Je pense souvent|Tu connais|C'est exactement|Ici, on dit|I often think about|Do you know|It's all about|Here we use|Ich denke oft|Kennst du|Es geht um|Hier benutzt|Я часто думаю о|Ты знаешь|Речь про|Здесь уместно/i;

const BAD_TR_RE =
  /часто думаю|ты знаешь|речь про|здесь уместно|как раз к месту|звучит (уместно|странно|естественно)|составь сво|придумай фраз|в этом (сообщении|чате|диалоге)|i often think|do you know|fits the situation|sounds? (odd|natural|fitting)|make your own|native speakers|here we use|it's all about|用得很自然|这里「/i;

export function isHollowVocabExampleSentence(l2: string): boolean {
  return BAD_L2_RE.test(l2.trim());
}

export function isHollowVocabExampleTranslation(translation: string): boolean {
  return BAD_TR_RE.test(translation.trim());
}

export function isHollowVocabExample(l2: string, translation: string): boolean {
  return isHollowVocabExampleSentence(l2) || isHollowVocabExampleTranslation(translation);
}

/** Cyrillic glued into Chinese L2 (broken local templates / bad parse). */
function isCorruptL2ForLanguage(l2: string, language?: CompanionChatApiLanguage | null): boolean {
  if (language === 'chinese') {
    if (/[а-яё]/i.test(l2)) return true;
    if (!/[\u4e00-\u9fff]/.test(l2)) return true;
  }
  return false;
}

function isCorruptHeadword(word: string, language?: CompanionChatApiLanguage | null): boolean {
  const w = word.trim();
  if (/^(то|и|или|нание|чьих|те)\b/i.test(w)) return true;
  if (language === 'chinese' && (/[а-яё]/i.test(w) || !/[\u4e00-\u9fff]/.test(w))) return true;
  return false;
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function appearsInExplanation(sentence: string, explanation: string): boolean {
  const s = normalizeForMatch(sentence);
  const e = normalizeForMatch(explanation);
  if (!s || s.length < 8) return false;
  if (e.includes(s)) return true;
  if (s.length > 24 && e.includes(s.slice(0, Math.min(s.length, 48)))) return true;
  return false;
}

/** Оставляет только полезные предложения. */
export function filterVocabExamplesNotInExplanation(
  words: TeacherVocabWordCard[],
  explanation: string,
  language?: CompanionChatApiLanguage | null,
  opts?: { allowFromExplanation?: boolean },
): TeacherVocabWordCard[] {
  const source = explanation.trim();
  const out: TeacherVocabWordCard[] = [];
  for (const card of words) {
    if (isCorruptHeadword(card.word, language)) continue;
    const sentences = card.sentences.filter((s) => {
      if (!s.l2?.trim() || !s.translation?.trim()) return false;
      if (isHollowVocabExample(s.l2, s.translation)) return false;
      if (isCorruptL2ForLanguage(s.l2, language)) return false;
      if ((s.translation.match(/,/g) ?? []).length >= 2 && s.translation.length > 60) return false;
      if (!opts?.allowFromExplanation) {
        if (source && appearsInExplanation(s.l2, source)) return false;
        if (source && appearsInExplanation(s.translation, source)) return false;
      }
      return true;
    });
    if (sentences.length === 0) continue;
    out.push({ ...card, sentences });
  }
  return out;
}
