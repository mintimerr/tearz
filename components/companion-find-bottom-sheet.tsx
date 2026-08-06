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

import { LongPressWordText } from '@/components/long-press-word-text';
import { GameGoldButton } from '@/components/game/game-gold-button';
import { GAME_THEME } from '@/constants/game-theme';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import { useTranslation } from '@/contexts/locale-context';
import { postCompanionProfile } from '@/services/companion-chat-ai';
import type { CompanionChatApiLanguage, GeneratedCompanionProfile } from '@/types/companion-chat-api';
import { fallbackCompanionProfile } from '@/utils/companion-ai-fallback-profile';

const SHEET_MAX = Math.min(Dimensions.get('window').height * 0.9, 640);
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

function GameLangChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.langChip,
        active && styles.langChipOn,
        pressed && styles.langChipPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}>
      <Text style={[styles.langChipText, active && styles.langChipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** Поиск собеседника — игровой sheet (cream / ink / gold). */
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
              paddingBottom: Math.max(insets.bottom, 14),
            },
          ]}>
          <View style={styles.titleBar}>
            <View style={styles.titleBarSide} />
            <Text style={styles.titleBarText} numberOfLines={1}>
              {t('companion.findTitle')}
            </Text>
            <Pressable
              onPress={() => closeSheet()}
              hitSlop={10}
              style={({ pressed }) => [styles.closeX, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={t('companion.findClose')}>
              <Text style={styles.closeXText}>×</Text>
            </Pressable>
          </View>

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
                <Text style={styles.sheetSubtitle}>{t('companion.findLead')}</Text>

                <Text style={styles.fieldLabel}>{t('companion.findLanguage')}</Text>
                <View style={styles.chipRow}>
                  {LANGUAGES.map((opt) => (
                    <GameLangChip
                      key={opt}
                      label={langLabel(opt)}
                      active={lang === opt}
                      onPress={() => setLang(opt)}
                    />
                  ))}
                </View>

                <GameGoldButton
                  label={t('companion.findStart')}
                  onPress={() => void startSearch()}
                  size="lg"
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
              <ActivityIndicator size="large" color={GAME_THEME.color.ink} />
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

                <View style={styles.bioCard}>
                  <LongPressWordText
                    text={generatedProfile.bio}
                    style={styles.resultBio}
                    animKey="sheet-found-bio"
                  />
                </View>

                <GameGoldButton
                  label={t('companion.findStartChat')}
                  onPress={openChat}
                  size="lg"
                  style={styles.startBtn}
                />
                <Pressable
                  onPress={() => closeSheet()}
                  style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button">
                  <Text style={styles.ghostBtnText}>{t('companion.findClose')}</Text>
                </Pressable>
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
    backgroundColor: 'rgba(10, 8, 20, 0.72)',
  },
  sheet: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: GAME_THEME.color.ink,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 10,
    backgroundColor: GAME_THEME.color.gold,
    borderBottomWidth: 3,
    borderBottomColor: GAME_THEME.color.ink,
  },
  titleBarSide: {
    width: 36,
  },
  titleBarText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  closeX: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  closeXText: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
    color: GAME_THEME.color.ink,
    marginTop: -1,
  },
  phaseWrap: {
    flexGrow: 1,
  },
  sheetScroll: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sheetSubtitle: {
    marginBottom: 20,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: 'rgba(26,26,26,0.55)',
  },
  fieldLabel: {
    marginBottom: 10,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.5)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  langChip: {
    flexGrow: 1,
    minWidth: 96,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.cream,
    alignItems: 'center',
  },
  langChipOn: {
    backgroundColor: GAME_THEME.color.gold,
    borderBottomWidth: 4,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  langChipPressed: {
    opacity: 0.85,
    transform: [{ translateY: 1 }],
  },
  langChipText: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(26,26,26,0.5)',
  },
  langChipTextOn: {
    color: GAME_THEME.color.ink,
  },
  startBtn: {
    alignSelf: 'stretch',
  },
  searching: {
    paddingVertical: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  searchingTitle: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
  },
  searchingHint: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.5)',
  },
  resultScroll: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  foundLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.5)',
    marginBottom: 14,
  },
  resultAvatar: {
    width: 88,
    height: 88,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
  },
  resultLetter: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  resultName: {
    fontSize: 22,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  resultMeta: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
    textAlign: 'center',
  },
  profileHint: {
    marginTop: 12,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
    color: GAME_THEME.color.danger,
  },
  bioCard: {
    marginTop: 16,
    marginBottom: 16,
    alignSelf: 'stretch',
    padding: 14,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 6,
  },
  resultBio: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    color: GAME_THEME.color.ink,
    textAlign: 'left',
  },
  ghostBtn: {
    marginTop: 10,
    alignSelf: 'stretch',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.cream,
  },
  ghostBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
});
