import { Share } from 'react-native';

import { TEARZ_INVITE_URL } from '@/constants/viral';

export type ProgressSharePayload = {
  displayName: string;
  lessonCount: number;
  wordCount: number;
  accuracyPct: number | null;
  studyXp: number;
  lines: {
    title: string;
    lessons: string;
    words: string;
    accuracy: string;
    xp: string;
    cta: string;
  };
};

export type StudySharePayload = {
  pct: number;
  correct: number;
  total: number;
  lines: {
    title: string;
    score: string;
    cta: string;
  };
};

function formatAccuracy(pct: number | null, noData: string) {
  return pct != null ? `${pct}%` : noData;
}

export function buildProgressShareMessage(p: ProgressSharePayload) {
  const acc = formatAccuracy(p.accuracyPct, '—');
  return [
    p.lines.title,
    '',
    `📚 ${p.lessonCount} ${p.lines.lessons}`,
    `📝 ${p.wordCount} ${p.lines.words}`,
    `🎯 ${acc} ${p.lines.accuracy}`,
    `⭐ ${p.studyXp} ${p.lines.xp}`,
    '',
    p.lines.cta,
    TEARZ_INVITE_URL,
  ].join('\n');
}

export function buildInviteMessage(lines: { title: string; body: string; cta: string }) {
  return `${lines.title}\n\n${lines.body}\n\n${lines.cta}\n${TEARZ_INVITE_URL}`;
}

export function buildStudyShareMessage(p: StudySharePayload) {
  return [
    p.lines.title,
    '',
    p.lines.score.replace('{{pct}}', String(p.pct)).replace('{{correct}}', String(p.correct)).replace('{{total}}', String(p.total)),
    '',
    p.lines.cta,
    TEARZ_INVITE_URL,
  ].join('\n');
}

export async function shareText(message: string, dialogTitle?: string) {
  await Share.share({ message, title: dialogTitle ?? 'tearz' });
}
