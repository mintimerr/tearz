import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthScreenBackground } from '@/components/auth/auth-screen-background';
import { WelcomeAuthForm, type AuthFormMode } from '@/components/auth/welcome-auth-form';
import { WelcomeIntro } from '@/components/auth/welcome-intro';
import { APP_THEME } from '@/constants/theme';
import { useAuth, type NativeLanguage } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/locale-context';

type Step = 'intro' | 'auth';

function trError(t: (k: string) => string, error?: string) {
  if (!error) return '';
  if (error.startsWith('auth.errorServerUnreachable|')) {
    const base = error.split('|')[1] ?? '';
    return `${t('auth.errorServerUnreachable')}${base ? `\n${base}` : ''}`;
  }
  if (error.startsWith('auth.')) return t(error);
  return error;
}

export default function WelcomeScreen() {
  const { t, locale, setPreviewLocale } = useTranslation();
  const { signIn, requestSignUpCode } = useAuth();

  const [step, setStep] = useState<Step>('intro');
  const [mode, setMode] = useState<AuthFormMode>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState<NativeLanguage>(locale);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const canSubmit = useMemo(() => {
    if (!normalizedEmail.includes('@') || password.length < 6) return false;
    if (mode === 'signUp') return !!name.trim();
    return true;
  }, [mode, name, normalizedEmail, password.length]);

  const openAuth = useCallback((nextMode: AuthFormMode) => {
    setMode(nextMode);
    setError(null);
    setStep('auth');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const pickLanguage = useCallback(
    (lang: NativeLanguage) => {
      setNativeLanguage(lang);
      setPreviewLocale(lang);
      void Haptics.selectionAsync();
    },
    [setPreviewLocale],
  );

  const submit = useCallback(async () => {
    if (!canSubmit || loading) return;
    setError(null);
    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (mode === 'signIn') {
        const result = await signIn(normalizedEmail, password);
        if (!result.ok) {
          setError(trError(t, result.error ?? 'auth.errorSignIn'));
          return;
        }
      } else {
        const result = await requestSignUpCode({
          email: normalizedEmail,
          password,
          displayName: name.trim(),
          nativeLanguage,
        });
        if (!result.ok) {
          setError(trError(t, result.error ?? 'auth.errorSendCode'));
          return;
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push({
          pathname: '/(auth)/verify-code',
          params: {
            email: normalizedEmail,
            devCode: result.devCode ?? '',
            delivery: result.delivery ?? '',
          },
        });
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/teacher');
    } catch {
      setError(t('common.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [canSubmit, loading, mode, name, nativeLanguage, normalizedEmail, password, signIn, requestSignUpCode, t]);

  const ctaLabel = loading ? t('common.loading') : mode === 'signIn' ? t('auth.signInCta') : t('auth.signUpCta');
  const formTitle = mode === 'signIn' ? t('auth.welcomeBack') : t('auth.createAccount');
  const passwordPlaceholder =
    mode === 'signIn' ? t('auth.passwordPlaceholderSignIn') : t('auth.passwordPlaceholderSignUp');

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <AuthScreenBackground />

      {step === 'intro' ? (
        <WelcomeIntro
          getStartedLabel={t('auth.getStarted')}
          signInLabel={t('auth.signInExisting')}
          legal={t('auth.legal')}
          language={nativeLanguage}
          onLanguageChange={pickLanguage}
          onGetStarted={() => openAuth('signUp')}
          onSignIn={() => openAuth('signIn')}
        />
      ) : (
        <WelcomeAuthForm
          mode={mode}
          title={formTitle}
          name={name}
          email={email}
          password={password}
          error={error}
          loading={loading}
          canSubmit={canSubmit}
          ctaLabel={ctaLabel}
          switchHint={mode === 'signIn' ? t('auth.noAccount') : t('auth.hasAccount')}
          switchAction={mode === 'signIn' ? t('auth.signUp') : t('auth.signIn')}
          nameLabel={t('auth.name')}
          namePlaceholder={t('auth.namePlaceholder')}
          emailLabel={t('auth.email')}
          emailPlaceholder={t('auth.emailPlaceholder')}
          passwordLabel={t('auth.password')}
          passwordPlaceholder={passwordPlaceholder}
          onBack={() => {
            setError(null);
            setStep('intro');
          }}
          onSwitchMode={() => setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'))}
          onNameChange={setName}
          onEmailChange={(txt) => {
            setEmail(txt);
            setError(null);
          }}
          onPasswordChange={setPassword}
          onSubmit={() => void submit()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_THEME.color.bg,
  },
});
