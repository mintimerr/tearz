import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { LanguagePicker } from '@/components/auth/language-picker';
import { WelcomeLetterForge } from '@/components/auth/welcome-letter-forge';
import type { NativeLanguage } from '@/contexts/auth-context';
import { GAME_THEME } from '@/constants/game-theme';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/constants/legal';

type Props = {
  getStartedLabel: string;
  signInLabel: string;
  legalPrefix: string;
  termsLabel: string;
  privacyLabel: string;
  legalAnd: string;
  language: NativeLanguage;
  onLanguageChange: (lang: NativeLanguage) => void;
  onGetStarted: () => void;
  onSignIn: () => void;
};

export function WelcomeIntro({
  getStartedLabel,
  signInLabel,
  legalPrefix,
  termsLabel,
  privacyLabel,
  legalAnd,
  language,
  onLanguageChange,
  onGetStarted,
  onSignIn,
}: Props) {
  const insets = useSafeAreaInsets();

  const openTerms = () => {
    void Linking.openURL(getTermsOfServiceUrl());
  };
  const openPrivacy = () => {
    void Linking.openURL(getPrivacyPolicyUrl());
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.topRow}>
        <LanguagePicker value={language} onChange={onLanguageChange} />
      </View>

      <View style={styles.hero}>
        <WelcomeLetterForge />
      </View>

      <View style={styles.footer}>
        <GameGoldButton label={getStartedLabel} onPress={onGetStarted} size="lg" />

        <Pressable
          onPress={onSignIn}
          style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
          hitSlop={8}
          accessibilityRole="button">
          <Text style={styles.secondaryLabel}>{signInLabel}</Text>
        </Pressable>

        <Text style={styles.legal}>
          {legalPrefix}{' '}
          <Text style={styles.legalLink} onPress={openTerms} accessibilityRole="link">
            {termsLabel}
          </Text>
          {legalAnd}
          <Text style={styles.legalLink} onPress={openPrivacy} accessibilityRole="link">
            {privacyLabel}
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    zIndex: 1,
    paddingHorizontal: 26,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  hero: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 24,
    overflow: 'visible',
  },
  footer: {
    gap: 0,
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 4,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 6,
    marginHorizontal: -4,
    padding: 16,
  },
  secondary: {
    alignSelf: 'stretch',
    marginTop: 12,
    minHeight: 50,
    borderRadius: GAME_THEME.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
  },
  secondaryPressed: {
    opacity: 0.85,
    transform: [{ translateY: 1 }],
  },
  secondaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: GAME_THEME.color.ink,
  },
  legal: {
    marginTop: 20,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    color: 'rgba(26,26,26,0.45)',
    paddingHorizontal: 12,
  },
  legalLink: {
    color: GAME_THEME.color.ink,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
