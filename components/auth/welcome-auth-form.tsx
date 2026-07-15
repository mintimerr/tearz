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
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { APP_THEME } from '@/constants/theme';

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
        <View style={styles.inner}>
          <Pressable onPress={onBack} style={styles.backFab} hitSlop={8} accessibilityRole="button">
            <Ionicons name="chevron-back" size={20} color={APP_THEME.color.textSoft} />
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

          <AuthPrimaryButton
            label={ctaLabel}
            onPress={onSubmit}
            disabled={!canSubmit || loading}
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
    paddingHorizontal: 26,
  },
  inner: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  backFab: {
    width: 44,
    height: 44,
    borderRadius: APP_THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.42,
    textTransform: 'lowercase',
    color: APP_THEME.color.mutedSoft,
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.64,
    color: APP_THEME.color.text,
    marginBottom: 32,
  },
  fields: {
    gap: 4,
  },
  error: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 14,
    fontWeight: '500',
    color: APP_THEME.color.danger,
  },
  cta: {
    marginTop: 28,
  },
  switch: {
    alignSelf: 'center',
    marginTop: 22,
    paddingVertical: 8,
  },
  switchText: {
    fontSize: 15,
    color: APP_THEME.color.muted,
    letterSpacing: -0.15,
  },
  switchAction: {
    color: APP_THEME.color.textSoft,
    fontWeight: '600',
  },
});
