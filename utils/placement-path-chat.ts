import { teacherLessonColor } from '@/components/teacher/teacher-tokens';
import type { CompanionChatRow } from '@/contexts/companion-chats-context';
import type { TeacherRecentLesson } from '@/contexts/teacher-journey-context';
import type { LearnerModel } from '@/types/learner-model';
import type { CompanionMsg } from '@/types/companion-message';
import { placementPathLessonId } from '@/utils/placement-next-level';

function formatChatClock(d = new Date()) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export type PlacementPathChatBundle = {
  id: string;
  title: string;
  color: string;
  opening: CompanionMsg[];
  chatRow: CompanionChatRow;
  lesson: TeacherRecentLesson;
};

function enrichOpeningWithLearnerModel(openingText: string, learnerModel?: LearnerModel | null): string {
  if (!learnerModel) return openingText;
  const extras: string[] = [];
  if (learnerModel.goal?.title?.trim()) {
    const goal = learnerModel.goal.title.trim();
    const by = learnerModel.goal.targetDate ? ` (${learnerModel.goal.targetDate})` : '';
    // Em dash — not "Title:" — so the teacher message parser won't invent a section card.
    extras.push(`Твоя цель — ${goal}${by}.`);
  }
  // Skip raw skillProfile dump (was rendering as English "SKILL FOCUS FROM PLACEMENT" chrome).
  if (!extras.length) return openingText;
  return `${openingText.trim()}\n\n${extras.join(' ')}`;
}

/** Detect path openings that the teacher UI parser shreds into nested cards. */
export function isBrokenPlacementPathOpening(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/skill\s+focus\s+from\s+placement/i.test(t)) return true;
  if (/\([^)]*\s\/\s[^)]*\)/.test(t)) return true;
  if (/^(Первый шаг|First step|第一步)\s*[:：]/m.test(t)) return true;
  if (/^(Первый круг|First round|第一轮)\s*[:：]/m.test(t)) return true;
  // Old copy asked for free-write in chat while Practice buttons exist below.
  if (/напиши\s+2|write\s+2|用\s*2|写\s*2/i.test(t)) return true;
  if (/предложени[яй].*вчера|sentences about yesterday|句话写昨天/i.test(t)) return true;
  return false;
}

export function isPlacementPathLessonId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('tl-path-');
}

/** Stable first teacher chat for the post-placement learning path. */
export function buildPlacementPathChat(options: {
  language: string;
  nextLabel: string;
  chatTitle: string;
  openingText: string;
  teacherName: string;
  /** Optional derived model — enriches opening with goal / skill hints. */
  learnerModel?: LearnerModel | null;
}): PlacementPathChatBundle {
  const id = placementPathLessonId(options.language, options.nextLabel);
  const color = teacherLessonColor(id);
  const time = formatChatClock();
  const createdAt = Date.now();
  const title =
    options.chatTitle.length > 72 ? `${options.chatTitle.slice(0, 72)}…` : options.chatTitle;

  const openingBody = enrichOpeningWithLearnerModel(options.openingText, options.learnerModel);

  const opening: CompanionMsg[] = [
    {
      id: `path-open-${id}`,
      from: 'them',
      text: openingBody,
      time,
    },
  ];

  const chatRow: CompanionChatRow = {
    id,
    name: options.teacherName,
    preview: title,
    time,
    unread: 0,
    online: true,
    letter: 'T',
    color,
    presence: 'урок',
    profileMetaLine: title,
  };

  const lesson: TeacherRecentLesson = {
    id,
    title,
    subtitle: options.teacherName,
    createdAt,
    spentSecondsTotal: 0,
  };

  return { id, title, color, opening, chatRow, lesson };
}
