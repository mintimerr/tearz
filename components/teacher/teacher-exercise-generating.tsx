import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandGradient } from '@/components/ui';
import { APP_THEME } from '@/constants/theme';
import { TEACHER_MUTED, TEACHER_MUTED_SOFT, TEACHER_TITLE } from '@/components/teacher/teacher-tokens';
import { DRILL } from '@/components/teacher/teacher-drill-styles';

const STEP_MS = 900;

// Tearz «за работой» — каждый запуск показывает случайное действие.
// Источники — анимированные WebP (проигрываются expo-image покадрово).
// Чтобы добавить реальное движение: замените эти .webp анимированными
// версиями с теми же именами (см. инструкцию/скрипт конвертации).
const ACTIONS = [
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-act-computer.webp'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-act-book.webp'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-act-build.webp'),
];

const STEPS = [
  'Разбираем объяснение',
  'Подбираем лексику',
  'Создаём упражнения',
  'Собираем варианты',
  'Почти готово',
] as const;

type StepState = 'pending' | 'active' | 'done';

type Props = {
  visible: boolean;
};

const AnimatedExpoImage = Animated.createAnimatedComponent(ExpoImage);

/** Анимированный Tearz «за работой» над заданиями — случайное действие при запуске. */
function TearzWorking() {
  const [src] = useState(() => ACTIONS[Math.floor(Math.random() * ACTIONS.length)]);
  const bob = useSharedValue(0);
  const sway = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    sway.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [bob, sway]);

  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -6 * bob.value },
      { rotate: `${-2.5 + sway.value * 5}deg` },
    ],
  }));

  return (
    <View style={styles.workWrap}>
      <AnimatedExpoImage source={src} contentFit="contain" autoplay style={[styles.workImg, imgStyle]} />
    </View>
  );
}

function StepRow({ label, state }: { label: string; state: StepState }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (state !== 'active') {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, state]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: state === 'active' ? 0.5 + pulse.value * 0.5 : 1,
    transform: [{ scale: state === 'active' ? 0.85 + pulse.value * 0.3 : 1 }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.stepRow}>
      <View style={styles.stepMark}>
        {state === 'done' ? (
          <View style={styles.stepDone}>
            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
          </View>
        ) : state === 'active' ? (
          <Animated.View style={[styles.stepDotActive, dotStyle]} />
        ) : (
          <View style={styles.stepDotPending} />
        )}
      </View>
      <Text
        style={[
          styles.stepLabel,
          state === 'done' && styles.stepLabelDone,
          state === 'active' && styles.stepLabelActive,
        ]}>
        {label}
      </Text>
    </Animated.View>
  );
}

export function TeacherExerciseGenerating({ visible }: Props) {
  const insets = useSafeAreaInsets();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!visible) {
      setActiveStep(0);
      return;
    }
    const timer = setInterval(() => {
      setActiveStep((i) => Math.min(i + 1, STEPS.length - 1));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  const progress = (activeStep + 0.5) / STEPS.length;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View
        style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.glow} pointerEvents="none" />

        <Animated.View entering={FadeIn.duration(320)} style={styles.center}>
          <TearzWorking />

          <View style={styles.copyBlock}>
            <Text style={styles.title}>Генерируем тренировку</Text>
            <Text style={styles.subtitle}>Это займёт несколько секунд</Text>
          </View>

          <View style={styles.steps}>
            {STEPS.map((label, i) => (
              <StepRow
                key={label}
                label={label}
                state={i < activeStep ? 'done' : i === activeStep ? 'active' : 'pending'}
              />
            ))}
          </View>

          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]}>
                <BrandGradient direction="horizontal" />
              </View>
            </View>
            <Text style={styles.progressText}>
              {Math.min(activeStep + 1, STEPS.length)} / {STEPS.length}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DRILL.canvas,
    paddingHorizontal: 28,
  },
  glow: {
    position: 'absolute',
    top: '14%',
    alignSelf: 'center',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: APP_THEME.color.brandGlow,
    opacity: 0.5,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34,
  },
  workWrap: {
    width: 176,
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workImg: {
    width: 176,
    height: 176,
  },
  copyBlock: {
    alignItems: 'center',
    gap: 7,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: TEACHER_TITLE,
    textAlign: 'center',
  },
  subtitle: {
    ...APP_THEME.type.caption,
    color: TEACHER_MUTED,
    textAlign: 'center',
  },
  steps: {
    alignSelf: 'stretch',
    gap: 14,
    paddingHorizontal: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  stepMark: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.brand,
  },
  stepDotActive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: APP_THEME.color.brandBright,
  },
  stepDotPending: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: APP_THEME.color.borderStrong,
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
    color: TEACHER_MUTED_SOFT,
  },
  stepLabelActive: {
    color: TEACHER_TITLE,
    fontWeight: '600',
  },
  stepLabelDone: {
    color: TEACHER_MUTED,
  },
  progressBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: APP_THEME.color.accentSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressText: {
    ...APP_THEME.type.micro,
    color: TEACHER_MUTED_SOFT,
    fontVariant: ['tabular-nums'],
  },
});
