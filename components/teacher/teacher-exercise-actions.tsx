import { StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';

import { TeacherExerciseCta } from '@/components/teacher/teacher-exercise-cta';
import { useTranslation } from '@/contexts/locale-context';
import type { MiniDrillAccess } from '@/utils/teacher-mini-drill-usage';
import type { CompanionMsg } from '@/types/companion-message';

type Props = {
  messageId: string;
  exerciseLoadingId: string | null;
  typing: boolean;
  miniAccess: MiniDrillAccess;
  /** Синхронный старт (beginGenerating + проверки). false = не запускать API. */
  onPrepare: (message: CompanionMsg) => boolean;
  onPress: (message: CompanionMsg) => void;
  onBlocked: (reason: string) => void;
  message: CompanionMsg;
};

export function TeacherExerciseActions({
  messageId,
  exerciseLoadingId,
  typing,
  miniAccess,
  onPrepare,
  onPress,
  onBlocked,
  message,
}: Props) {
  const { t } = useTranslation();
  const [localLoading, setLocalLoading] = useState(false);
  const loading = localLoading || exerciseLoadingId === messageId;
  const blockedByOther = Boolean(exerciseLoadingId) && exerciseLoadingId !== messageId;
  const exhausted = !miniAccess.allowed;

  useEffect(() => {
    if (exerciseLoadingId === messageId) {
      setLocalLoading(false);
      return;
    }
    if (!localLoading) return;
    const timer = setTimeout(() => setLocalLoading(false), 240);
    return () => clearTimeout(timer);
  }, [exerciseLoadingId, localLoading, messageId]);

  const activate = () => {
    if (typing) {
      onBlocked(t('teacher.drill.waitForReply'));
      return;
    }
    if (blockedByOther) {
      onBlocked(t('teacher.drill.generatingInProgress'));
      return;
    }
    if (exhausted) {
      const reason =
        miniAccess.reasonKey === 'refreshLimit'
          ? t('teacher.drill.refreshLimit', { count: miniAccess.reasonCount ?? 0 })
          : miniAccess.reasonKey === 'lessonLimit'
            ? t('teacher.drill.lessonLimit', { count: miniAccess.reasonCount ?? 0 })
            : t('teacher.drill.limitFallback');
      onBlocked(reason);
      return;
    }
    setLocalLoading(true);
    if (!onPrepare(message)) {
      setLocalLoading(false);
      return;
    }
    onPress(message);
  };

  return (
    <View style={styles.wrap} collapsable={false}>
      <TeacherExerciseCta
        loading={loading}
        disabled={blockedByOther}
        exhausted={exhausted}
        isRepeat={miniAccess.isRepeat}
        refreshesLeft={miniAccess.refreshesLeft}
        onPress={activate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
});
