import { useMemo } from 'react';

import { usePlacement } from '@/contexts/placement-context';
import { useTeacherGoal } from '@/hooks/use-teacher-goal';
import {
  buildLearnerModel,
  toCompactLearnerContext,
} from '@/services/learner-model';

/**
 * Derived LearnerModel — not a second persistent SoT.
 * Rebuilds from PlacementRecord + TeacherGoal on every relevant change.
 */
export function useLearnerModel() {
  const { record, hydrated: placementHydrated } = usePlacement();
  const { goal, ready: goalReady } = useTeacherGoal();

  const learnerModel = useMemo(
    () => buildLearnerModel({ placementRecord: record, teacherGoal: goal }),
    [goal, record],
  );

  const learnerContext = useMemo(
    () => toCompactLearnerContext(learnerModel),
    [learnerModel],
  );

  return {
    learnerModel,
    learnerContext,
    ready: placementHydrated && goalReady,
  };
}
