import { useEffect } from 'react';

import { useEngagement } from '@/contexts/engagement-context';
import { useTeacherJourney } from '@/contexts/teacher-journey-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useVocabulary } from '@/contexts/vocabulary-context';
import { computeStudyXp } from '@/utils/profile-study-stats';

/** Выдаёт и забирает Tearz коллекции по уровню и XP профиля. */
export function TearzCollectionSync() {
  const { entries } = useVocabulary();
  const { lessons } = useTeacherJourney();
  const { lifetimeStats } = useUserProfile();
  const { bonusXp, hydrated, syncTearzForStudyXp } = useEngagement();
  const xp = computeStudyXp(lessons.length, lifetimeStats.correct, entries.length, bonusXp);

  useEffect(() => {
    if (!hydrated) return;
    syncTearzForStudyXp(xp);
  }, [hydrated, syncTearzForStudyXp, xp]);

  return null;
}
