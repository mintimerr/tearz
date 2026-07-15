import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PremiumButton, PremiumSurface } from '@/components/ui';
import { useTranslation } from '@/contexts/locale-context';
import { useVocabulary } from '@/contexts/vocabulary-context';
import { APP_THEME } from '@/constants/theme';
import { detectWordLang } from '@/utils/detect-word-lang';
import { fetchCardSuggestion, instantCardFields } from '@/utils/card-suggestion';
import { isAbortError } from '@/utils/abort-error';
import { localeLangLabel } from '@/utils/locale-lang-label';

const { height: WIN_H } = Dimensions.get('window');

type WordAddSheetContextValue = {
  openWord: (word: string) => void;
};

const WordAddSheetContext = createContext<WordAddSheetContextValue | null>(null);

export function useWordAddSheet() {
  const ctx = useContext(WordAddSheetContext);
  if (!ctx) throw new Error('WordAddSheetProvider missing');
  return ctx;
}

export function WordAddSheetProvider({ children }: { children: ReactNode }) {
  const { t, locale } = useTranslation();
  const insets = useSafeAreaInsets();
  const { addWord, hasWord, entries } = useVocabulary();

  const [visible, setVisible] = useState(false);
  const [sheetWord, setSheetWord] = useState<string | null>(null);
  const [sheetDuplicate, setSheetDuplicate] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sheetErr, setSheetErr] = useState<string | null>(null);
  const [prefetching, setPrefetching] = useState(false);
  const [prefetchedTr, setPrefetchedTr] = useState<string | null>(null);
  const [prefetchedPy, setPrefetchedPy] = useState<string | null>(null);
  const [savedToastVisible, setSavedToastVisible] = useState(false);
  const addCancelled = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetSheetState = useCallback(() => {
    setSheetWord(null);
    setSheetDuplicate(false);
    setSheetErr(null);
    setAdding(false);
    setPrefetching(false);
    setPrefetchedTr(null);
    setPrefetchedPy(null);
    setVisible(false);
  }, []);

  const closeSheet = useCallback((after?: () => void) => {
    addCancelled.current = true;
    setVisible(false);
    resetSheetState();
    after?.();
  }, [resetSheetState]);

  const openWord = useCallback(
    (raw: string) => {
      const w = raw.trim();
      if (!w) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      InteractionManager.runAfterInteractions(() => {
        addCancelled.current = false;
        setSheetErr(null);
        setPrefetchedTr(null);
        setPrefetchedPy(null);
        const dup = hasWord(w);
        setSheetDuplicate(dup);
        setPrefetching(!dup);
        setSheetWord(w);
        setVisible(true);
      });
    },
    [hasWord],
  );

  useEffect(() => {
    if (!sheetWord || sheetDuplicate) {
      setPrefetching(false);
      return;
    }
    const w = sheetWord.trim();
    if (!w) {
      setPrefetching(false);
      return;
    }

    const instant = instantCardFields(w, locale, { entries });
    setPrefetchedTr(instant.translation);
    setPrefetchedPy(instant.pinyin);
    if (instant.translation) {
      setPrefetching(false);
      setSheetErr(null);
      return;
    }

    const controller = new AbortController();
    setPrefetching(true);
    setSheetErr(null);

    void fetchCardSuggestion(w, locale, { entries, signal: controller.signal })
      .then((result) => {
        setPrefetchedTr(result.translation);
        setPrefetchedPy(result.pinyin);
        if (!result.translation) setSheetErr(t('vocabulary.translateError'));
      })
      .catch((e: unknown) => {
        if (isAbortError(e)) return;
        setSheetErr(t('common.errorGeneric'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPrefetching(false);
      });

    return () => controller.abort();
  }, [entries, sheetWord, sheetDuplicate, t, locale]);

  useEffect(() => {
    if (!savedToastVisible) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSavedToastVisible(false), 1600);
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [savedToastVisible]);

  const sheetWordLang = sheetWord ? detectWordLang(sheetWord) : null;
  const sameLangAsApp = sheetWordLang === locale;
  const targetLangLabel = localeLangLabel(locale, t);
  const sheetHint = sameLangAsApp
    ? t('vocabulary.addFromChatSameLang', { lang: targetLangLabel })
    : t('vocabulary.addFromChatHint', { lang: targetLangLabel });

  const confirmAdd = useCallback(async () => {
    if (!sheetWord) return;
    const w = sheetWord.trim();
    if (!w || hasWord(w)) return;
    setAdding(true);
    setSheetErr(null);
    const lang = detectWordLang(w);
    try {
      let tr = prefetchedTr?.trim() || null;
      let py: string | null | undefined = prefetchedPy;
      if (!tr) {
        const result = await fetchCardSuggestion(w, locale, { entries });
        tr = result.translation;
        py = result.pinyin;
      }
      if (!tr) {
        setSheetErr(t('vocabulary.translateError'));
        setAdding(false);
        return;
      }
      if (addCancelled.current) {
        setAdding(false);
        return;
      }
      const ok = addWord(w, { translation: tr, pinyin: py ?? undefined, lang });
      if (!ok) {
        setSheetDuplicate(true);
        setAdding(false);
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeSheet(() => setSavedToastVisible(true));
    } catch {
      setSheetErr(t('common.errorGeneric'));
    } finally {
      setAdding(false);
    }
  }, [addWord, closeSheet, entries, hasWord, locale, prefetchedPy, prefetchedTr, sheetWord, t]);

  return (
    <WordAddSheetContext.Provider value={{ openWord }}>
      {children}

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => closeSheet()}>
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetDim} onPress={() => closeSheet()} />

          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.handle} />

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetScroll}>
              <Text style={styles.sheetEyebrow}>{t('vocabulary.title')}</Text>
              <Text style={styles.sheetWord}>{sheetWord}</Text>

              {sheetDuplicate ? (
                <View style={styles.dupBlock}>
                  <View style={styles.dupBadge}>
                    <Ionicons name="bookmark" size={14} color={APP_THEME.color.muted} />
                    <Text style={styles.dupText}>{t('vocabulary.alreadyInList')}</Text>
                  </View>
                  <PremiumButton
                    label={t('vocabulary.studyClose')}
                    variant="primary"
                    onPress={() => closeSheet()}
                    style={styles.soloBtn}
                  />
                </View>
              ) : (
                <>
                  <Text style={styles.sheetHint}>{sheetHint}</Text>

                  <PremiumSurface variant="elevated" style={styles.translationCard}>
                    {prefetching && !prefetchedTr ? (
                      <View style={styles.prefetchRow}>
                        <ActivityIndicator color={APP_THEME.color.mutedSoft} size="small" />
                        <Text style={styles.prefetchText}>{t('vocabulary.fetchingTranslation')}</Text>
                      </View>
                    ) : null}

                    {prefetchedPy ? <Text style={styles.pinyin}>{prefetchedPy}</Text> : null}

                    {prefetchedTr ? (
                      <Text style={styles.translation} numberOfLines={5}>
                        {prefetchedTr}
                      </Text>
                    ) : !prefetching ? (
                      <Text style={styles.translationMuted}>{t('vocabulary.translationPending')}</Text>
                    ) : null}
                  </PremiumSurface>

                  {sheetErr ? <Text style={styles.sheetErr}>{sheetErr}</Text> : null}

                  <View style={styles.actions}>
                    <PremiumButton
                      label={t('common.cancel')}
                      variant="ghost"
                      onPress={() => closeSheet()}
                      disabled={adding}
                      style={styles.actionBtn}
                    />
                    <PremiumButton
                      variant="primary"
                      onPress={() => void confirmAdd()}
                      disabled={adding}
                      style={styles.actionBtn}
                      label={adding ? undefined : t('vocabulary.addShort')}>
                      {adding ? <ActivityIndicator color="#000000" size="small" /> : null}
                    </PremiumButton>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={savedToastVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.toastRoot} pointerEvents="none">
          <View style={styles.toastPill} accessibilityLabel={t('vocabulary.savedWord')}>
            <View style={styles.toastIcon}>
              <Ionicons name="checkmark" size={16} color="#000000" />
            </View>
            <Text style={styles.toastText}>{t('vocabulary.savedWord')}</Text>
          </View>
        </View>
      </Modal>
    </WordAddSheetContext.Provider>
  );
}

