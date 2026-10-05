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
    extras.push(`Goal: ${goal}${by}.`);
  }
  const skills = learnerModel.placement.skillProfile;
  if (skills) {
    const hints = Object.entries(skills)
      .filter(([, e]) => e.levelEstimate)
      .slice(0, 3)
      .map(([s, e]) => `${s}≈${e.levelEstimate}`);
    if (hints.length) extras.push(`Skill focus from placement: ${hints.join(', ')}.`);
  }
  if (!extras.length) return openingText;
  return `${openingText}\n\n${extras.join(' ')}`;
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
