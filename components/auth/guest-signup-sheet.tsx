import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from '@/utils/safe-haptics';

import { AuthField } from '@/components/auth/auth-field';
import { VerifyCodeDevBanner } from '@/components/auth/verify-code-dev-banner';
import { GameGoldButton } from '@/components/game/game-gold-button';
import { GAME_THEME } from '@/constants/game-theme';
import { Fonts } from '@/constants/theme';
import { useAuth, type NativeLanguage } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/locale-context';

const RESEND_COOLDOWN_SEC = 60;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** profile — кнопка в профиле гостя. gate — после бесплатных тренировок. */
  variant?: 'gate' | 'profile';
};

function trError(t: (k: string, params?: Record<string, string | number>) => string, error?: string) {
  if (!error) return '';
  if (error.startsWith('auth.errorServerUnreachable|')) {
    const base = error.split('|')[1] ?? '';
    return `${t('auth.errorServerUnreachable')}${base ? `\n${base}` : ''}`;
  }
  if (error.startsWith('auth.')) return t(error);
  return error;
}

export function GuestSignupSheet({ visible, onClose, variant = 'gate' }: Props) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useTranslation();
  const { requestSignUpCode, completeSignUpWithCode, resendSignUpCode, signIn } = useAuth();

  const [mode, setMode] = useState<'signUp' | 'signIn'>('signUp');
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<'dev' | 'email' | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setMode('signUp');
    setStep('form');
    setError(null);
    setLoading(false);
    setCode('');
    setDevCode(null);
    setDelivery(null);
    setResendIn(0);
  }, [visible]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => {
      setResendIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const nativeLanguage: NativeLanguage = locale === 'zh' || locale === 'en' ? locale : 'ru';

  const sendCode = useCallback(async () => {
    if (loading) return;
    if (!name.trim()) {
      setError(t('auth.errorNick'));
      return;
    }
    setError(null);
    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await requestSignUpCode({
        email: email.trim(),
        password,
        displayName: name.trim(),
        nativeLanguage,
      });
      if (!result.ok) {
        setError(trError(t, result.error ?? 'auth.errorSendCode'));
        return;
      }
      setDevCode(result.devCode ?? null);
      setDelivery(result.delivery ?? (result.devCode ? 'dev' : 'email'));
      setCode('');
      setResendIn(RESEND_COOLDOWN_SEC);
      setStep('code');
    } catch {
      setError(t('auth.errorSendCode'));
    } finally {
      setLoading(false);
    }
  }, [email, loading, name, nativeLanguage, password, requestSignUpCode, t]);

  const signInNow = useCallback(async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await signIn(email.trim(), password);
      if (!result.ok) {
        setError(trError(t, result.error ?? 'auth.errorSignIn'));
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      setError(t('auth.errorSignIn'));
    } finally {
      setLoading(false);
    }
  }, [email, loading, onClose, password, signIn, t]);

  const verify = useCallback(async () => {
    if (loading || code.replace(/\D/g, '').length !== 6) return;
    setError(null);
    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await completeSignUpWithCode(code);
      if (!result.ok) {
        setError(trError(t, result.error ?? 'auth.errorInvalidCode'));
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      setError(t('auth.errorSignUp'));
    } finally {
      setLoading(false);
    }
  }, [code, completeSignUpWithCode, loading, onClose, t]);

  const resend = useCallback(async () => {
    if (resendIn > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await resendSignUpCode();
      if (!result.ok) {
        setError(trError(t, result.error ?? 'auth.errorSendCode'));
        return;
      }
      setDevCode(result.devCode ?? null);
      setDelivery(result.delivery ?? (result.devCode ? 'dev' : 'email'));
      setResendIn(RESEND_COOLDOWN_SEC);
    } catch {
      setError(t('auth.errorSendCode'));
    } finally {
      setLoading(false);
    }
  }, [loading, resendIn, resendSignUpCode, t]);

  const maskedEmail = (() => {
    const trimmed = email.trim().toLowerCase();
    const [local, domain] = trimmed.split('@');
    if (!local || !domain) return trimmed;
    const visible = local.length <= 2 ? (local[0] ?? '*') : `${local.slice(0, 2)}…`;
    return `${visible}@${domain}`;
  })();
  const codeReady = code.replace(/\D/g, '').length === 6;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.dim} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {step === 'form' ? (
              <>
                <Text style={styles.title}>
                  {mode === 'signIn'
                    ? t('auth.welcomeBack')
                    : variant === 'profile'
                      ? t('profile.guestAuthCta')
                      : t('auth.guestTitle')}
                </Text>
                <Text style={styles.body}>
                  {mode === 'signIn'
                    ? t('auth.guestSignInBody')
                    : variant === 'profile'
                      ? t('profile.guestAuthBody')
                      : t('auth.guestBody')}
                </Text>
                {mode === 'signUp' ? (
                  <AuthField
                    label={t('auth.guestNick')}
                    value={name}
                    onChangeText={setName}
                    placeholder={t('auth.guestNickPlaceholder')}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                ) : null}
                <AuthField
                  label={t('auth.email')}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('auth.emailPlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
                <AuthField
                  label={t('auth.password')}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t(mode === 'signIn' ? 'auth.passwordPlaceholderSignIn' : 'auth.passwordPlaceholderSignUp')}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                />
              </>
            ) : (
              <>
                <Pressable onPress={() => { setError(null); setStep('form'); }} hitSlop={12} style={styles.backHit}>
                  <Text style={styles.back}>← {t('auth.back')}</Text>
                </Pressable>
                <Text style={styles.title}>{t('auth.codeTitle')}</Text>
                <Text style={styles.body}>
                  {t('auth.codeHint')} <Text style={styles.email}>{maskedEmail}</Text>
                </Text>
                {delivery !== 'dev' ? (
                  <>
                    <Text style={styles.hint}>{t('auth.codeEmailSent')}</Text>
                    <Text style={styles.hint}>{t('auth.codeEmailSpam')}</Text>
                  </>
                ) : null}
                {devCode ? (
                  <VerifyCodeDevBanner
                    code={devCode}
                    title={t('auth.codeDevTitle')}
                    hint={t('auth.codeDevHint')}
                    serverHint={t('auth.codeDevServer')}
                    tapHint={t('auth.codeDevTap')}
                    onUseCode={() => setCode(devCode)}
                  />
                ) : null}
                <AuthField
                  label={t('auth.codeLabel')}
                  value={code}
                  onChangeText={(txt) => {
                    setCode(txt.replace(/\D/g, '').slice(0, 6));
                    setError(null);
                  }}
                  placeholder={t('auth.codePlaceholder')}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                />
              </>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <GameGoldButton
              label={
                loading
                  ? '…'
                  : step === 'code'
                    ? t('auth.verifyCta')
                    : mode === 'signIn'
                      ? t('auth.signInCta')
                      : t('auth.signUpCta')
              }
              onPress={() => void (step === 'code' ? verify() : mode === 'signIn' ? signInNow() : sendCode())}
              disabled={loading || (step === 'code' && !codeReady)}
              tone="sky"
              size="lg"
              style={styles.cta}
            />
            {step === 'form' ? (
              <Pressable
                onPress={() => {
                  setError(null);
                  setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
                }}
                style={styles.laterHit}>
                <Text style={styles.later}>
                  {mode === 'signIn' ? t('auth.noAccount') : t('auth.hasAccount')}
                  <Text style={styles.laterStrong}>{mode === 'signIn' ? t('auth.signUp') : t('auth.signIn')}</Text>
                </Text>
              </Pressable>
            ) : null}
            {step === 'code' ? (
              <Pressable
                onPress={() => void resend()}
                disabled={resendIn > 0 || loading}
                style={styles.laterHit}>
                <Text style={[styles.later, (resendIn > 0 || loading) && styles.laterDim]}>
                  {resendIn > 0 ? t('auth.resendIn', { sec: resendIn }) : t('auth.resendCode')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} style={styles.laterHit}>
              <Text style={styles.later}>{t('auth.guestLater')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 10, 24, 0.78)',
  },
  sheet: {
    backgroundColor: GAME_THEME.color.cream,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 3,
    borderColor: GAME_THEME.color.ink,
    maxHeight: '88%',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 12,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  body: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: GAME_THEME.color.ink,
    marginBottom: 4,
  },
  hint: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    lineHeight: 19,
    color: GAME_THEME.color.ink,
    opacity: 0.7,
  },
  email: {
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  backHit: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  back: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.55)',
  },
  error: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    lineHeight: 19,
    color: GAME_THEME.color.danger,
    fontWeight: '700',
  },
  cta: {
    marginTop: 4,
  },
  laterHit: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  later: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  laterStrong: {
    fontWeight: '800',
    color: GAME_THEME.color.goldLip,
  },
  laterDim: {
    opacity: 0.4,
  },
});
