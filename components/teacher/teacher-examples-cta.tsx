import { TeacherLessonActionButton } from '@/components/teacher/teacher-lesson-action-button';
import { useTranslation } from '@/contexts/locale-context';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = {
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function TeacherExamplesCta({ disabled, onPress, style }: Props) {
  const { t } = useTranslation();

  return (
    <TeacherLessonActionButton
      tone="sky"
      icon="chatbubbles-outline"
      title={t('teacher.examples.ctaLabel')}
      subtitle={t('teacher.examples.ctaSubtitleEmpty')}
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={t('teacher.examples.ctaA11y')}
      style={style}
    />
  );
}
