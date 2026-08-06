import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { GAME_THEME } from '@/constants/game-theme';
import { FULL_WORKOUT_TASK_COUNT, MINI_DRILL_TASK_COUNT } from '@/constants/teacher-drill';
import { useEngagement } from '@/contexts/engagement-context';
import { useTranslation } from '@/contexts/locale-context';
import { PLUS_DAY_COIN_COST } from '@/types/lexicon';

export type TearzPlusFeature = 'fullWorkout' | 'companionCall';

type Props = {
  visible: boolean;
  feature: TearzPlusFeature;
  onClose: () => void;
  /** После успешной покупки дня за монеты — разблокировать фичу */
  onUnlocked?: () => void;
};

function PerkRow({ line, index }: { line: string; index: number }) {
  return (
    <Animated.View entering={FadeIn.delay(100 + index * 45).duration(260)} style={styles.perkRow}>
      <View style={styles.perkIcon}>
        <Ionicons name="checkmark" size={11} color={GAME_THEME.color.ink} />
      </View>
      <Text style={styles.perkText}>{line}</Text>
    </Animated.View>
  );
}

export function TeacherFullWorkoutPaywall({ visible, feature, onClose, onUnlocked }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { coins, spendCoinsForPlusDay } = useEngagement();

  const featureCopy =
    feature === 'fullWorkout'
      ? {
          icon: 'barbell-outline' as const,
          title: t('plus.fullWorkoutTitle'),
          subtitle: t('plus.fullWorkoutSubtitle', { count: MINI_DRILL_TASK_COUNT }),
        }
      : {
          icon: 'call-outline' as const,
          title: t('plus.callTitle'),
          subtitle: t('plus.callSubtitle'),
        };

  const perks = [
    t('plus.perkWorkout', { count: FULL_WORKOUT_TASK_COUNT }),
    t('plus.perkTypes'),
    t('plus.perkCall'),
    t('plus.perkUnlimited'),
  ];

  const handleClose = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleCoinsDay = () => {
    const ok = spendCoinsForPlusDay();
    if (!ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    onClose();
    onUnlocked?.();
  };

  const canAfford = coins >= PLUS_DAY_COIN_COST;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} accessibilityLabel={t('common.cancel')} />

        <Animated.View
          entering={FadeInDown.duration(360).springify().damping(24)}
          style={[styles.panel, { marginBottom: insets.bottom + 12 }]}>
          <View style={styles.titleBar}>
            <Text style={styles.brand}>tearz</Text>
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={GAME_THEME.color.ink} />
            </Pressable>
          </View>

          <View style={styles.body}>
            <View style={styles.plusBadge}>
              <Ionicons name="diamond" size={10} color={GAME_THEME.color.ink} />
              <Text style={styles.plusBadgeText}>Plus</Text>
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroIconRing}>
                <Ionicons name={featureCopy.icon} size={22} color={GAME_THEME.color.ink} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.title}>{featureCopy.title}</Text>
                <Text style={styles.subtitle}>{featureCopy.subtitle}</Text>
              </View>
            </View>

            <View style={styles.priceCard}>
              <Text style={styles.price}>{PLUS_DAY_COIN_COST} ◉</Text>
              <Text style={styles.priceHint}>{t('plus.dayUnlock')}</Text>
              <View style={styles.priceDivider} />
              <Text style={styles.priceNote}>{t('plus.coinsBalance', { count: coins })}</Text>
            </View>

            <View style={styles.perksCard}>
              {perks.map((line, i) => (
                <PerkRow key={line} line={line} index={i} />
              ))}
            </View>

            <Text style={styles.footnote}>{t('plus.earnHint')}</Text>

            <GameGoldButton
              label={
                canAfford
                  ? t('plus.buyDay', { cost: PLUS_DAY_COIN_COST })
                  : t('plus.needCoins', { cost: PLUS_DAY_COIN_COST })
              }
              onPress={handleCoinsDay}
              size="lg"
              disabled={!canAfford}
              accessibilityLabel={t('plus.buyDayA11y', { cost: PLUS_DAY_COIN_COST })}
              style={styles.cta}
            />

            <Pressable onPress={handleClose} hitSlop={12} style={styles.dismissBtn}>
              <Text style={styles.dismissText}>{t('plus.dismiss')}</Text>
            </Pressable>
          </View>
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
    backgroundColor: 'rgba(26, 16, 32, 0.88)',
  },
  panel: {
    borderRadius: 6,
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.cream,
    overflow: 'hidden',
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 16,
    borderBottomWidth: GAME_THEME.border.thin,
    borderBottomColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.gold,
  },
  brand: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'lowercase',
    color: GAME_THEME.color.ink,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  body: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  plusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: GAME_THEME.radius.pill,
    backgroundColor: GAME_THEME.color.gold,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    marginBottom: 14,
  },
  plusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    borderRadius: GAME_THEME.radius.panel,
    backgroundColor: GAME_THEME.color.panelMuted,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
    marginBottom: 12,
  },
  heroIconRing: {
    width: 48,
    height: 48,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.gold,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  heroCopy: {
    flex: 1,
    gap: 5,
    paddingTop: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    color: GAME_THEME.color.ink,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    color: 'rgba(26,26,26,0.62)',
  },
  priceCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: GAME_THEME.radius.panel,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
    marginBottom: 12,
    gap: 6,
  },
  price: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: GAME_THEME.color.ink,
    fontVariant: ['tabular-nums'],
  },
  priceHint: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: 'rgba(26,26,26,0.55)',
  },
  priceDivider: {
    height: 2,
    marginTop: 4,
    backgroundColor: GAME_THEME.color.ink,
    opacity: 0.12,
  },
  priceNote: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.15,
    color: 'rgba(26,26,26,0.55)',
  },
  perksCard: {
    gap: 11,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: GAME_THEME.radius.panel,
    backgroundColor: GAME_THEME.color.panelMuted,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
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
    backgroundColor: GAME_THEME.color.gold,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  perkText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    color: GAME_THEME.color.ink,
  },
  footnote: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.05,
    color: 'rgba(26,26,26,0.45)',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  cta: {
    alignSelf: 'stretch',
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 2,
  },
  dismissText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.15,
    color: 'rgba(26,26,26,0.55)',
  },
});