const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  sheet: {
    maxHeight: Math.min(WIN_H * 0.82, 520),
    borderTopLeftRadius: APP_THEME.radius.xxl,
    borderTopRightRadius: APP_THEME.radius.xxl,
    backgroundColor: APP_THEME.color.elevated,
    paddingHorizontal: APP_THEME.space.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: APP_THEME.color.borderStrong,
    marginTop: 10,
    marginBottom: 6,
  },
  sheetScroll: {
    paddingTop: APP_THEME.space.sm,
    paddingBottom: APP_THEME.space.sm,
  },
  sheetEyebrow: {
    ...APP_THEME.type.label,
    color: APP_THEME.color.mutedSoft,
    marginBottom: APP_THEME.space.xs,
  },
  sheetWord: {
    ...APP_THEME.type.titleLg,
    color: APP_THEME.color.text,
    letterSpacing: -0.55,
    marginBottom: APP_THEME.space.lg,
  },
  sheetHint: {
    ...APP_THEME.type.caption,
    lineHeight: 22,
    color: APP_THEME.color.muted,
    marginBottom: APP_THEME.space.md,
  },
  translationCard: {
    padding: APP_THEME.space.lg,
    minHeight: 72,
    marginBottom: APP_THEME.space.md,
    borderRadius: APP_THEME.radius.lg,
    backgroundColor: APP_THEME.color.bgSoft,
  },
  prefetchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_THEME.space.sm,
  },
  prefetchText: {
    ...APP_THEME.type.label,
    color: APP_THEME.color.mutedSoft,
  },
  pinyin: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: APP_THEME.color.muted,
    marginBottom: APP_THEME.space.xs,
  },
  translation: {
    ...APP_THEME.type.body,
    fontWeight: '500',
    lineHeight: 24,
    color: APP_THEME.color.textSoft,
  },
  translationMuted: {
    ...APP_THEME.type.caption,
    lineHeight: 22,
    color: APP_THEME.color.mutedSoft,
  },
  sheetErr: {
    ...APP_THEME.type.label,
    color: APP_THEME.color.danger,
    marginBottom: APP_THEME.space.md,
  },
  actions: {
    flexDirection: 'row',
    gap: APP_THEME.space.sm,
    marginTop: APP_THEME.space.xs,
  },
  actionBtn: {
    flex: 1,
  },
  dupBlock: {
    gap: APP_THEME.space.lg,
    paddingTop: APP_THEME.space.xs,
  },
  dupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: APP_THEME.space.xs,
    paddingHorizontal: APP_THEME.space.md,
    paddingVertical: APP_THEME.space.sm,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: APP_THEME.color.accentSoft,
  },
  dupText: {
    ...APP_THEME.type.label,
    fontWeight: '500',
    color: APP_THEME.color.muted,
  },
  soloBtn: {
    alignSelf: 'stretch',
  },
  toastRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 96,
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_THEME.space.sm,
    paddingVertical: APP_THEME.space.sm + 2,
    paddingHorizontal: APP_THEME.space.lg,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: APP_THEME.color.text,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  toastIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: APP_THEME.color.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    ...APP_THEME.type.caption,
    fontWeight: '600',
    color: '#000000',
  },
});
