/**
 * Human instructor / classroom mode (not AI Tearz "teacher").
 * Product plan: docs/INSTRUCTOR_MODE.md
 */

export type InstructorRoleInClass = 'instructor' | 'learner';

export type InstructorClass = {
  id: string;
  title: string;
  /** Invite code shown to students, e.g. TEARZ-AB12 */
  inviteCode: string;
  language?: string;
  createdAt: number;
  updatedAt: number;
  /** Local-only until API sync */
  memberCount?: number;
};

export type InstructorMaterialKind = 'note' | 'lesson_ref' | 'drill_pack';

export type InstructorMaterial = {
  id: string;
  classId: string;
  title: string;
  kind: InstructorMaterialKind;
  /** Plain / markdown body for `note` */
  body?: string;
  /** Link to local/remote AI teacher lesson id */
  lessonId?: string;
  createdAt: number;
  publishedAt?: number;
};

export type InstructorClassMembership = {
  classId: string;
  role: InstructorRoleInClass;
  joinedAt: number;
  title: string;
  inviteCode: string;
};
