import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { GameWindowShell } from '@/components/game/game-window-shell';
import { LongPressWordText } from '@/components/long-press-word-text';
import { GAME_THEME } from '@/constants/game-theme';
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
    <GameWindowShell
      title={t('companion.findTitle')}
      onBack={() => router.back()}
      contentPadding={16}>
      {phase === 'searching' ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" color={GAME_THEME.color.ink} />
          <Text style={styles.searchingTitle}>{t('companion.findSearching')}</Text>
          <Text style={styles.searchingHint}>{t('companion.findSearchingHint')}</Text>
        </View>
      ) : profile ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.resultScroll}>
          <Text style={styles.foundLabel}>{t('companion.found')}</Text>
          <View style={[styles.resultAvatar, { backgroundColor: profile.color }]}>
            <Text style={styles.resultAvatarLetter}>{profile.letter}</Text>
          </View>
          <Text style={styles.resultName}>{profile.name}</Text>
          <Text style={styles.resultMeta}>
            {profile.age} · {profile.city}
          </Text>
          <View style={styles.bioCard}>
            <LongPressWordText text={profile.bio} style={styles.resultBio} animKey="find-full-bio" />
          </View>
          <GameGoldButton label={t('companion.findStartChat')} onPress={openChat} size="lg" style={styles.startBtn} />
        </ScrollView>
      ) : null}
    </GameWindowShell>
  );
}

const styles = StyleSheet.create({
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  searchingTitle: {
    marginTop: 20,
    fontSize: GAME_THEME.type.title,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  searchingHint: {
    marginTop: 8,
    fontSize: GAME_THEME.type.body,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
    textAlign: 'center',
    lineHeight: 22,
  },
  resultScroll: {
    flexGrow: 1,
    paddingBottom: 24,
    alignItems: 'center',
  },
  foundLabel: {
    fontSize: GAME_THEME.type.micro,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.45)',
    marginBottom: 16,
  },
  resultAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
  },
  resultAvatarLetter: {
    fontSize: 36,
    fontWeight: '800',
    color: GAME_THEME.color.cream,
  },
  resultName: {
    fontSize: GAME_THEME.type.title,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  resultMeta: {
    marginTop: 4,
    fontSize: GAME_THEME.type.body,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
    textAlign: 'center',
  },
  bioCard: {
    marginTop: 24,
    marginBottom: 20,
    alignSelf: 'stretch',
    padding: 14,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
    borderRadius: GAME_THEME.radius.panel,
  },
  resultBio: {
    fontSize: GAME_THEME.type.body,
    lineHeight: 24,
    fontWeight: '600',
    color: GAME_THEME.color.ink,
  },
  startBtn: {
    alignSelf: 'stretch',
  },
});
