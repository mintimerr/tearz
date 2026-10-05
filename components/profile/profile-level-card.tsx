import { StyleSheet, Text, View } from 'react-native';

import { AnimatedCounter, XpLevelRing } from '@/components/ui';
import { GAME_THEME } from '@/constants/game-theme';
import { APP_THEME } from '@/constants/theme';

const XP_PER_LEVEL = 400;

type Props = {
  xp: number;
  level: number;
  levelWord: string;
  xpWord: string;
  toNextLabel: (remaining: number) => string;
};

/** Премиальная карточка уровня: кольцо прогресса + XP + сколько до следующего уровня. */
export function ProfileLevelCard({ xp, level, levelWord, xpWord, toNextLabel }: Props) {
  const intoLevel = xp % XP_PER_LEVEL;
  const progress = intoLevel / XP_PER_LEVEL;
  const remaining = XP_PER_LEVEL - intoLevel;

  return (
    <View style={styles.card}>
      <XpLevelRing progress={progress} level={level} levelLabel={levelWord} />
      <View style={styles.copy}>
        <AnimatedCounter
          value={xp}
          style={styles.xpValue}
          format={(n) => n.toLocaleString('ru-RU')}
          suffix={` ${xpWord}`}
        />
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${Math.max(4, progress * 100)}%` }]} />
        </View>
        <Text style={styles.toNext}>{toNextLabel(remaining)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 22,
    paddingVertical: 4,
  },
  copy: {
    flex: 1,
    gap: 8,
  },
  xpValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: GAME_THEME.color.ink,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26,26,26,0.08)',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: GAME_THEME.color.sky,
  },
  toNext: {
    fontSize: 13,
    letterSpacing: -0.1,
    color: APP_THEME.color.muted,
  },
});
