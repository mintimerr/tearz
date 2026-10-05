import { Image, type ImageSource } from 'expo-image';
import * as Haptics from '@/utils/safe-haptics';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import { FadeInView } from '@/components/ui';
import { GAME_THEME } from '@/constants/game-theme';
import { useOnboardingTips } from '@/contexts/onboarding-tips-context';
import { useTranslation } from '@/contexts/locale-context';
import { usePlacement } from '@/contexts/placement-context';

type Step = {
  pose: ImageSource;
  titleKey: string;
  bodyKey: string;
};

const CHOICE_TEST = require('../../assets/images/tearz-mario/tearz-choice-test.png') as ImageSource;
const CHOICE_KNOWS = require('../../assets/images/tearz-mario/tearz-choice-knows.png') as ImageSource;

const STEPS: Step[] = [
  { pose: TEARZ_MARIO.pointAtYou, titleKey: 'intro1Title', bodyKey: 'intro1Body' },
  { pose: TEARZ_MARIO.talk, titleKey: 'intro2Title', bodyKey: 'intro2Body' },
  { pose: TEARZ_MARIO.welcome, titleKey: 'intro3Title', bodyKey: 'intro3Body' },
];

export function FirstRunOnboarding() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { hydrated, hasSeen, markSeen } = useOnboardingTips();
  const { isComplete, savePlacement } = usePlacement();
  const [index, setIndex] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const destRef = useRef<string | null>(null);

  const step = STEPS[index]!;
  const welcomeStep = index === STEPS.length - 1;

  const finish = useCallback(
    async (href: string) => {
      destRef.current = href;
      await markSeen('ink');
      await markSeen('hub');
      router.replace(href as Href);
    },
    [markSeen],
  );

  const takeTest = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void finish('/onboarding/placement');
  }, [finish]);

  const skipTest = useCallback(async () => {
    void Haptics.selectionAsync();
    if (!isComplete) {
      await savePlacement({
        completedAt: Date.now(),
        language: 'english',
        level: 'A1',
        score: 0,
      });
      await finish('/onboarding/welcome');
      return;
    }
    await finish('/hub');
  }, [finish, isComplete, savePlacement]);

  useEffect(() => {
    if (!hydrated || !hasSeen('ink')) return;
    router.replace((destRef.current ?? (isComplete ? '/hub' : '/onboarding/placement')) as Href);
  }, [hasSeen, hydrated, isComplete]);

  const advance = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (welcomeStep) {
      setChoosing(true);
      return;
    }
    setIndex((n) => n + 1);
  }, [welcomeStep]);

  const dots = useMemo(
    () =>
      STEPS.map((_, i) => (
        <View key={i} style={[styles.dot, i === index && styles.dotOn, i < index && styles.dotDone]} />
      )),
    [index],
  );

  if (hydrated && hasSeen('ink') && !destRef.current) {
    return <View style={styles.root} />;
  }

  if (choosing) {
    return (
      <View style={[styles.root, styles.choiceRoot, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 18 }]}>
        <StatusBar style="dark" />
        <Text style={styles.choiceTitle}>{t('onboarding.introTestTitle')}</Text>
        <View style={styles.pair}>
          <Pressable
            onPress={takeTest}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.introTestTake')}
            style={({ pressed }) => [styles.panel, pressed && styles.panelPressed]}>
            <Image source={CHOICE_TEST} style={styles.choiceTearz} contentFit="contain" accessibilityLabel="Tearz" />
            <Text style={styles.panelTitle}>{t('onboarding.introTestTake')}</Text>
            <Text style={styles.panelNote}>{t('onboarding.introTestTakeNote')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void skipTest()}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.introTestSkip')}
            style={({ pressed }) => [styles.panel, pressed && styles.panelPressed]}>
            <Image source={CHOICE_KNOWS} style={styles.choiceTearz} contentFit="contain" accessibilityLabel="Tearz" />
            <Text style={styles.panelTitle}>{t('onboarding.introTestSkip')}</Text>
            <Text style={styles.panelNote}>{t('onboarding.introTestSkipNote')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="dark" />

      <View style={styles.top}>
        <View style={styles.dots}>{dots}</View>
        {welcomeStep ? (
          <View style={styles.skipSpacer} />
        ) : (
          <Pressable
            onPress={() => setChoosing(true)}
            hitSlop={12}
            accessibilityRole="button"
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
            <Text style={styles.skipText}>{t('onboarding.introSkip')}</Text>
          </Pressable>
        )}
      </View>

      <FadeInView key={index} duration={420} offsetY={14} style={styles.hero}>
        <Image source={step.pose} style={styles.tearz} contentFit="contain" accessibilityLabel="Tearz" />
        <Text style={styles.title}>{t(`onboarding.${step.titleKey}`)}</Text>
        <Text style={styles.body}>{t(`onboarding.${step.bodyKey}`)}</Text>
      </FadeInView>

      <GameGoldButton
        onPress={advance}
        size="lg"
        style={styles.cta}
        accessibilityLabel={t(`onboarding.${welcomeStep ? 'introHub' : 'introNext'}`)}>
        <Text style={styles.ctaText}>{t(`onboarding.${welcomeStep ? 'introHub' : 'introNext'}`)}</Text>
      </GameGoldButton>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
    paddingHorizontal: 24,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(26,26,26,0.16)',
  },
  dotOn: {
    width: 22,
    backgroundColor: GAME_THEME.color.sky,
  },
  dotDone: {
    backgroundColor: GAME_THEME.color.ink,
  },
  skip: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipSpacer: {
    width: 72,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.55)',
  },
  pressed: {
    opacity: 0.6,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tearz: {
    width: 220,
    height: 220,
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  body: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.72)',
    textAlign: 'center',
  },
  cta: {
    width: '100%',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  choiceRoot: {
    justifyContent: 'center',
  },
  choiceTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
    marginBottom: 18,
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  panel: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 16,
    borderRadius: GAME_THEME.radius.button,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
  },
  panelPressed: {
    opacity: 0.72,
  },
  choiceTearz: {
    width: '100%',
    height: 150,
  },
  panelTitle: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  panelNote: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
});
