import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Modal, Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { APP_THEME } from '@/constants/theme';
import { FULL_WORKOUT_TASK_COUNT, MINI_DRILL_TASK_COUNT } from '@/constants/teacher-drill';

const PRICE = '499 ₽';

const PLUS = {
  bright: '#64D2FF',
  core: '#0A84FF',
  muted: 'rgba(100, 210, 255, 0.95)',
  soft: 'rgba(10, 132, 255, 0.12)',
  border: 'rgba(100, 210, 255, 0.28)',
  onAccent: '#FFFFFF',
} as const;

export type TearzPlusFeature = 'fullWorkout' | 'companionCall';

type Props = {
  visible: boolean;
  feature: TearzPlusFeature;
  onClose: () => void;
};

const PLUS_PERKS = [
  `${FULL_WORKOUT_TASK_COUNT} заданий разных типов по теме урока`,
  'Голос, текст, выбор, пропуски — полный цикл',
  'Голосовой звонок с собеседником в реальном времени',
  'Без лимита полных тренировок',
];

const FEATURE_COPY: Record<
  TearzPlusFeature,
  { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }
> = {
  fullWorkout: {
    icon: 'barbell-outline',
    title: 'Полная тренировка',
    subtitle: `Глубокая практика по теме урока — когда мини из ${MINI_DRILL_TASK_COUNT} заданий уже мало.`,
  },
  companionCall: {
    icon: 'call-outline',
    title: 'Голосовой звонок',
    subtitle: 'Живой разговор с собеседником — как настоящий звонок, без пауз на набор текста.',
  },
};

function PaywallGlow() {
  const w = Dimensions.get('window').width - 28;
  return (
    <Svg width={w} height={200} style={styles.glowSvg} pointerEvents="none">
      <Defs>
        <RadialGradient id="plusGlow" cx="50%" cy="0%" rx="70%" ry="90%">
          <Stop offset="0%" stopColor={PLUS.core} stopOpacity={0.22} />
          <Stop offset="55%" stopColor={PLUS.core} stopOpacity={0.06} />
          <Stop offset="100%" stopColor={PLUS.core} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={w / 2} cy={-8} r={140} fill="url(#plusGlow)" />
    </Svg>
  );
}

function PerkRow({ line, index }: { line: string; index: number }) {
  return (
    <Animated.View entering={FadeIn.delay(100 + index * 45).duration(260)} style={styles.perkRow}>
      <View style={styles.perkIcon}>
        <Ionicons name="checkmark" size={11} color={PLUS.onAccent} />
      </View>
      <Text style={styles.perkText}>{line}</Text>
    </Animated.View>
  );
}

export function TeacherFullWorkoutPaywall({ visible, feature, onClose }: Props) {
  const copy = FEATURE_COPY[feature];
  const insets = useSafeAreaInsets();

  const handleClose = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleSubscribe = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} accessibilityLabel="Закрыть" />
        {Platform.OS === 'ios' ? (
          <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFillObject} />
        ) : (
          <View style={styles.androidScrim} />
        )}

        <Animated.View
          entering={FadeInDown.duration(360).springify().damping(24)}
          style={[styles.card, { marginBottom: insets.bottom + 12 }]}>
          <PaywallGlow />
          <View style={styles.frame} pointerEvents="none" />

          <View style={styles.handle} />

          <View style={styles.topBar}>
            <Text style={styles.brand}>tearz</Text>
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
              style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={APP_THEME.color.muted} />
            </Pressable>
          </View>

          <View style={styles.plusBadge}>
            <Ionicons name="diamond" size={10} color={PLUS.core} />
            <Text style={styles.plusBadgeText}>Plus</Text>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroIconRing}>
              <View style={styles.heroIconOrb}>
                <Ionicons name={copy.icon} size={22} color={PLUS.bright} />
              </View>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.subtitle}>{copy.subtitle}</Text>
            </View>
          </View>

          <View style={styles.priceCard}>
            <View style={styles.priceMain}>
              <Text style={styles.price}>{PRICE}</Text>
              <Text style={styles.priceHint}>в месяц</Text>
            </View>
            <View style={styles.priceDivider} />
            <Text style={styles.priceNote}>Отмена в любой момент</Text>
          </View>

          <View style={styles.perksCard}>
            {PLUS_PERKS.map((line, i) => (
              <PerkRow key={line} line={line} index={i} />
            ))}
          </View>

          <Text style={styles.footnote}>
            Сейчас доступно с подпиской. Оплата появится в следующем обновлении.
          </Text>

          <Pressable
            onPress={handleSubscribe}
            accessibilityRole="button"
            accessibilityLabel="Понятно"
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
            <Text style={styles.ctaLabel}>Понятно</Text>
          </Pressable>

          <Pressable onPress={handleClose} hitSlop={12} style={styles.dismissBtn}>
            <Text style={styles.dismissText}>Пока не надо</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  androidScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  card: {
    borderRadius: APP_THEME.radius.sheet,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: APP_THEME.color.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.borderStrong,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: PLUS.core,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 28,
      },
      android: { elevation: 20 },
    }),
  },
  glowSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: APP_THEME.radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.accentSoft,
  },
  handle: {
    alignSelf: 'center',
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: APP_THEME.color.borderStrong,
    marginBottom: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brand: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'lowercase',
    color: APP_THEME.color.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  plusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: PLUS.soft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PLUS.border,
    marginBottom: 14,
  },
  plusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: PLUS.muted,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    borderRadius: APP_THEME.radius.xl,
    backgroundColor: APP_THEME.color.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
    marginBottom: 12,
  },
  heroIconRing: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PLUS.soft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PLUS.border,
  },
  heroIconOrb: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  heroCopy: {
    flex: 1,
    gap: 5,
    paddingTop: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.45,
    color: APP_THEME.color.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.12,
    color: APP_THEME.color.muted,
  },
  priceCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: APP_THEME.radius.lg,
    backgroundColor: APP_THEME.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
    marginBottom: 12,
    gap: 10,
  },
  priceMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  price: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.9,
    color: APP_THEME.color.text,
    fontVariant: ['tabular-nums'],
  },
  priceHint: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: APP_THEME.color.mutedSoft,
  },
  priceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: APP_THEME.color.border,
  },
  priceNote: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.15,
    color: APP_THEME.color.mutedSoft,
  },
  perksCard: {
    gap: 11,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: APP_THEME.radius.lg,
    backgroundColor: APP_THEME.color.bgSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
    marginBottom: 12,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  perkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PLUS.core,
  },
  perkText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.12,
    color: APP_THEME.color.textSoft,
  },
  footnote: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.05,
    color: APP_THEME.color.mutedFaint,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: PLUS.core,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.borderStrong,
    ...Platform.select({
      ios: {
        shadowColor: PLUS.bright,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  ctaPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.988 }],
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: PLUS.onAccent,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 2,
  },
  dismissText: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.15,
    color: APP_THEME.color.mutedSoft,
  },
});
