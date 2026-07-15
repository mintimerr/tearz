import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { LongPressWordText } from '@/components/long-press-word-text';
import { PremiumScreenShell, PremiumSurface } from '@/components/ui';
import { APP_THEME } from '@/constants/theme';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import { useTranslation } from '@/contexts/locale-context';
import { postCompanionProfile } from '@/services/companion-chat-ai';
import type { CompanionChatApiLanguage, GeneratedCompanionProfile } from '@/types/companion-chat-api';
import { fallbackCompanionProfile } from '@/utils/companion-ai-fallback-profile';

type Phase = 'searching' | 'result';

export default function CompanionFindScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ companionLang?: string }>();
  const { t } = useTranslation();
  const practiceLang: CompanionChatApiLanguage =
    params.companionLang === 'chinese'
      ? 'chinese'
      : params.companionLang === 'russian'
        ? 'russian'
        : 'english';

  const { addChat } = useCompanionChats();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('searching');
  const [profile, setProfile] = useState<GeneratedCompanionProfile | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const t0 = Date.now();
    void (async () => {
      try {
        const p = await postCompanionProfile({ language: practiceLang });
        if (cancelled.current) return;
        setProfile(p);
      } catch {
        if (cancelled.current) return;
        setProfile(fallbackCompanionProfile(practiceLang));
      } finally {
        if (cancelled.current) return;
        const elapsed = Date.now() - t0;
        const minMs = 800;
        if (elapsed < minMs) {
          await new Promise((r) => setTimeout(r, minMs - elapsed));
        }
        setPhase('result');
      }
    })();
    return () => {
      cancelled.current = true;
    };
  }, [practiceLang]);

  const openChat = useCallback(() => {
    const p = profile ?? fallbackCompanionProfile(practiceLang);
    const profileMetaLine = `${p.age} · ${p.city}`;
    const id = `found-${Date.now()}`;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const previewSlice = p.openingLine.length > 90 ? `${p.openingLine.slice(0, 87)}…` : p.openingLine;

    addChat({
      id,
      name: p.name,
      preview: previewSlice,
      time,
      unread: 0,
      online: true,
      letter: p.letter,
      color: p.color,
      presence: t('companion.online'),
      companionLang: practiceLang,
      companionPersona: p.persona,
      companionOpeningLine: p.openingLine,
      profileMetaLine,
    });

    router.replace({
      pathname: '/companion-chat',
      params: {
        id,
        name: p.name,
        online: '1',
        letter: p.letter,
        color: p.color,
        companionLang: practiceLang,
        openingLine: encodeURIComponent(p.openingLine),
        profileMetaLine: encodeURIComponent(profileMetaLine),
      },
    });
  }, [addChat, practiceLang, profile, router, t]);

  return (
    <PremiumScreenShell topOffset={0} horizontalPadding={0} style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={APP_THEME.color.text} />
        </Pressable>
      </View>

      {phase === 'searching' ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" color={APP_THEME.color.text} />
          <Text style={styles.searchingTitle}>{t('companion.findSearching')}</Text>
          <Text style={styles.searchingHint}>{t('companion.findSearchingHint')}</Text>
        </View>
      ) : profile ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.resultScroll, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.foundLabel}>{t('companion.found')}</Text>
          <View style={[styles.resultAvatar, { backgroundColor: profile.color }]}>
            <Text style={styles.resultAvatarLetter}>{profile.letter}</Text>
          </View>
          <Text style={styles.resultName}>{profile.name}</Text>
          <Text style={styles.resultMeta}>
            {profile.age} · {profile.city}
          </Text>
          <PremiumSurface variant="elevated" style={styles.bioCard}>
            <LongPressWordText text={profile.bio} style={styles.resultBio} animKey="find-full-bio" />
          </PremiumSurface>
          <AuthPrimaryButton label={t('companion.findStartChat')} onPress={openChat} style={styles.startBtn} />
        </ScrollView>
      ) : null}
    </PremiumScreenShell>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: APP_THEME.color.bg,
  },
  topBar: {
    paddingHorizontal: APP_THEME.space.sm,
    zIndex: 2,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: APP_THEME.space.xxl,
    paddingBottom: 48,
  },
  searchingTitle: {
    marginTop: APP_THEME.space.xl,
    ...APP_THEME.type.titleLg,
    color: APP_THEME.color.text,
    textAlign: 'center',
  },
  searchingHint: {
    marginTop: APP_THEME.space.sm,
    ...APP_THEME.type.caption,
    color: APP_THEME.color.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  resultScroll: {
    paddingHorizontal: APP_THEME.space.xl,
    paddingTop: APP_THEME.space.lg,
    alignItems: 'center',
  },
  foundLabel: {
    ...APP_THEME.type.label,
    color: APP_THEME.color.mutedSoft,
    marginBottom: APP_THEME.space.lg,
  },
  resultAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_THEME.space.lg,
  },
  resultAvatarLetter: {
    fontSize: 36,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultName: {
    ...APP_THEME.type.titleLg,
    color: APP_THEME.color.text,
    textAlign: 'center',
  },
  resultMeta: {
    marginTop: APP_THEME.space.xs,
    ...APP_THEME.type.caption,
    color: APP_THEME.color.muted,
    textAlign: 'center',
  },
  bioCard: {
    marginTop: APP_THEME.space.xxl,
    marginBottom: APP_THEME.space.xl,
    alignSelf: 'stretch',
    padding: APP_THEME.space.lg,
  },
  resultBio: {
    ...APP_THEME.type.body,
    lineHeight: 24,
    color: APP_THEME.color.textSoft,
  },
  startBtn: {
    alignSelf: 'stretch',
  },
});
