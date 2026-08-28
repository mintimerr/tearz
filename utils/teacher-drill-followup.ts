import type {
  TeacherDrillFollowUp,
  TeacherNextTopicRecommendation,
} from '@/types/companion-chat-api';
import type { TeacherDrillMistakeItem } from '@/utils/teacher-drill-mistakes';

type UiLang = 'ru' | 'en' | 'zh';

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
    if (topic) {
      return `I didn’t do well on «${topic}». Can you review my mistakes and give me another short drill?`;
    }
    return 'I want to practice this topic again. Can you review my mistakes and give me a new drill?';
  }
  if (ui === 'zh') {
    if (topic) {
      return `«${topic}» 这题我做得不好。能帮我分析错误，再给我一组短练习吗？`;
    }
    return '我想再练一次这个主题。能帮我分析错误并给新的练习吗？';
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
  if (raw && !isTeacherVoicePrompt(raw)) return raw;
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

  if (wrong === 0 && nextTopic?.title) {
    return {
      action: 'advance',
      title: nextTopic.title,
      reason: nextTopic.reason,
      connection: nextTopic.connection,
    };
  }

  if (wrong >= Math.ceil(total / 2) || wrong >= 4) {
    const focus = mistakes.slice(0, 3).map((m) => m.checkText).filter(Boolean);
    return {
      action: 'repeat_same',
      title: ui === 'en' ? 'Repeat practice' : ui === 'zh' ? '再练一次' : 'Повторить тренировку',
      reason:
        ui === 'en'
          ? 'Too many mistakes — repeat this topic before moving on.'
          : ui === 'zh'
            ? '错误较多 — 先巩固本主题再继续。'
            : 'Много ошибок — лучше закрепить эту тему, прежде чем идти дальше.',
      focusAreas: focus,
      repeatPrompt: defaultLearnerRepeatPrompt('repeat_same', ui, focus),
    };
  }

  if (wrong > 0) {
    const focus = mistakes.slice(0, 4).map((m) => m.checkText).filter(Boolean);
    const gapHint = mistakes[0]?.feedback || mistakes[0]?.idealAnswer || mistakes[0]?.checkText;
    return {
      action: 'review_gaps',
      title: ui === 'en' ? 'Review mistakes' : ui === 'zh' ? '复习错误' : 'Разобрать ошибки',
      reason:
        gapHint && ui === 'ru'
          ? `Стоит закрыть пробел: ${gapHint}`
          : ui === 'en'
            ? 'A few gaps to fix before the next topic.'
            : ui === 'zh'
              ? '还有几处需要巩固，再继续新主题。'
              : 'Есть точечные ошибки — разберём их перед новой темой.',
      focusAreas: focus,
      repeatPrompt: defaultLearnerRepeatPrompt('review_gaps', ui, focus),
    };
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

  return title || (ui === 'en' ? 'Can you help me continue?' : ui === 'zh' ? '能继续帮我吗？' : 'Можешь помочь продолжить?');
}
