import { StyleSheet, View } from 'react-native';

import { TeacherExerciseCta } from '@/components/teacher/teacher-exercise-cta';
import { TeacherFullWorkoutCta } from '@/components/teacher/teacher-full-workout-cta';
import type { MiniDrillAccess } from '@/utils/teacher-mini-drill-usage';
import type { CompanionMsg } from '@/types/companion-message';

type Props = {
  messageId: string;
  exerciseLoadingId: string | null;
  typing: boolean;
  miniAccess: MiniDrillAccess;
  onMiniPress: (message: CompanionMsg) => void;
  onMiniBlocked: (reason: string) => void;
  onFullPress: () => void;
  message: CompanionMsg;
};

export function TeacherExerciseActions({
  messageId,
  exerciseLoadingId,
  typing,
  miniAccess,
  onMiniPress,
  onMiniBlocked,
  onFullPress,
  message,
}: Props) {
  const busy = Boolean(exerciseLoadingId) || typing;
  const miniExhausted = !miniAccess.allowed;

  return (
    <View style={styles.row}>
      <TeacherExerciseCta
        loading={exerciseLoadingId === messageId}
        disabled={busy}
        exhausted={miniExhausted}
        isRepeat={miniAccess.isRepeat}
        refreshesLeft={miniAccess.refreshesLeft}
        onPress={() => {
          if (miniExhausted) {
            onMiniBlocked(miniAccess.reason ?? 'Лимит мини-тренировок исчерпан.');
            return;
          }
          onMiniPress(message);
        }}
      />
      <TeacherFullWorkoutCta disabled={busy} onPress={onFullPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
});
