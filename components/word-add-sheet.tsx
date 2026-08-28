import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PremiumButton } from '@/components/ui';
import { GAME_THEME } from '@/constants/game-theme';
import { useTranslation } from '@/contexts/locale-context';
import { useVocabulary } from '@/contexts/vocabulary-context';
import { detectWordLang } from '@/utils/detect-word-lang';
import { fetchCardSuggestion, instantCardFields } from '@/utils/card-suggestion';
import { isAbortError } from '@/utils/abort-error';
import {
  BUILTIN_FOLDER_EN,
  BUILTIN_FOLDER_ZH,
  buildFolderViews,
  resolveFolderMeta,
} from '@/utils/vocab-folders';

type WordAddSheetContextValue = {
  openWord: (word: string) => void;
  registerHost: () => () => void;
  hostCount: number;
  visible: boolean;
  savedToastVisible: boolean;
  sheetWord: string | null;
  folderId: string;
  sheetDuplicate: boolean;
  adding: boolean;
  sheetErr: string | null;
  prefetching: boolean;
  prefetchedTr: string | null;
  prefetchedPy: string | null;
  closeSheet: (after?: () => void) => void;
  confirmAdd: () => void;
  setFolderId: (id: string) => void;
};

const WordAddSheetContext = createContext<WordAddSheetContextValue | null>(null);

export function useWordAddSheet() {
  const ctx = useContext(WordAddSheetContext);
  if (!ctx) throw new Error('WordAddSheetProvider missing');
  return { openWord: ctx.openWord };
}

function useSheetContext() {
  const ctx = useContext(WordAddSheetContext);
  if (!ctx) throw new Error('WordAddSheetProvider missing');
  return ctx;
}

function folderForWord(word: string): string {
  return detectWordLang(word) === 'zh' ? BUILTIN_FOLDER_ZH : BUILTIN_FOLDER_EN;
}

