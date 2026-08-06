import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthField } from '@/components/auth/auth-field';
import { GameGoldButton } from '@/components/game/game-gold-button';
import { GAME_THEME } from '@/constants/game-theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type AuthFormMode = 'signIn' | 'signUp';

type Props = {
  mode: AuthFormMode;
  title: string;
  name: string;
  email: string;
  password: string;
  error: string | null;
  loading: boolean;
  canSubmit: boolean;
  ctaLabel: string;
  switchHint: string;
  switchAction: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  onBack: () => void;
  onSwitchMode: () => void;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: () => void;
};

export function WelcomeAuthForm({
  mode,
  title,
  name,
  email,
  password,
  error,
  loading,
  canSubmit,
  ctaLabel,
  switchHint,
  switchAction,
  nameLabel,
  namePlaceholder,
  emailLabel,
  emailPlaceholder,
  passwordLabel,
  passwordPlaceholder,
  onBack,
  onSwitchMode,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();

  const handleSwitch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onSwitchMode();
    void Haptics.selectionAsync();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.panel}>
          <Pressable onPress={onBack} style={styles.backFab} hitSlop={8} accessibilityRole="button">
            <Ionicons name="chevron-back" size={20} color={GAME_THEME.color.ink} />
          </Pressable>

          <Text style={styles.eyebrow}>tearz</Text>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.fields}>
            {mode === 'signUp' ? (
              <AuthField
                variant="line"
                label={nameLabel}
                value={name}
                onChangeText={onNameChange}
                placeholder={namePlaceholder}
                autoCapitalize="words"
                autoCorrect={false}
              />
            ) : null}

            <AuthField
              variant="line"
              label={emailLabel}
              value={email}
              onChangeText={onEmailChange}
              placeholder={emailPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
            />

            <AuthField
              variant="line"
              label={passwordLabel}
              value={password}
              onChangeText={onPasswordChange}
              placeholder={passwordPlaceholder}
              secureTextEntry
              textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <GameGoldButton
            label={ctaLabel}
            onPress={onSubmit}
            disabled={!canSubmit || loading}
            size="lg"
            style={styles.cta}
          />

          <Pressable onPress={handleSwitch} style={styles.switch} hitSlop={10}>
            <Text style={styles.switchText}>
              {switchHint}
              <Text style={styles.switchAction}> {switchAction}</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, zIndex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  panel: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 22,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 6,
  },
  backFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,26,26,0.06)',
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.42,
    textTransform: 'lowercase',
    color: 'rgba(26,26,26,0.45)',
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.64,
    color: GAME_THEME.color.ink,
    marginBottom: 28,
  },
  fields: {
    gap: 4,
  },
  error: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 14,
    fontWeight: '700',
    color: GAME_THEME.color.danger,
  },
  cta: {
    marginTop: 24,
  },
  switch: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  switchText: {
    fontSize: 15,
    color: 'rgba(26,26,26,0.55)',
    fontWeight: '600',
  },
  switchAction: {
    color: GAME_THEME.color.ink,
    fontWeight: '800',
  },
});
