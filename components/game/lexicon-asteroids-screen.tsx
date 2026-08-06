import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameBackButton } from '@/components/game/game-back-button';
import { GameGoldButton } from '@/components/game/game-gold-button';
import { GAME_THEME } from '@/constants/game-theme';
import { useEngagement } from '@/contexts/engagement-context';
import { useLexicon } from '@/contexts/lexicon-context';
import type { LexiconPair } from '@/types/lexicon';
import { pickRoundOptions } from '@/utils/learner-lexicon';

const LIVES = 3;
const COINS_PER_HIT = 8;
const COINS_CAP = 80;

type Round = {
  target: LexiconPair;
  options: string[];
};

function DriftChip({
  label,
  index,
  correct,
  onPick,
  disabled,
}: {
  label: string;
  index: number;
  correct: boolean;
  onPick: (label: string) => void;
  disabled: boolean;
}) {
  const { width } = useWindowDimensions();
  const drift = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    const baseX = (index % 2 === 0 ? -1 : 1) * (18 + index * 6);
    drift.value = withRepeat(
      withTiming(baseX, { duration: 2200 + index * 280, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    bob.value = withRepeat(
      withTiming(1, { duration: 1600 + index * 200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [bob, drift, index]);

  const motion = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value },
      { translateY: bob.value * (8 + index * 2) },
    ],
  }));

  const colW = Math.min(160, (width - 48) / 2);

  return (
    <Animated.View style={[styles.chipWrap, { width: colW }, motion]}>
      <Pressable
        disabled={disabled}
        onPress={() => onPick(label)}
        style={({ pressed }) => [
          styles.chip,
          correct && styles.chipHint,
          pressed && styles.chipPressed,
          disabled && styles.chipDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}>
        <Text style={styles.chipText} numberOfLines={2}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Asteroids/Galaga на личном лексиконе: слово сверху, тап по верному переводу.
 */
export function LexiconAsteroidsScreen() {
  const insets = useSafeAreaInsets();
  const { pairs, personalCount } = useLexicon();
  const { grantCoins, coins } = useEngagement();

  const [lives, setLives] = useState(LIVES);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [phase, setPhase] = useState<'play' | 'over'>('play');
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const coinsGranted = useRef(false);

  const nextRound = useCallback(() => {
    const r = pickRoundOptions(pairs, 4);
    setRound(r);
  }, [pairs]);

  useEffect(() => {
    nextRound();
  }, [nextRound]);

  const sessionCoins = useMemo(
    () => Math.min(COINS_CAP, score * COINS_PER_HIT),
    [score],
  );

  useEffect(() => {
    if (phase !== 'over' || coinsGranted.current) return;
    coinsGranted.current = true;
    if (sessionCoins > 0) grantCoins(sessionCoins);
  }, [grantCoins, phase, sessionCoins]);

  const onPick = (label: string) => {
    if (!round || phase !== 'play' || flash) return;
    const ok = label.trim().toLowerCase() === round.target.back.trim().toLowerCase();
    if (ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFlash('ok');
      setScore((s) => s + 1);
      setTimeout(() => {
        setFlash(null);
        nextRound();
      }, 420);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setFlash('bad');
    const left = lives - 1;
    setLives(left);
    setTimeout(() => {
      setFlash(null);
      if (left <= 0) setPhase('over');
      else nextRound();
    }, 480);
  };

  const restart = () => {
    coinsGranted.current = false;
    setLives(LIVES);
    setScore(0);
    setPhase('play');
    setFlash(null);
    nextRound();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.topBar}>
        <GameBackButton variant="inline" href="/hub" />
        <View style={styles.stats}>
          <Text style={styles.stat}>♥ {lives}</Text>
          <Text style={styles.stat}>★ {score}</Text>
          <Text style={styles.stat}>◉ {coins}</Text>
        </View>
      </View>

      <Text style={styles.kicker}>
        {personalCount > 0
          ? `Твой лексикон · ${personalCount}`
          : 'Демо-слова · добавь карточки — игра станет твоей'}
      </Text>

      {phase === 'play' && round ? (
        <Animated.View entering={FadeIn.duration(280)} style={styles.arena}>
          <View style={styles.promptCard}>
            <Text style={styles.promptLabel}>переведи</Text>
            <Text style={styles.prompt}>{round.target.front}</Text>
            {round.target.pinyin ? <Text style={styles.pinyin}>{round.target.pinyin}</Text> : null}
          </View>

          <View style={[styles.field, flash === 'ok' && styles.fieldOk, flash === 'bad' && styles.fieldBad]}>
            {round.options.map((opt, i) => (
              <DriftChip
                key={`${round.target.id}-${opt}-${i}`}
                label={opt}
                index={i}
                correct={false}
                onPick={onPick}
                disabled={Boolean(flash)}
              />
            ))}
          </View>

          <Text style={styles.hint}>Тапни правильный перевод</Text>
        </Animated.View>
      ) : (
        <View style={styles.over}>
          <Text style={styles.overTitle}>Сессия</Text>
          <Text style={styles.overScore}>{score} попаданий</Text>
          <Text style={styles.overCoins}>+{sessionCoins} монет</Text>
          <GameGoldButton label="Ещё раз" onPress={restart} style={styles.again} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.voidDeep,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stats: {
    flexDirection: 'row',
    gap: 14,
  },
  stat: {
    fontSize: 14,
    fontWeight: '900',
    color: GAME_THEME.color.cream,
    letterSpacing: 0.4,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 14,
    textAlign: 'center',
  },
  arena: {
    flex: 1,
    gap: 18,
  },
  promptCard: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GAME_THEME.color.phosphorDim,
    backgroundColor: 'rgba(8, 20, 40, 0.85)',
  },
  promptLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: GAME_THEME.color.phosphor,
    marginBottom: 6,
  },
  prompt: {
    fontSize: 32,
    fontWeight: '900',
    color: GAME_THEME.color.cream,
    textAlign: 'center',
  },
  pinyin: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignContent: 'center',
    gap: 14,
    borderRadius: 12,
    paddingVertical: 12,
  },
  fieldOk: {
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
  },
  fieldBad: {
    backgroundColor: 'rgba(232, 93, 76, 0.14)',
  },
  chipWrap: {
    marginVertical: 6,
  },
  chip: {
    minHeight: 64,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: GAME_THEME.color.phosphor,
    backgroundColor: 'rgba(12, 28, 52, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipHint: {},
  chipPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  chipDisabled: {
    opacity: 0.7,
  },
  chipText: {
    fontSize: 16,
    fontWeight: '800',
    color: GAME_THEME.color.phosphorHot,
    textAlign: 'center',
  },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 8,
  },
  over: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  overTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: GAME_THEME.color.phosphor,
  },
  overScore: {
    fontSize: 36,
    fontWeight: '900',
    color: GAME_THEME.color.cream,
  },
  overCoins: {
    fontSize: 18,
    fontWeight: '800',
    color: GAME_THEME.color.phosphorHot,
    marginBottom: 16,
  },
  again: {
    minWidth: 180,
  },
});
