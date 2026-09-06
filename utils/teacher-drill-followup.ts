import type {
  TeacherDrillFollowUp,
  TeacherNextTopicRecommendation,
} from '@/types/companion-chat-api';
import type { TeacherDrillMistakeItem } from '@/utils/teacher-drill-mistakes';

type UiLang = 'ru' | 'en' | 'zh';

const GENERIC_FOCUS_RE =
  /^(лексика|грамматика|орфография|понимание(?:\s+значений)?|значения|устойчивые(?:\s+выражения)?|слова|упражнения|vocabulary|grammar|spelling|collocations?|comprehension|word\s*usage|expressions?|words?|exercises?)$/iu;

/** Текст звучит как задание ученику, а не как просьба ученика преподавателю. */
function isTeacherVoicePrompt(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/\b(давайте|let['']s|让我们|我们一起)\b/iu.test(t)) return true;
  if (/\b(повторим упражн|пройдите|выполните|сделайте упражн|complete the|do the exercise)\b/iu.test(t)) return true;
  if (/\b(вам нужно|чтобы вы|you need to|you should|你应该)\b/iu.test(t)) return true;
  if (/\b(лучше запомнить|не путать|remember not to)\b/iu.test(t) && !/\b(я |мне |мои |my |I )\b/iu.test(t)) {
    return true;
  }
  if (/^давай\b/iu.test(t) && !/\b(мои|мне|я)\b/iu.test(t)) return true;
  return false;
}

