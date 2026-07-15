import { StyleSheet, Text, View } from 'react-native';

import { AnimatedCounter, BrandGradient, GlowCard, XpLevelRing } from '@/components/ui';
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
    <GlowCard style={styles.card} glowStrength={0.55} radius={APP_THEME.radius.xxl}>
      <BrandGradient direction="diagonal" opacity={0.1} />
      <View style={styles.inner}>
        <XpLevelRing progress={progress} level={level} levelLabel={levelWord} />
        <View style={styles.copy}>
          <AnimatedCounter
            value={xp}
            style={styles.xpValue}
            format={(n) => n.toLocaleString('ru-RU')}
            suffix={` ${xpWord}`}
          />
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${Math.max(4, progress * 100)}%` }]}>
              <BrandGradient direction="horizontal" />
            </View>
          </View>
          <Text style={styles.toNext}>{toNextLabel(remaining)}</Text>
        </View>
      </View>
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: APP_THEME.space.xxl,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    padding: 18,
  },
  copy: {
    flex: 1,
    gap: 10,
  },
  xpValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: APP_THEME.color.text,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: APP_THEME.color.elevatedSoft,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  toNext: {
    fontSize: 13,
    letterSpacing: -0.1,
    color: APP_THEME.color.muted,
  },
});
