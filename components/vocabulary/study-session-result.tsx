import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/utils/safe-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { GAME_THEME } from '@/constants/game-theme';
import { useTranslation } from '@/contexts/locale-context';
import { buildStudyShareMessage, shareText } from '@/utils/viral-share';

const RING = 100;
const RING_C = RING / 2;
const RING_STROKE = 16;
const RING_R = 36;
const RING_CIRC = 2 * Math.PI * RING_R;

function ScoreRing({ correct, wrong, total }: { correct: number; wrong: number; total: number }) {
  const learned = total > 0 ? (correct / total) * RING_CIRC : 0;
  const missed = total > 0 ? (wrong / total) * RING_CIRC : 0;
  const split = learned > 0 && missed > 0;
  const gap = split ? 3 : 0;
  const green = Math.max(0, learned - gap / 2);
  const red = Math.max(0, missed - gap / 2);

  return (
    <Svg width={RING} height={RING}>
      <Circle
        cx={RING_C}
        cy={RING_C}
        r={RING_R}
        fill="none"
        stroke={GAME_THEME.color.ink}
        strokeWidth={RING_STROKE + 6}
      />
      <Circle
        cx={RING_C}
        cy={RING_C}
        r={RING_R}
        fill="none"
        stroke={GAME_THEME.color.paper}
        strokeWidth={RING_STROKE}
      />
      {green >= RING_CIRC - 1 ? (
        <Circle
          cx={RING_C}
          cy={RING_C}
          r={RING_R}
          fill="none"
          stroke={GAME_THEME.color.phosphor}
          strokeWidth={RING_STROKE}
        />
      ) : green > 0 ? (
        <Circle
          cx={RING_C}
          cy={RING_C}
          r={RING_R}
          fill="none"
          stroke={GAME_THEME.color.phosphor}
          strokeWidth={RING_STROKE}
          strokeDasharray={`${green} ${RING_CIRC}`}
          strokeDashoffset={RING_CIRC / 4}
          strokeLinecap="butt"
        />
      ) : null}
      {red >= RING_CIRC - 1 ? (
        <Circle
          cx={RING_C}
          cy={RING_C}
          r={RING_R}
          fill="none"
          stroke={GAME_THEME.color.danger}
          strokeWidth={RING_STROKE}
        />
      ) : red > 0 ? (
        <Circle
          cx={RING_C}
          cy={RING_C}
          r={RING_R}
          fill="none"
          stroke={GAME_THEME.color.danger}
          strokeWidth={RING_STROKE}
          strokeDasharray={`${red} ${RING_CIRC}`}
          strokeDashoffset={RING_CIRC / 4 - learned}
          strokeLinecap="butt"
        />
      ) : null}
      <Circle cx={RING_C} cy={RING_C} r={RING_R - RING_STROKE / 2 - 7} fill={GAME_THEME.color.cream} />
      <Circle
        cx={RING_C}
        cy={RING_C}
        r={RING_R - RING_STROKE / 2 - 7}
        fill="none"
        stroke={GAME_THEME.color.ink}
        strokeWidth={2}
      />
    </Svg>
  );
}

type Props = {
  correct: number;
  wrong: number;
  total: number;
  onClose: () => void;
  onRestart: () => void;
};

