import type {
  TeacherDrillFollowUp,
  TeacherNextTopicRecommendation,
} from '@/types/companion-chat-api';
import type { TeacherDrillMistakeItem } from '@/utils/teacher-drill-mistakes';

export function buildLocalDrillFollowUp(
  correct: number,
  total: number,
  mistakes: TeacherDrillMistakeItem[],
  nextTopic?: TeacherNextTopicRecommendation | null,
): TeacherDrillFollowUp {
  const wrong = Math.max(0, total - correct);
  const ratio = total > 0 ? correct / total : 0;

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
      title: 'Повторить тренировку',
      reason: 'Много ошибок — лучше закрепить эту тему, прежде чем идти дальше.',
      focusAreas: focus,
      repeatPrompt: 'Давай ещё раз потренируем эту тему. Разбери мои ошибки и дай новую тренировку.',
    };
  }

  if (wrong > 0) {
    const focus = mistakes.slice(0, 4).map((m) => m.checkText).filter(Boolean);
    const gapHint = mistakes[0]?.feedback || mistakes[0]?.idealAnswer || mistakes[0]?.checkText;
    return {
      action: 'review_gaps',
      title: 'Разобрать ошибки',
      reason: gapHint
        ? `Стоит закрыть пробел: ${gapHint}`
        : 'Есть точечные ошибки — разберём их перед новой темой.',
      focusAreas: focus,
      repeatPrompt:
        'Разбери мои ошибки из последней тренировки и объясни, как правильно. Потом предложи короткую тренировку на эти слабые места.',
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
    title: 'Повторить тренировку',
    reason: 'Закрепим материал ещё одним проходом.',
    repeatPrompt: 'Давай ещё раз потренируем эту тему.',
  };
}

export function buildFollowUpChatMessage(followUp: TeacherDrillFollowUp): string {
  if (followUp.repeatPrompt?.trim()) return followUp.repeatPrompt.trim();
  const title = followUp.title.trim();
  if (followUp.action === 'review_gaps') {
    const focus = followUp.focusAreas?.filter(Boolean).slice(0, 3).join('; ');
    if (focus) {
      return `Разбери мои ошибки по темам: ${focus}. ${followUp.reason.trim()}`;
    }
    return `Разбери мои ошибки из тренировки. ${followUp.reason.trim()}`;
  }
  if (followUp.action === 'repeat_same') {
    return followUp.reason.trim() || `Давай ещё раз потренируем «${title}».`;
  }
  if (followUp.connection?.trim()) {
    return `Расскажи про тему «${title}». ${followUp.connection.trim()}`;
  }
  if (followUp.reason?.trim()) {
    return `Расскажи про тему «${title}». ${followUp.reason.trim()}`;
  }
  return `Расскажи про тему «${title}»`;
}
