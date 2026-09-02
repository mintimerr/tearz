import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthField } from '@/components/auth/auth-field';
import { AuthScreenBackground } from '@/components/auth/auth-screen-background';
import { VerifyCodeDevBanner } from '@/components/auth/verify-code-dev-banner';
import { GameGoldButton } from '@/components/game/game-gold-button';
import { DEMO_SKIP_AUTH } from '@/constants/demo';
import { GAME_THEME } from '@/constants/game-theme';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/locale-context';

const RESEND_COOLDOWN_SEC = 60;

function trError(t: (k: string, params?: Record<string, string | number>) => string, error?: string) {
  if (!error) return '';
  if (error.startsWith('auth.errorServerUnreachable|')) {
    const base = error.split('|')[1] ?? '';
    return `${t('auth.errorServerUnreachable')}${base ? `\n${base}` : ''}`;
  }
  if (error.startsWith('auth.')) return t(error);
  return error;
}

export default function VerifyCodeScreen() {
  if (DEMO_SKIP_AUTH) {
    return <Redirect href="/" />;
  }

  return <VerifyCodeScreenInner />;
}

function VerifyCodeScreenInner() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { completeSignUpWithCode, resendSignUpCode } = useAuth();
  const params = useLocalSearchParams<{ email?: string; devCode?: string; delivery?: string }>();

  const email = (params.email ?? '').trim().toLowerCase();
  const initialDevCode = (params.devCode ?? '').trim() || null;
  const isDevDelivery = params.delivery === 'dev' || !!initialDevCode;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(initialDevCode);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SEC);

  useEffect(() => {
    if (!email || !email.includes('@')) {
      router.replace('/(auth)/welcome');
    }
  }, [email]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => {
      setResendIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const maskedEmail = useMemo(() => {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const visible = local.length <= 2 ? local[0] ?? '*' : `${local.slice(0, 2)}…`;
    return `${visible}@${domain}`;
  }, [email]);

  const canVerify = code.replace(/\D/g, '').length === 6;

  const verify = useCallback(async () => {
    if (!canVerify || loading) return;
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
      router.replace('/onboarding/placement');
    } catch {
      setError(t('common.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [canVerify, code, completeSignUpWithCode, loading, t]);

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
      if (result.devCode) {
        setCode(result.devCode);
      }
      setResendIn(RESEND_COOLDOWN_SEC);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setLoading(false);
    }
  }, [loading, resendIn, resendSignUpCode, t]);

  if (!email || !email.includes('@')) {
    return null;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AuthScreenBackground />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets>
          <View style={styles.panel}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
              <Text style={styles.backBtnText}>← {t('auth.back')}</Text>
            </Pressable>

            <View style={styles.hero}>
              <Text style={styles.wordmark}>tearz</Text>
              <Text style={styles.title}>{t('auth.codeTitle')}</Text>
              <Text style={styles.hint}>
                {t('auth.codeHint')}{' '}
                <Text style={styles.hintEmail}>{maskedEmail}</Text>
              </Text>
              {!isDevDelivery ? (
                <>
                  <Text style={styles.emailSent}>{t('auth.codeEmailSent')}</Text>
                  <Text style={styles.spamHint}>{t('auth.codeEmailSpam')}</Text>
                </>
              ) : null}
            </View>

            {devCode && __DEV__ ? (
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
              placeholder={t('auth.codePlaceholder')}
              value={code}
              onChangeText={(txt) => {
                setCode(txt.replace(/\D/g, '').slice(0, 6));
                setError(null);
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete={Platform.OS === 'ios' ? 'one-time-code' : 'sms-otp'}
              maxLength={6}
              autoFocus
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <GameGoldButton
              label={loading ? t('common.loading') : t('auth.verifyCta')}
              onPress={() => void verify()}
              disabled={!canVerify || loading}
              size="lg"
              style={styles.cta}
            />

            <Pressable
              onPress={() => void resend()}
              disabled={resendIn > 0 || loading}
              style={styles.altAction}
              hitSlop={10}>
              <Text style={[styles.altActionText, resendIn > 0 && styles.altActionMuted]}>
                {resendIn > 0 ? t('auth.resendIn', { sec: resendIn }) : t('auth.resendCode')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.void,
  },
  flex: { flex: 1, zIndex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 22,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 6,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 4,
    paddingRight: 12,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.55)',
  },
  hero: {
    marginBottom: 18,
  },
  wordmark: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: 'rgba(26,26,26,0.45)',
    textTransform: 'lowercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 30,
    color: GAME_THEME.color.ink,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
  },
  hintEmail: {
    color: GAME_THEME.color.ink,
    fontWeight: '800',
  },
  emailSent: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    color: GAME_THEME.color.ink,
  },
  spamHint: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.45)',
  },
  error: {
    marginTop: -4,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '700',
    color: GAME_THEME.color.danger,
  },
  cta: {
    marginTop: 8,
  },
  altAction: {
    alignSelf: 'center',
    paddingVertical: 4,
    marginTop: 14,
  },
  altActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
  },
  altActionMuted: {
    color: 'rgba(26,26,26,0.35)',
  },
});