function WordAddSheetPanel() {
  const {
    visible,
    sheetWord,
    folderId,
    sheetDuplicate,
    adding,
    sheetErr,
    prefetching,
    prefetchedTr,
    prefetchedPy,
    closeSheet,
    confirmAdd,
    setFolderId,
  } = useSheetContext();
  const { t } = useTranslation();
  const { customFolders, entries } = useVocabulary();

  const folders = useMemo(
    () => buildFolderViews(customFolders, entries, t('vocabulary.fallbackTranslation'), t),
    [customFolders, entries, t],
  );

  if (!visible || !sheetWord) return null;

  return (
    <View style={styles.barWrap}>
      <View style={styles.bar}>
        <View style={styles.barTop}>
          <View style={styles.barCopy}>
            <Text style={styles.barWord} numberOfLines={2}>
              {sheetWord}
            </Text>
            {prefetching && !prefetchedTr ? (
              <View style={styles.prefetchRow}>
                <ActivityIndicator color="rgba(26,26,26,0.45)" size="small" />
                <Text style={styles.prefetchText}>{t('vocabulary.fetchingTranslation')}</Text>
              </View>
            ) : (
              <>
                {prefetchedPy ? <Text style={styles.pinyin}>{prefetchedPy}</Text> : null}
                {prefetchedTr ? (
                  <Text style={styles.translation} numberOfLines={3}>
                    {prefetchedTr}
                  </Text>
                ) : (
                  <Text style={styles.translationMuted}>{t('vocabulary.translationPending')}</Text>
                )}
              </>
            )}
          </View>
          <Pressable
            onPress={() => closeSheet()}
            hitSlop={10}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}>
            <Ionicons name="close" size={18} color={GAME_THEME.color.ink} />
          </Pressable>
        </View>

        {sheetErr ? <Text style={styles.sheetErr}>{sheetErr}</Text> : null}

        {sheetDuplicate ? (
          <View style={styles.dupBadge}>
            <Ionicons name="bookmark" size={13} color={GAME_THEME.color.ink} />
            <Text style={styles.dupText}>{t('vocabulary.alreadyInFolder')}</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.folderRow}
            keyboardShouldPersistTaps="handled">
            {folders.map((folder) => {
              const on = folder.id === folderId;
              return (
                <Pressable
                  key={folder.id}
                  onPress={() => setFolderId(folder.id)}
                  style={({ pressed }) => [
                    styles.folderChip,
                    on && styles.folderChipOn,
                    pressed && styles.folderChipPressed,
                  ]}>
                  <View style={[styles.folderDot, { backgroundColor: folder.color }]} />
                  <Text style={[styles.folderChipText, on && styles.folderChipTextOn]} numberOfLines={1}>
                    {folder.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <PremiumButton
          variant="primary"
          onPress={sheetDuplicate ? () => closeSheet() : () => confirmAdd()}
          disabled={adding}
          label={
            adding
              ? undefined
              : sheetDuplicate
                ? t('vocabulary.studyClose')
                : t('vocabulary.addShort')
          }
          style={styles.addBtn}>
          {adding ? <ActivityIndicator color="#000000" size="small" /> : null}
        </PremiumButton>
      </View>
    </View>
  );
}

function WordAddToast() {
  const { savedToastVisible } = useSheetContext();
  const { t } = useTranslation();
  if (!savedToastVisible) return null;
  return (
    <View style={styles.toastSlot} pointerEvents="none">
      <View style={styles.toastPill} accessibilityLabel={t('vocabulary.savedWord')}>
        <View style={styles.toastIcon}>
          <Ionicons name="checkmark" size={16} color="#000000" />
        </View>
        <Text style={styles.toastText}>{t('vocabulary.savedWord')}</Text>
      </View>
    </View>
  );
}

/**
 * Плашка внутри чата (не второй Modal — на iOS он всплывает только после закрытия урока).
 */
export function WordAddSheetHost() {
  const { registerHost, visible, savedToastVisible, closeSheet } = useSheetContext();
  const closeSheetRef = useRef(closeSheet);
  closeSheetRef.current = closeSheet;

  useEffect(() => {
    const unregister = registerHost();
    return () => {
      closeSheetRef.current();
      unregister();
    };
  }, [registerHost]);

  if (!visible && !savedToastVisible) return null;

  return (
    <View>
      <WordAddSheetPanel />
      <WordAddToast />
    </View>
  );
}

export function WordAddSheetProvider({ children }: { children: ReactNode }) {
  const { t, locale } = useTranslation();
  const { addWord, hasWord, entries, customFolders, addCardToFolder, hasCardInFolder } = useVocabulary();

  const [hostCount, setHostCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [sheetWord, setSheetWord] = useState<string | null>(null);
  const [folderId, setFolderId] = useState(BUILTIN_FOLDER_EN);
  const [sheetDuplicate, setSheetDuplicate] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sheetErr, setSheetErr] = useState<string | null>(null);
  const [prefetching, setPrefetching] = useState(false);
  const [prefetchedTr, setPrefetchedTr] = useState<string | null>(null);
  const [prefetchedPy, setPrefetchedPy] = useState<string | null>(null);
  const [savedToastVisible, setSavedToastVisible] = useState(false);
  const addCancelled = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetWordRef = useRef<string | null>(null);
  const visibleRef = useRef(false);

  const registerHost = useCallback(() => {
    setHostCount((c) => c + 1);
    return () => setHostCount((c) => Math.max(0, c - 1));
  }, []);

  const resetSheetState = useCallback(() => {
    sheetWordRef.current = null;
    visibleRef.current = false;
    setSheetWord(null);
    setSheetDuplicate(false);
    setSheetErr(null);
    setAdding(false);
    setPrefetching(false);
    setPrefetchedTr(null);
    setPrefetchedPy(null);
    setVisible(false);
  }, []);

  const closeSheet = useCallback(
    (after?: () => void) => {
      addCancelled.current = true;
      setVisible(false);
      resetSheetState();
      after?.();
    },
    [resetSheetState],
  );

  const isDuplicate = useCallback(
    (word: string, id: string) => {
      const meta = resolveFolderMeta(id, customFolders);
      if (meta.isBuiltin) return hasWord(word);
      return hasCardInFolder(id, word);
    },
    [customFolders, hasCardInFolder, hasWord],
  );

  const openWord = useCallback(
    (raw: string) => {
      const w = raw.trim();
      if (!w) return;
      const prev = sheetWordRef.current;
      const wasOpen = visibleRef.current;
      if (w === prev && wasOpen) return;

      addCancelled.current = false;
      setSheetErr(null);

      const nextFolder =
        wasOpen && prev && detectWordLang(w) === detectWordLang(prev) ? folderId : folderForWord(w);
      setFolderId(nextFolder);

      const dup = isDuplicate(w, nextFolder);
      setSheetDuplicate(dup);
      setPrefetching(!dup);
      if (w !== prev) {
        setPrefetchedTr(null);
        setPrefetchedPy(null);
      }
      sheetWordRef.current = w;
      visibleRef.current = true;
      setSheetWord(w);
      setVisible(true);
    },
    [folderId, isDuplicate],
  );

  useEffect(() => {
    if (!sheetWord) return;
    setSheetDuplicate(isDuplicate(sheetWord, folderId));
  }, [folderId, isDuplicate, sheetWord]);

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

  const confirmAdd = useCallback(async () => {
    if (!sheetWord) return;
    const w = sheetWord.trim();
    if (!w || isDuplicate(w, folderId)) return;
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
      const meta = resolveFolderMeta(folderId, customFolders);
      const ok = meta.isBuiltin
        ? addWord(w, { translation: tr, pinyin: py ?? undefined, lang })
        : addCardToFolder(folderId, {
            front: w,
            back: tr,
            pinyin: py ?? undefined,
          });
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
  }, [
    addCardToFolder,
    addWord,
    closeSheet,
    customFolders,
    entries,
    folderId,
    isDuplicate,
    locale,
    prefetchedPy,
    prefetchedTr,
    sheetWord,
    t,
  ]);

  const value = useMemo<WordAddSheetContextValue>(
    () => ({
      openWord,
      registerHost,
      hostCount,
      visible,
      savedToastVisible,
      sheetWord,
      folderId,
      sheetDuplicate,
      adding,
      sheetErr,
      prefetching,
      prefetchedTr,
      prefetchedPy,
      closeSheet,
      confirmAdd: () => {
        void confirmAdd();
      },
      setFolderId,
    }),
    [
      adding,
      closeSheet,
      confirmAdd,
      folderId,
      hostCount,
      openWord,
      prefetching,
      prefetchedPy,
      prefetchedTr,
      registerHost,
      savedToastVisible,
      sheetDuplicate,
      sheetErr,
      sheetWord,
      visible,
    ],
  );

  const insets = useSafeAreaInsets();
  const useRootOverlay = hostCount === 0;

  return (
    <WordAddSheetContext.Provider value={value}>
      <View style={styles.providerRoot}>
        {children}
        {useRootOverlay && (visible || savedToastVisible) ? (
          <View
            style={[styles.rootOverlay, { paddingBottom: Math.max(insets.bottom, 10) }]}
            pointerEvents="box-none">
            <WordAddSheetPanel />
            <WordAddToast />
          </View>
        ) : null}
      </View>
    </WordAddSheetContext.Provider>
  );
}

const styles = StyleSheet.create({
  providerRoot: {
    flex: 1,
  },
  rootOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
    elevation: 1000,
  },
  barWrap: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  bar: {
    borderRadius: 10,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  barTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  barCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  barWord: {
    fontSize: 20,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.paperWarm,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
  prefetchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  prefetchText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.45)',
  },
  pinyin: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: 'rgba(26,26,26,0.55)',
    marginTop: 2,
  },
  translation: {
    fontSize: GAME_THEME.type.body,
    fontWeight: '700',
    lineHeight: 20,
    color: GAME_THEME.color.ink,
    marginTop: 2,
  },
  translationMuted: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.45)',
    marginTop: 2,
  },
  sheetErr: {
    fontSize: 12,
    fontWeight: '700',
    color: GAME_THEME.color.danger,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: GAME_THEME.radius.pill,
    backgroundColor: GAME_THEME.color.paperWarm,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    maxWidth: 180,
  },
  folderChipOn: {
    backgroundColor: GAME_THEME.color.ink,
  },
  folderChipPressed: {
    opacity: 0.8,
  },
  folderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  folderChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  folderChipTextOn: {
    color: '#FFFFFF',
  },
  dupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: GAME_THEME.radius.pill,
    backgroundColor: GAME_THEME.color.paperWarm,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  dupText: {
    fontSize: 12,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
  },
  addBtn: {
    alignSelf: 'stretch',
  },
  toastSlot: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: GAME_THEME.radius.pill,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
  },
  toastIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GAME_THEME.color.ok,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    fontSize: GAME_THEME.type.body,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
});
