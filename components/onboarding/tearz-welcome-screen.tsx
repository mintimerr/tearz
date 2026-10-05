import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import { TearzFirstVisit } from '@/components/onboarding/tearz-first-visit';
import { GAME_THEME } from '@/constants/game-theme';
import { useTranslation } from '@/contexts/locale-context';
import { useOnboardingTips } from '@/contexts/onboarding-tips-context';
import { usePlacement } from '@/contexts/placement-context';
import { nextPlacementTarget } from '@/utils/placement-next-level';

export function TearzWelcomeScreen() {
  const { t } = useTranslation();
  const { record } = usePlacement();
  const { hydrated, hasSeen } = useOnboardingTips();

  useEffect(() => {
    if (hydrated && hasSeen('welcome')) {
      router.replace('/hub');
    }
  }, [hasSeen, hydrated]);

  const target = useMemo(
    () => (record ? nextPlacementTarget(record) : null),
    [record],
  );

  const lines = useMemo(() => {
    const current = target?.currentLabel ?? record?.level ?? 'A1';
    if (target?.isMastery) {
      return [
        t('onboarding.welcomeLine1'),
        t('onboarding.welcomeLine2Mastery', { current }),
        t('onboarding.welcomeLine3'),
      ];
    }
    const next = target?.nextLabel ?? 'A2';
    return [
      t('onboarding.welcomeLine1'),
      t('onboarding.welcomeLine2', { current, next }),
      t('onboarding.welcomeLine3'),
    ];
  }, [record?.level, t, target]);

  if (hydrated && hasSeen('welcome')) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <TearzFirstVisit
        tipId="welcome"
        asScreen
        pose={TEARZ_MARIO.pointAtYou}
        lines={lines}
        footnote={t('onboarding.welcomeFootnote')}
        ctaLabel={t('onboarding.welcomeCta')}
        onDismiss={() => router.replace('/hub')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
});
