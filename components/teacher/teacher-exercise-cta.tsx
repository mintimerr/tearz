import { TeacherLessonActionButton } from '@/components/teacher/teacher-lesson-action-button';
import { DRILL_TASK_COUNT } from '@/constants/teacher-drill';
import { useTranslation } from '@/contexts/locale-context';

type Props = {
  loading?: boolean;
  disabled?: boolean;
  exhausted?: boolean;
  refreshesLeft?: number;
  isRepeat?: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
};

export function TeacherExerciseCta({
  loading,
  disabled,
  exhausted,
  refreshesLeft,
  isRepeat,
  onPress,
  onPressIn,
  style,
}: Props) {
  const { t } = useTranslation();
  const showExhausted = exhausted && !loading;

  let subtitle = t('teacher.drill.ctaSubtitle', { count: DRILL_TASK_COUNT });
  if (!showExhausted && isRepeat && typeof refreshesLeft === 'number') {
    subtitle = `${subtitle} · ↻${refreshesLeft}`;
  }

  return (
    <TeacherLessonActionButton
      tone="gold"
      icon="barbell"
      title={showExhausted ? t('teacher.drill.ctaLimit') : t('teacher.drill.ctaLabel')}
      subtitle={showExhausted ? undefined : subtitle}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      accessibilityLabel={t('teacher.drill.ctaA11y')}
      style={style}
    />
  );
}
