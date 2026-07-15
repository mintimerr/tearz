import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { LongPressWordText } from '@/components/long-press-word-text';
import { PremiumButton, PremiumChip, PremiumSurface } from '@/components/ui';
import { APP_THEME } from '@/constants/theme';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import { useTranslation } from '@/contexts/locale-context';
import { postCompanionProfile } from '@/services/companion-chat-ai';
import type { CompanionChatApiLanguage, GeneratedCompanionProfile } from '@/types/companion-chat-api';
import { fallbackCompanionProfile } from '@/utils/companion-ai-fallback-profile';

const SHEET_MAX = Math.min(Dimensions.get('window').height * 0.9, 620);
const SLIDE_OFF = SHEET_MAX + 56;

const OPEN_SPRING = { damping: 26, stiffness: 340, mass: 0.82, overshootClamping: false };
const CLOSE_TIMING = { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) };

const LANGUAGES = ['English', '中文', 'Русский'] as const;
type LangChip = (typeof LANGUAGES)[number];
type Phase = 'form' | 'searching' | 'result';

function langToApi(lang: LangChip): CompanionChatApiLanguage {
  if (lang === '中文') return 'chinese';
  if (lang === 'Русский') return 'russian';
  return 'english';
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function CompanionFindBottomSheet({ visible, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { addChat } = useCompanionChats();

  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [lang, setLang] = useState<LangChip>('English');
  const [generatedProfile, setGeneratedProfile] = useState<GeneratedCompanionProfile | null>(null);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const searchRunId = useRef(0);

  const progress = useSharedValue(0);

  const finishClose = useCallback(() => {
    setPhase('form');
    setMounted(false);
    onClose();
  }, [onClose]);

  const closeSheet = useCallback(
    (after?: () => void) => {
      progress.value = withTiming(0, CLOSE_TIMING, (finished) => {
        if (finished) {
          if (after) {
            runOnJS(after)();
          }
          runOnJS(finishClose)();
        }
      });
    },
    [finishClose, progress],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setPhase('form');
      setLang('English');
      setGeneratedProfile(null);
      setProfileLoadError(null);
      progress.value = 0;
      requestAnimationFrame(() => {
        progress.value = withSpring(1, OPEN_SPRING);
      });
    }
  }, [progress, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [SLIDE_OFF, 0]) }],
  }));

  const startSearch = useCallback(async () => {
    const langApi = langToApi(lang);
    const runId = ++searchRunId.current;
    setPhase('searching');
    setProfileLoadError(null);
    const t0 = Date.now();
    try {
      const p = await postCompanionProfile({ language: langApi });
      if (runId !== searchRunId.current) return;
      setGeneratedProfile(p);
    } catch (e) {
      if (runId !== searchRunId.current) return;
      const msg = e instanceof Error ? e.message : t('companion.findError');
      setProfileLoadError(msg);
      setGeneratedProfile(fallbackCompanionProfile(langApi));
    } finally {
      if (runId !== searchRunId.current) return;
      const elapsed = Date.now() - t0;
      const minMs = 800;
      if (elapsed < minMs) {
        await new Promise((r) => setTimeout(r, minMs - elapsed));
      }
      setPhase('result');
    }
  }, [lang, t]);

  const openChat = useCallback(() => {
    const langApi = langToApi(lang);
    const p = generatedProfile ?? fallbackCompanionProfile(langApi);
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
      companionLang: langApi,
      companionPersona: p.persona,
      companionOpeningLine: p.openingLine,
      profileMetaLine,
    });
    closeSheet(() => {
      router.push({
        pathname: '/companion-chat',
        params: {
          id,
          name: p.name,
          online: '1',
          letter: p.letter,
          color: p.color,
          companionLang: langApi,
          openingLine: encodeURIComponent(p.openingLine),
          profileMetaLine: encodeURIComponent(profileMetaLine),
        },
      });
    });
  }, [addChat, closeSheet, router, lang, generatedProfile, t]);

  const langLabel = (chip: LangChip) => {
    if (chip === '中文') return t('auth.langZh');
    if (chip === 'Русский') return t('auth.langRu');
    return t('auth.langEn');
  };

  if (!mounted && !visible) {
    return null;
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => closeSheet()}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeSheet()}>
          <Animated.View style={[styles.dim, backdropStyle]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            {
              maxHeight: SHEET_MAX,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}>
          <View style={styles.handle} />

          {phase === 'form' ? (
            <Animated.View
              key="form"
              entering={FadeIn.duration(280)}
              exiting={FadeOut.duration(180)}
              style={styles.phaseWrap}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetScroll}>
                <Text style={styles.sheetTitle}>{t('companion.findTitle')}</Text>
                <Text style={styles.sheetSubtitle}>{t('companion.findLead')}</Text>

                <Text style={styles.fieldLabel}>{t('companion.findLanguage')}</Text>
                <View style={styles.chipRow}>
                  {LANGUAGES.map((opt) => (
                    <PremiumChip
                      key={opt}
                      label={langLabel(opt)}
                      active={lang === opt}
                      onPress={() => setLang(opt)}
                      style={styles.chip}
                    />
                  ))}
                </View>

                <AuthPrimaryButton
                  label={t('companion.findStart')}
                  onPress={() => void startSearch()}
                  style={styles.startBtn}
                />
              </ScrollView>
            </Animated.View>
          ) : null}

          {phase === 'searching' ? (
            <Animated.View
              key="searching"
              entering={FadeIn.duration(280)}
              exiting={FadeOut.duration(180)}
              style={[styles.phaseWrap, styles.searching]}>
              <ActivityIndicator size="large" color={APP_THEME.color.text} />
              <Text style={styles.searchingTitle}>{t('companion.findSearching')}</Text>
              <Text style={styles.searchingHint}>{langLabel(lang)}</Text>
            </Animated.View>
          ) : null}

          {phase === 'result' && generatedProfile ? (
            <Animated.View
              key="result"
              entering={FadeIn.duration(320)}
              exiting={FadeOut.duration(180)}
              style={styles.phaseWrap}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.resultScroll}>
                <Text style={styles.foundLabel}>{t('companion.found')}</Text>

                <View style={[styles.resultAvatar, { backgroundColor: generatedProfile.color }]}>
                  <Text style={styles.resultLetter}>{generatedProfile.letter}</Text>
                </View>

                <Text style={styles.resultName}>{generatedProfile.name}</Text>
                <Text style={styles.resultMeta}>
                  {generatedProfile.age} · {generatedProfile.city}
                </Text>

                {profileLoadError ? (
                  <Text style={styles.profileHint} numberOfLines={3}>
                    {profileLoadError}
                  </Text>
                ) : null}

                <PremiumSurface variant="elevated" style={styles.bioCard}>
                  <LongPressWordText
                    text={generatedProfile.bio}
                    style={styles.resultBio}
                    animKey="sheet-found-bio"
                  />
                </PremiumSurface>

                <AuthPrimaryButton
                  label={t('companion.findStartChat')}
                  onPress={openChat}
                  style={styles.startBtn}
                />
                <PremiumButton
                  label={t('companion.findClose')}
                  variant="ghost"
                  onPress={() => closeSheet()}
                  style={styles.closeBtn}
                />
              </ScrollView>
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheet: {
    borderTopLeftRadius: APP_THEME.radius.xxl,
    borderTopRightRadius: APP_THEME.radius.xxl,
    paddingHorizontal: APP_THEME.space.xl,
    overflow: 'hidden',
    backgroundColor: APP_THEME.color.elevated,
  },
  phaseWrap: {
    flexGrow: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: APP_THEME.color.borderStrong,
    marginTop: 10,
    marginBottom: 8,
  },
  sheetScroll: {
    paddingTop: APP_THEME.space.md,
    paddingBottom: APP_THEME.space.sm,
  },
  sheetTitle: {
    ...APP_THEME.type.titleLg,
    color: APP_THEME.color.text,
    letterSpacing: -0.5,
  },
  sheetSubtitle: {
    marginTop: APP_THEME.space.sm,
    marginBottom: APP_THEME.space.xxl,
    ...APP_THEME.type.caption,
    lineHeight: 22,
    color: APP_THEME.color.muted,
  },
  fieldLabel: {
    marginBottom: APP_THEME.space.md,
    ...APP_THEME.type.label,
    color: APP_THEME.color.mutedSoft,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: APP_THEME.space.sm,
    marginBottom: APP_THEME.space.xxl,
  },
  chip: {
    flexGrow: 1,
    minWidth: 96,
  },
  startBtn: {
    marginTop: APP_THEME.space.sm,
  },
  closeBtn: {
    marginTop: APP_THEME.space.sm,
    alignSelf: 'stretch',
  },
  searching: {
    paddingVertical: 48,
    paddingHorizontal: APP_THEME.space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  searchingTitle: {
    marginTop: APP_THEME.space.xl,
    ...APP_THEME.type.title,
    color: APP_THEME.color.text,
  },
  searchingHint: {
    marginTop: APP_THEME.space.sm,
    ...APP_THEME.type.label,
    color: APP_THEME.color.mutedSoft,
  },
  resultScroll: {
    paddingTop: APP_THEME.space.md,
    paddingBottom: APP_THEME.space.sm,
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
  resultLetter: {
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
  profileHint: {
    marginTop: APP_THEME.space.md,
    paddingHorizontal: APP_THEME.space.lg,
    ...APP_THEME.type.label,
    lineHeight: 18,
    textAlign: 'center',
    color: APP_THEME.color.danger,
  },
  bioCard: {
    marginTop: APP_THEME.space.xl,
    marginBottom: APP_THEME.space.lg,
    alignSelf: 'stretch',
    padding: APP_THEME.space.lg,
  },
  resultBio: {
    ...APP_THEME.type.body,
    lineHeight: 24,
    color: APP_THEME.color.textSoft,
    textAlign: 'left',
  },
});
