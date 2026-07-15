import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { LanguagePicker } from '@/components/auth/language-picker';
import { WelcomeLetterForge } from '@/components/auth/welcome-letter-forge';
import type { NativeLanguage } from '@/contexts/auth-context';
import { APP_THEME } from '@/constants/theme';

type Props = {
  getStartedLabel: string;
  signInLabel: string;
  legal: string;
  language: NativeLanguage;
  onLanguageChange: (lang: NativeLanguage) => void;
  onGetStarted: () => void;
  onSignIn: () => void;
};

export function WelcomeIntro({
  getStartedLabel,
  signInLabel,
  legal,
  language,
  onLanguageChange,
  onGetStarted,
  onSignIn,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.topRow}>
        <LanguagePicker value={language} onChange={onLanguageChange} />
      </View>

      <View style={styles.hero}>
        <WelcomeLetterForge />
      </View>

      <View style={styles.footer}>
        <AuthPrimaryButton label={getStartedLabel} onPress={onGetStarted} />

        <Pressable
          onPress={onSignIn}
          style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
          hitSlop={8}
          accessibilityRole="button">
          <Text style={styles.secondaryLabel}>{signInLabel}</Text>
        </Pressable>

        <Text style={styles.legal}>{legal}</Text>
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
    backgroundColor: APP_THEME.color.bg,
    marginHorizontal: -26,
    paddingHorizontal: 26,
  },
  footer: {
    gap: 0,
  },
  secondary: {
    alignSelf: 'stretch',
    marginTop: 12,
    minHeight: 50,
    borderRadius: APP_THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: APP_THEME.space.xl,
    backgroundColor: APP_THEME.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.borderStrong,
  },
  secondaryPressed: {
    opacity: 0.88,
    backgroundColor: APP_THEME.color.surfaceStrong,
  },
  secondaryLabel: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.22,
    color: APP_THEME.color.textSoft,
  },
  legal: {
    marginTop: 24,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    color: APP_THEME.color.mutedFaint,
    paddingHorizontal: 12,
  },
});