export function StudySessionResult({ correct, wrong, total, onClose, onRestart }: Props) {
  const { t } = useTranslation();
  const intro = useSharedValue(0);

  useEffect(() => {
    intro.value = 0;
    intro.value = withDelay(20, withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }));
  }, [intro, correct, wrong, total]);

  const scoreStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ translateY: interpolate(intro.value, [0, 1], [10, 0]) }],
  }));

  const linesStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0.25, 1], [0, 1]),
    transform: [{ translateY: interpolate(intro.value, [0, 1], [8, 0]) }],
  }));

  const actionsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0.4, 1], [0, 1]),
  }));

  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <Animated.View style={[styles.scoreBlock, scoreStyle]}>
          <View style={styles.scoreCopy}>
            <View style={styles.scoreRow}>
              <Text style={styles.score}>{pct}</Text>
              <Text style={styles.scoreUnit}>%</Text>
            </View>
            <Text style={styles.scoreHint}>
              {correct} из {total}
            </Text>
          </View>
          <ScoreRing correct={correct} wrong={wrong} total={total} />
        </Animated.View>

        <Animated.View style={[styles.lines, linesStyle]}>
          <View style={styles.rule} />
          <View style={styles.line}>
            <View style={[styles.mark, styles.markOk]} />
            <Text style={styles.lineLabel}>Выучил</Text>
            <Text style={styles.lineValue}>{correct}</Text>
          </View>
          <View style={styles.rule} />
          <View style={[styles.line, wrong === 0 && styles.lineQuiet]}>
            <View style={[styles.mark, styles.markBad]} />
            <Text style={styles.lineLabel}>Не выучил</Text>
            <Text style={styles.lineValue}>{wrong}</Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.actions, actionsStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Пройти ещё раз"
          onPress={() => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onRestart();
          }}
          style={({ pressed }) => [styles.retryPress, pressed && styles.retryPressIn]}>
          <Ionicons name="refresh" size={18} color={GAME_THEME.color.ink} />
          <Text style={styles.retryText}>Ещё раз</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрыть тренировку"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClose();
          }}
          style={({ pressed }) => [styles.quietPress, pressed && styles.quietPressIn]}>
          <Text style={styles.quietText}>Закрыть</Text>
        </Pressable>

        {total > 0 && pct >= 50 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('viral.shareResult')}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const msg = buildStudyShareMessage({
                pct,
                correct,
                total,
                lines: {
                  title: t('viral.studyShareTitle'),
                  score: t('viral.studyShareScore'),
                  cta: t('viral.studyShareCta'),
                },
              });
              void shareText(msg, t('viral.shareResult'));
            }}
            style={({ pressed }) => [styles.quietPress, pressed && styles.quietPressIn]}>
            <View style={styles.shareRow}>
              <Ionicons name="share-social-outline" size={15} color={GAME_THEME.color.cream} />
              <Text style={styles.shareText}>{t('viral.shareResult')}</Text>
            </View>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingTop: 6,
    paddingHorizontal: 22,
  },
  panel: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderRadius: GAME_THEME.radius.panel,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
    shadowColor: GAME_THEME.color.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
  },
  scoreBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreCopy: {
    flexShrink: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  score: {
    fontSize: 84,
    lineHeight: 80,
    fontWeight: '900',
    letterSpacing: -5,
    color: GAME_THEME.color.ink,
  },
  scoreUnit: {
    marginTop: 14,
    marginLeft: 2,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: GAME_THEME.color.ink,
  },
  scoreHint: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: 'rgba(26,26,26,0.45)',
  },
  lines: {
    marginTop: 28,
  },
  rule: {
    height: 2,
    backgroundColor: GAME_THEME.color.ink,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingRight: 6,
  },
  lineQuiet: {
    opacity: 0.38,
  },
  mark: {
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  markOk: {
    backgroundColor: GAME_THEME.color.phosphor,
  },
  markBad: {
    backgroundColor: GAME_THEME.color.danger,
  },
  lineLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: GAME_THEME.color.ink,
  },
  lineValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: GAME_THEME.color.ink,
  },
  actions: {
    paddingTop: 18,
    paddingBottom: 4,
    gap: 4,
  },
  retryPress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: GAME_THEME.radius.button,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 6,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  retryPressIn: {
    transform: [{ translateY: 3 }],
    borderBottomWidth: 3,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  quietPress: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  quietPressIn: {
    opacity: 0.55,
  },
  quietText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: GAME_THEME.color.cream,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareText: {
    fontSize: 13,
    fontWeight: '700',
    color: GAME_THEME.color.cream,
  },
});
