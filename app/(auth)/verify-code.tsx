import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';

import { AuthField, authScreenStyles as styles } from '@/components/auth/auth-field';
import { VerifyCodeDevBanner } from '@/components/auth/verify-code-dev-banner';
import { PremiumScreenShell } from '@/components/ui/premium-screen-shell';
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
      router.replace('/(tabs)/teacher');
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
    <PremiumScreenShell horizontalPadding={20} topOffset={4}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets>
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

          <Pressable
            onPress={() => void verify()}
            disabled={!canVerify || loading}
            style={({ pressed }) => [
              styles.cta,
              !canVerify && styles.ctaDisabled,
              pressed && canVerify && !loading && styles.ctaPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canVerify || loading }}>
            <Text style={[styles.ctaLabel, !canVerify && styles.ctaLabelDisabled]}>
              {loading ? t('common.loading') : t('auth.verifyCta')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void resend()}
            disabled={resendIn > 0 || loading}
            style={styles.altAction}
            hitSlop={10}>
            <Text style={[styles.altActionText, resendIn > 0 && styles.altActionMuted]}>
              {resendIn > 0 ? t('auth.resendIn', { sec: resendIn }) : t('auth.resendCode')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </PremiumScreenShell>
  );
}
