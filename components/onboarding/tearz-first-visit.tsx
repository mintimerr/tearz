import { Image, type ImageSource } from 'expo-image';
import * as Haptics from '@/utils/safe-haptics';
import { useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import { ComicSpeechBubble } from '@/components/teacher/comic-speech-bubble';
import { FadeInView } from '@/components/ui';
import { GAME_THEME } from '@/constants/game-theme';
import { useFirstVisitTip } from '@/contexts/onboarding-tips-context';
import type { OnboardingTipId } from '@/utils/onboarding-tips';

type Props = {
  tipId: OnboardingTipId;
  /** Main bubble lines (already localized). */
  lines: string[];
  /** Optional smaller note under bubble. */
  footnote?: string;
  ctaLabel: string;
  pose?: ImageSource;
  /** Full-screen page (no dim modal) — for post-test welcome. */
  asScreen?: boolean;
  style?: StyleProp<ViewStyle>;
  onDismiss?: () => void;
  /** When false, never auto-show (parent controls). Default true. */
  enabled?: boolean;
};

/**
 * First-visit Tearz coach: big sprite + comic cloud above the head.
 * Marks tip seen on CTA.
 */
export function TearzFirstVisit({
  tipId,
  lines,
  footnote,
  ctaLabel,
  pose = TEARZ_MARIO.talk,
  asScreen = false,
  style,
  onDismiss,
  enabled = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const { visible, dismiss } = useFirstVisitTip(tipId);
  const show = enabled && visible;

  useEffect(() => {
    if (show) void Haptics.selectionAsync();
  }, [show]);

  const finish = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await dismiss();
    onDismiss?.();
  };

  const body = (
    <View
      style={[
        styles.panel,
        asScreen && styles.panelScreen,
        asScreen && { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        style,
      ]}>
      <FadeInView duration={480} offsetY={16} style={styles.cluster}>
        <ComicSpeechBubble side="left" style={styles.bubble}>
          {lines.map((line, i) => (
            <Text key={`${tipId}-${i}`} style={[styles.line, i > 0 && styles.lineGap]}>
              {line}
            </Text>
          ))}
        </ComicSpeechBubble>

        <Image source={pose} style={styles.tearz} contentFit="contain" accessibilityLabel="Tearz" />

        {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
      </FadeInView>

      <GameGoldButton onPress={() => void finish()} style={styles.cta} accessibilityLabel={ctaLabel}>
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </GameGoldButton>
    </View>
  );

  if (!show) return null;

  if (asScreen) {
    return <View style={styles.screenRoot}>{body}</View>;
  }

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent onRequestClose={() => void finish()}>
      <Pressable style={styles.backdrop} onPress={() => void finish()}>
        <Pressable style={styles.cardWrap} onPress={(e) => e.stopPropagation()}>
          {body}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 20, 48, 0.48)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  cardWrap: {
    borderRadius: 20,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.cream,
    overflow: 'hidden',
  },
  panel: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 14,
  },
  panelScreen: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  cluster: {
    alignItems: 'center',
    gap: 6,
  },
  bubble: {
    alignSelf: 'center',
    maxWidth: '100%',
    marginBottom: 4,
  },
  line: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
  },
  lineGap: {
    marginTop: 10,
  },
  tearz: {
    width: 196,
    height: 196,
    marginTop: 2,
  },
  footnote: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.58)',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  cta: {
    width: '100%',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
});