function focusSnippet(focusAreas: string[] | undefined, max = 2): string {
  const parts = (focusAreas ?? []).map((s) => s.trim()).filter(Boolean).slice(0, max);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]}; ${parts[1]}`;
}

/** Короткий ярлык для карточки — предпочтительно само слово/фраза из ошибки. */
export function focusLabelFromMistake(mistake: TeacherDrillMistakeItem, maxLen = 40): string {
  const candidates = [mistake.idealAnswer, mistake.checkText, mistake.learnerAnswer]
    .map((s) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : ''))
    .filter(Boolean);

  for (const raw of candidates) {
    if (/^[\u4e00-\u9fff]{1,8}$/u.test(raw)) return raw;
    const cleaned = raw
      .replace(/_{2,}|…+|\.{3,}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) continue;
    if (cleaned.length <= maxLen) return cleaned;
    const head = cleaned.slice(0, maxLen - 1).trim();
    const cut = head.replace(/\s+\S*$/, '');
    return `${cut || head}…`;
  }
  return '';
}

export function focusAreasFromMistakes(mistakes: TeacherDrillMistakeItem[], max = 4): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of mistakes) {
    const label = focusLabelFromMistake(m);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    if (GENERIC_FOCUS_RE.test(label)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= max) break;
  }
  return out;
}

function isGenericFocusList(areas: string[] | undefined): boolean {
  const list = (areas ?? []).map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true;
  const genericCount = list.filter((s) => GENERIC_FOCUS_RE.test(s)).length;
  return genericCount >= Math.ceil(list.length * 0.6);
}

function joinFocusForTitle(areas: string[], ui: UiLang): string {
  const parts = areas.slice(0, 3);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) {
    return ui === 'en'
      ? `${parts[0]} and ${parts[1]}`
      : ui === 'zh'
        ? `${parts[0]}和${parts[1]}`
        : `${parts[0]} и ${parts[1]}`;
  }
  return ui === 'en'
    ? `${parts[0]}, ${parts[1]}, and ${parts[2]}`
    : ui === 'zh'
      ? `${parts[0]}、${parts[1]}和${parts[2]}`
      : `${parts[0]}, ${parts[1]} и ${parts[2]}`;
}

function personalizedRepeatTitle(areas: string[], ui: UiLang): string {
  const joined = joinFocusForTitle(areas, ui);
  if (!joined) {
    return ui === 'en' ? 'Repeat this topic' : ui === 'zh' ? '再练本主题' : 'Повторить эту тему';
  }
  return ui === 'en' ? `Retry ${joined}` : ui === 'zh' ? `再练：${joined}` : `Повторим: ${joined}`;
}

function personalizedReviewTitle(areas: string[], ui: UiLang): string {
  const joined = joinFocusForTitle(areas, ui);
  if (!joined) {
    return ui === 'en' ? 'Review mistakes' : ui === 'zh' ? '复习错误' : 'Разобрать ошибки';
  }
  return ui === 'en' ? `Review ${joined}` : ui === 'zh' ? `复习：${joined}` : `Разберём: ${joined}`;
}

function personalizedRepeatReason(
  wrong: number,
  total: number,
  areas: string[],
  ui: UiLang,
): string {
  const joined = joinFocusForTitle(areas, ui);
  if (ui === 'en') {
    if (joined) {
      return `You missed ${wrong}/${total}. Weak spots this round: ${joined}. Lock those in before a new topic.`;
    }
    return `You missed ${wrong}/${total} — repeat this topic before moving on.`;
  }
  if (ui === 'zh') {
    if (joined) {
      return `这轮错了 ${wrong}/${total}。先巩固：${joined}，再学新内容。`;
    }
    return `错误较多（${wrong}/${total}）— 先巩固本主题再继续。`;
  }
  if (joined) {
    return `В этой тренировке ${wrong} из ${total}. Слабые места: ${joined}. Сначала закрепим их, потом новая тема.`;
  }
  return `Много ошибок (${wrong} из ${total}) — лучше закрепить эту тему, прежде чем идти дальше.`;
}

function personalizedReviewReason(areas: string[], ui: UiLang, gapHint?: string): string {
  const joined = joinFocusForTitle(areas, ui);
  if (ui === 'en') {
    if (joined) return `Fix these before the next topic: ${joined}.`;
    if (gapHint) return `Worth closing this gap: ${gapHint}`;
    return 'A few gaps to fix before the next topic.';
  }
  if (ui === 'zh') {
    if (joined) return `继续新主题前先补上：${joined}。`;
    if (gapHint) return `建议先补上：${gapHint}`;
    return '还有几处需要巩固，再继续新主题。';
  }
  if (joined) return `Перед новой темой закроем: ${joined}.`;
  if (gapHint) return `Стоит закрыть пробел: ${gapHint}`;
  return 'Есть точечные ошибки — разберём их перед новой темой.';
}

/** Если модель вернула воду («лексика/грамматика») — подмени на факты из ошибок. */
export function enrichFollowUpWithMistakes(
  followUp: TeacherDrillFollowUp,
  mistakes: TeacherDrillMistakeItem[],
  correct: number,
  total: number,
  ui: UiLang = 'ru',
): TeacherDrillFollowUp {
  if (followUp.action === 'advance') return followUp;
  const areas = focusAreasFromMistakes(mistakes);
  if (areas.length === 0) return followUp;

  const needsFocusSwap = isGenericFocusList(followUp.focusAreas);
  const focusAreas = needsFocusSwap ? areas : (followUp.focusAreas ?? areas);
  const wrong = Math.max(0, total - correct);

  const titleLooksGeneric =
    !followUp.title?.trim() ||
    /^(сначала\s+)?повторим\s+(слова|упражнения)|повторить тренировку|review mistakes|repeat practice|再练一次|复习错误/iu.test(
      followUp.title,
    ) ||
    (/слов|упражнен|practice|exercises|words/iu.test(followUp.title) &&
      !areas.some((a) => followUp.title.includes(a)));

  const reasonLooksGeneric =
    !followUp.reason?.trim() ||
    (/много ошибок|too many|错误较多|сделали много|you made/iu.test(followUp.reason) &&
      !areas.some((a) => followUp.reason!.includes(a)));

  const title = titleLooksGeneric
    ? followUp.action === 'review_gaps'
      ? personalizedReviewTitle(focusAreas, ui)
      : personalizedRepeatTitle(focusAreas, ui)
    : followUp.title;

  const reason = reasonLooksGeneric
    ? followUp.action === 'review_gaps'
      ? personalizedReviewReason(focusAreas, ui, mistakes[0]?.feedback || mistakes[0]?.idealAnswer)
      : personalizedRepeatReason(wrong, total, focusAreas, ui)
    : followUp.reason;

  return {
    ...followUp,
    title,
    reason,
    focusAreas,
    repeatPrompt: normalizeLearnerRepeatPrompt(
      followUp.repeatPrompt,
      followUp.action,
      ui,
      focusAreas,
      title,
    ),
  };
}

function defaultLearnerRepeatPrompt(
  action: TeacherDrillFollowUp['action'],
  ui: UiLang,
  focusAreas?: string[],
  title?: string,
): string {
  const focus = focusSnippet(focusAreas);
  const topic = title?.trim() ?? '';

  if (action === 'review_gaps') {
    if (ui === 'en') {
      if (focus) {
        return `I made mistakes in practice (${focus}). Can you walk me through what I got wrong and show the correct version?`;
      }
      return 'Can you review my mistakes from the last drill and explain the correct answers?';
    }
    if (ui === 'zh') {
      if (focus) {
        return `我在练习里出错了（${focus}）。能帮我看看哪里错了吗，并讲一下正确说法？`;
      }
      return '能帮我分析一下上次练习的错误，并讲解正确答案吗？';
    }
    if (focus) {
      return `Я ошибся в тренировке (${focus}). Можешь разобрать, где я ошибся, и показать правильный вариант?`;
    }
    return 'Можешь разобрать мои ошибки из последней тренировки и объяснить, как правильно?';
  }

  if (ui === 'en') {
    if (focus) {
      return `I keep missing ${focus}. Can you review those and give me another short drill on them?`;
    }
    if (topic) {
      return `I didn’t do well on «${topic}». Can you review my mistakes and give me another short drill?`;
    }
    return 'I want to practice this topic again. Can you review my mistakes and give me a new drill?';
  }
  if (ui === 'zh') {
    if (focus) {
      return `我总是错过「${focus}」。能帮我分析并再给我一组短练习吗？`;
    }
    if (topic) {
      return `«${topic}» 这题我做得不好。能帮我分析错误，再给我一组短练习吗？`;
    }
    return '我想再练一次这个主题。能帮我分析错误并给新的练习吗？';
  }
  if (focus) {
    return `Я путаю / ошибаюсь на «${focus}». Можешь разобрать и дать ещё одну короткую тренировку по этому?`;
  }
  if (topic) {
    return `С темой «${topic}» у меня не очень. Можешь разобрать ошибки и дать ещё одну короткую тренировку?`;
  }
  return 'Хочу ещё раз потренировать эту тему. Можешь разобрать мои ошибки и дать новую тренировку?';
}

export function normalizeLearnerRepeatPrompt(
  repeatPrompt: string | undefined,
  action: TeacherDrillFollowUp['action'],
  ui: UiLang,
  focusAreas?: string[],
  title?: string,
): string {
  const raw = typeof repeatPrompt === 'string' ? repeatPrompt.trim() : '';
  if (raw && !isTeacherVoicePrompt(raw)) {
    const focus = focusSnippet(focusAreas);
    if (focus && !focusAreas?.some((a) => raw.includes(a))) {
      return defaultLearnerRepeatPrompt(action, ui, focusAreas, title);
    }
    return raw;
  }
  return defaultLearnerRepeatPrompt(action, ui, focusAreas, title);
}

export function buildLocalDrillFollowUp(
  correct: number,
  total: number,
  mistakes: TeacherDrillMistakeItem[],
  nextTopic?: TeacherNextTopicRecommendation | null,
  ui: UiLang = 'ru',
): TeacherDrillFollowUp {
  const wrong = Math.max(0, total - correct);
  const areas = focusAreasFromMistakes(mistakes);

  if (wrong === 0 && nextTopic?.title) {
    return {
      action: 'advance',
      title: nextTopic.title,
      reason: nextTopic.reason,
      connection: nextTopic.connection,
    };
  }

  if (wrong >= Math.ceil(total / 2) || wrong >= 4) {
    const title = personalizedRepeatTitle(areas, ui);
    return enrichFollowUpWithMistakes(
      {
        action: 'repeat_same',
        title,
        reason: personalizedRepeatReason(wrong, total, areas, ui),
        focusAreas: areas,
        repeatPrompt: defaultLearnerRepeatPrompt('repeat_same', ui, areas, title),
      },
      mistakes,
      correct,
      total,
      ui,
    );
  }

  if (wrong > 0) {
    const title = personalizedReviewTitle(areas, ui);
    const gapHint = mistakes[0]?.feedback || mistakes[0]?.idealAnswer || mistakes[0]?.checkText;
    return enrichFollowUpWithMistakes(
      {
        action: 'review_gaps',
        title,
        reason: personalizedReviewReason(areas, ui, gapHint),
        focusAreas: areas,
        repeatPrompt: defaultLearnerRepeatPrompt('review_gaps', ui, areas, title),
      },
      mistakes,
      correct,
      total,
      ui,
    );
  }

  if (nextTopic?.title) {
    return {
      action: 'advance',
      title: nextTopic.title,
      reason: nextTopic.reason,
      connection: nextTopic.connection,
    };
  }

  return {
    action: 'repeat_same',
    title: ui === 'en' ? 'Repeat practice' : ui === 'zh' ? '再练一次' : 'Повторить тренировку',
    reason:
      ui === 'en'
        ? 'One more pass to lock it in.'
        : ui === 'zh'
          ? '再巩固一遍。'
          : 'Закрепим материал ещё одним проходом.',
    repeatPrompt: defaultLearnerRepeatPrompt('repeat_same', ui),
  };
}

export function buildFollowUpChatMessage(
  followUp: TeacherDrillFollowUp,
  ui: UiLang = 'ru',
): string {
  if (followUp.action === 'review_gaps' || followUp.action === 'repeat_same') {
    return normalizeLearnerRepeatPrompt(
      followUp.repeatPrompt,
      followUp.action,
      ui,
      followUp.focusAreas,
      followUp.title,
    );
  }

  const title = followUp.title.trim();
  if (followUp.action === 'advance') {
    if (ui === 'en') {
      if (followUp.connection?.trim()) {
        return `Can you explain «${title}»? ${followUp.connection.trim()}`;
      }
      if (followUp.reason?.trim()) {
        return `Can you explain «${title}»? ${followUp.reason.trim()}`;
      }
      return `Can you explain «${title}»?`;
    }
    if (ui === 'zh') {
      if (followUp.connection?.trim()) {
        return `能讲讲「${title}」吗？${followUp.connection.trim()}`;
      }
      if (followUp.reason?.trim()) {
        return `能讲讲「${title}」吗？${followUp.reason.trim()}`;
      }
      return `能讲讲「${title}」吗？`;
    }
    if (followUp.connection?.trim()) {
      return `Расскажи про тему «${title}». ${followUp.connection.trim()}`;
    }
    if (followUp.reason?.trim()) {
      return `Расскажи про тему «${title}». ${followUp.reason.trim()}`;
    }
    return `Расскажи про тему «${title}»`;
  }

  return (
    title ||
    (ui === 'en' ? 'Can you help me continue?' : ui === 'zh' ? '能继续帮我吗？' : 'Можешь помочь продолжить?')
  );
}
