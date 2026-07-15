import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { FlatList, Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VocabStudyModal } from '@/components/vocabulary/vocab-study-modal';
import { PremiumScreenShell, ScreenHeader } from '@/components/ui';
import { APP_THEME } from '@/constants/theme';
import { useCardSuggestion } from '@/hooks/use-card-suggestion';
import type { VocabFolderView } from '@/utils/vocab-folders';
import {
  buildFolderViews,
  langPairIdFromBuiltinFolderId,
  resolveFolderCards,
  resolveFolderMeta,
} from '@/utils/vocab-folders';
import { useTranslation } from '@/contexts/locale-context';
import { useVocabulary } from '@/contexts/vocabulary-context';
import { detectWordLang } from '@/utils/detect-word-lang';
import { shareVocabPack } from '@/utils/vocab-share';

const TAB_BAR_CORE = APP_THEME.tabBar.core;
const ROW_INSET = 16;
const AVATAR = 52;
const SEPARATOR_INSET = ROW_INSET + AVATAR + 12;
const SWIPE_BTN_WIDTH = 72;
const SEND_BTN_ACTIVE = '#F4F4F5';
const SEND_ICON_ACTIVE = '#09090B';

export default function VocabularyScreen() {
  const { t, locale } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    entries,
    customFolders,
    vocabularyHydrated,
    addWord,
    removeWord,
    hasWord,
    createFolder,
    renameFolder,
    deleteFolder,
    addCardToFolder,
    hasCardInFolder,
  } = useVocabulary();

  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [renameTarget, setRenameTarget] = useState<VocabFolderView | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addWordDraft, setAddWordDraft] = useState('');
  const [sharingFolderId, setSharingFolderId] = useState<string | null>(null);
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const listPadBottom = TAB_BAR_CORE + insets.bottom + 16;

  const folders = useMemo(
    () => buildFolderViews(customFolders, entries, t('vocabulary.fallbackTranslation'), t),
    [customFolders, entries, t],
  );

  const openFolder = folders.find((f) => f.id === openFolderId) ?? null;
  const openMeta = openFolderId ? resolveFolderMeta(openFolderId, customFolders) : null;
  const openLangPairId = openFolderId ? langPairIdFromBuiltinFolderId(openFolderId) : null;

  const openCards = useMemo(() => {
    if (!openFolderId) return [];
    return resolveFolderCards(openFolderId, customFolders, entries, t('vocabulary.fallbackTranslation'));
  }, [openFolderId, customFolders, entries, t]);

  const studyActive = openFolderId !== null && openCards.length > 0;

  const addFolderCards = useMemo(() => {
    if (!openFolderId || openMeta?.isBuiltin) return [];
    const folder = customFolders.find((f) => f.id === openFolderId);
    return (
      folder?.cards.map((c) => ({
        front: c.front,
        back: c.back,
        pinyin: c.pinyin,
      })) ?? []
    );
  }, [customFolders, openFolderId, openMeta?.isBuiltin]);

  const {
    translation: addTranslationDraft,
    setTranslation: setAddTranslationDraft,
    pinyin: addPinyinDraft,
    setPinyin: setAddPinyinDraft,
    loading: addLoading,
    error: addSuggestErr,
    reset: resetAddSuggestion,
  } = useCardSuggestion({
    word: addWordDraft,
    enabled: addOpen,
    locale,
    entries,
    folderCards: addFolderCards,
  });

  const addErr =
    addSuggestErr === 'translate'
      ? t('vocabulary.translateError')
      : addSuggestErr === 'generic'
        ? t('common.errorGeneric')
        : null;

  const translateSourceForDraft = useCallback((): 'en' | 'zh' | 'ru' => {
    if (openLangPairId === 'zh-ru') return 'zh';
    const w = addWordDraft.trim();
    if (!w) return 'en';
    const d = detectWordLang(w);
    if (d === 'zh') return 'zh';
    if (d === 'ru') return 'ru';
    return 'en';
  }, [addWordDraft, openLangPairId]);

  const openCreateFolder = useCallback(() => {
    setCreateName('');
    setCreateOpen(true);
    void Haptics.selectionAsync();
  }, []);

  const closeCreateFolder = useCallback(() => {
    setCreateOpen(false);
    setCreateName('');
  }, []);

  const submitCreateFolder = useCallback(() => {
    const id = createFolder(createName);
    if (!id) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeCreateFolder();
    setOpenFolderId(id);
  }, [closeCreateFolder, createFolder, createName]);

  const openAddCard = useCallback(() => {
    resetAddSuggestion();
    setAddWordDraft('');
    setAddOpen(true);
    void Haptics.selectionAsync();
  }, [resetAddSuggestion]);

  const closeAdd = useCallback(() => {
    setAddOpen(false);
    resetAddSuggestion();
    setAddWordDraft('');
  }, [resetAddSuggestion]);

  const wordExists = useCallback(() => {
    const w = addWordDraft.trim();
    if (!w) return false;
    if (openMeta?.isBuiltin) return hasWord(w);
    if (openFolderId) return hasCardInFolder(openFolderId, w);
    return false;
  }, [addWordDraft, hasCardInFolder, hasWord, openFolderId, openMeta?.isBuiltin]);

  const canAdd = addWordDraft.trim().length > 0 && addTranslationDraft.trim().length > 0 && !addLoading && !wordExists();

  const submitAddCard = useCallback(() => {
    const w = addWordDraft.trim();
    const tr = addTranslationDraft.trim();
    const py = addPinyinDraft.trim();
    if (!w || !tr || !openFolderId) return;
    if (wordExists()) return;

    const src = translateSourceForDraft();
    let ok = false;

    if (openMeta?.isBuiltin) {
      ok = addWord(w, {
        translation: tr,
        pinyin: src === 'zh' ? py || undefined : undefined,
        lang: detectWordLang(w),
      });
    } else {
      ok = addCardToFolder(openFolderId, {
        front: w,
        back: tr,
        pinyin: src === 'zh' ? py || undefined : undefined,
      });
    }

    if (ok) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeAdd();
  }, [
    addCardToFolder,
    addPinyinDraft,
    addTranslationDraft,
    addWord,
    addWordDraft,
    closeAdd,
    openFolderId,
    openMeta?.isBuiltin,
    translateSourceForDraft,
    wordExists,
  ]);

  const confirmDeleteFolder = useCallback(
    (folder: VocabFolderView) => {
      Alert.alert(t('vocabulary.deleteFolderTitle'), t('vocabulary.deleteFolderMessage', { name: folder.name }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteFolder(folder.id);
            if (openFolderId === folder.id) setOpenFolderId(null);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]);
    },
    [deleteFolder, openFolderId, t],
  );

  const shareFolder = useCallback(
    async (folder: VocabFolderView) => {
      if (sharingFolderId) return;
      const cards = resolveFolderCards(
        folder.id,
        customFolders,
        entries,
        t('vocabulary.fallbackTranslation'),
      );
      if (cards.length === 0) {
        Alert.alert(t('vocabulary.shareEmptyTitle'), t('vocabulary.shareEmptyMessage'));
        return;
      }

      setSharingFolderId(folder.id);
      try {
        await shareVocabPack({
          name: folder.name,
          cards: cards.map((c) => ({
            front: c.front,
            back: c.back,
            pinyin: c.pinyin,
          })),
          lines: {
            lead: t('vocabulary.shareLead'),
            cards: t('vocabulary.shareCardsLine'),
            cta: t('vocabulary.shareCta'),
          },
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        const msg =
          e instanceof Error && e.message === 'EXPO_PUBLIC_COMPANION_CHAT_API_URL'
            ? t('auth.errorServer')
            : e instanceof Error
              ? e.message
              : t('vocabulary.shareError');
        Alert.alert(t('vocabulary.shareErrorTitle'), msg);
      } finally {
        setSharingFolderId(null);
      }
    },
    [customFolders, entries, sharingFolderId, t],
  );

  const renderFolderRightActions = useCallback(
    (folder: VocabFolderView) => {
      const startAddCard = () => {
        setOpenFolderId(folder.id);
        openAddCard();
        swipeRefs.current.get(folder.id)?.close();
      };

      const startRename = () => {
        setRenameTarget(folder);
        setRenameDraft(folder.name);
        swipeRefs.current.get(folder.id)?.close();
      };

      if (folder.isBuiltin) {
        return (
          <View style={styles.swipeActions}>
            <TouchableOpacity
              style={[styles.swipeBtn, styles.swipeAdd]}
              activeOpacity={0.8}
              onPress={startAddCard}
              accessibilityLabel={t('vocabulary.addWord')}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={styles.swipeActions}>
          <TouchableOpacity
            style={[styles.swipeBtn, styles.swipeAdd]}
            activeOpacity={0.8}
            onPress={startAddCard}
            accessibilityLabel={t('vocabulary.addWord')}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeBtn, styles.swipeRename]}
            activeOpacity={0.8}
            onPress={startRename}
            accessibilityLabel={t('common.rename')}>
            <Ionicons name="pencil-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeBtn, styles.swipeDel]}
            activeOpacity={0.8}
            onPress={() => confirmDeleteFolder(folder)}
            accessibilityLabel={t('common.delete')}>
            <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      );
    },
    [confirmDeleteFolder, openAddCard, t],
  );

  const renderFolderRow = useCallback(
    ({ item: folder, index }: ListRenderItemInfo<VocabFolderView>) => {
      const isLast = index === folders.length - 1;
      return (
        <Swipeable
          ref={(el) => {
            if (el) swipeRefs.current.set(folder.id, el);
            else swipeRefs.current.delete(folder.id);
          }}
          overshootRight={false}
          friction={2}
          rightThreshold={40}
          activeOffsetX={[-12, 12]}
          failOffsetY={[-8, 8]}
          renderRightActions={() => renderFolderRightActions(folder)}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setOpenFolderId(folder.id);
              if (folder.cardCount === 0) {
                openAddCard();
              }
            }}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={[styles.folderIcon, { backgroundColor: folder.color }]}>
              <Ionicons
                name={folder.isBuiltin ? 'language' : 'folder'}
                size={22}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.rowMain}>
              <View style={styles.rowTop}>
                <Text style={styles.folderName} numberOfLines={1}>
                  {folder.name}
                </Text>
                <Text style={styles.cardCount}>{folder.cardCount}</Text>
              </View>
              <Text style={styles.folderSub} numberOfLines={1}>
                {folder.subtitle}
              </Text>
            </View>
            {folder.cardCount > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}
                hitSlop={8}
                disabled={sharingFolderId === folder.id}
                onPress={() => void shareFolder(folder)}
                accessibilityRole="button"
                accessibilityLabel={t('vocabulary.shareFolder')}>
                {sharingFolderId === folder.id ? (
                  <ActivityIndicator size="small" color={APP_THEME.color.mutedSoft} />
                ) : (
                  <Ionicons name="share-outline" size={20} color={APP_THEME.color.mutedSoft} />
                )}
              </Pressable>
            ) : null}
            {!isLast ? <View style={styles.separator} /> : null}
          </Pressable>
        </Swipeable>
      );
    },
    [folders.length, openAddCard, renderFolderRightActions, shareFolder, sharingFolderId, t],
  );

  const frontLabel =
    openMeta?.langPair?.frontLang ?? openFolder?.name ?? t('vocabulary.myWords');
  const backLabel = openMeta?.langPair?.backLang ?? t('vocabulary.translation');

  return (
    <PremiumScreenShell topOffset={8} style={styles.root}>
      <ScreenHeader
        title={t('vocabulary.title')}
        subtitle={t('vocabulary.lead')}
        trailing={
          <Pressable
            onPress={openCreateFolder}
            hitSlop={10}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('vocabulary.newFolder')}>
            <Ionicons name="folder-outline" size={24} color={APP_THEME.color.link} />
          </Pressable>
        }
      />

      {!vocabularyHydrated ? (
        <View style={styles.hydrate}>
          <ActivityIndicator color={APP_THEME.color.text} size="large" />
        </View>
      ) : (
        <FlatList
          data={folders}
          keyExtractor={(f) => f.id}
          renderItem={renderFolderRow}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: listPadBottom }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <Pressable
              style={({ pressed }) => [styles.newFolderRow, pressed && styles.rowPressed]}
              onPress={openCreateFolder}>
              <View style={styles.newFolderIcon}>
                <Ionicons name="add" size={22} color={APP_THEME.color.link} />
              </View>
              <Text style={styles.newFolderText}>{t('vocabulary.newFolder')}</Text>
            </Pressable>
          }
        />
      )}

      {studyActive ? (
        <VocabStudyModal
          folderName={openFolder?.name ?? ''}
          cards={openCards}
          frontLabel={frontLabel}
          backLabel={backLabel}
          onClose={() => setOpenFolderId(null)}
        />
      ) : null}

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={closeCreateFolder}>
        <Pressable style={styles.modalDim} onPress={closeCreateFolder}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('vocabulary.newFolder')}</Text>
            <TextInput
              value={createName}
              onChangeText={setCreateName}
              placeholder={t('vocabulary.folderNamePlaceholder')}
              placeholderTextColor={APP_THEME.color.mutedFaint}
              style={styles.modalInput}
              autoFocus
              maxLength={48}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalGhost} onPress={closeCreateFolder}>
                <Text style={styles.modalGhostText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimary, !createName.trim() && styles.modalPrimaryDisabled]}
                onPress={submitCreateFolder}
                disabled={!createName.trim()}>
                <Text style={styles.modalPrimaryText}>{t('vocabulary.createFolder')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={closeAdd}>
        <Pressable style={styles.modalDim} onPress={closeAdd}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('vocabulary.addTitle')}</Text>
            <Text style={styles.modalSub}>
              {openFolder?.name ?? t('vocabulary.cards')}
            </Text>

            <TextInput
              value={addWordDraft}
              onChangeText={setAddWordDraft}
              placeholder={
                openLangPairId === 'zh-ru'
                  ? t('vocabulary.placeholderZh')
                  : t('vocabulary.placeholderOther')
              }
              placeholderTextColor={APP_THEME.color.mutedFaint}
              style={styles.modalInput}
              autoCorrect={false}
              autoCapitalize="none"
            />

            <View style={styles.addRow}>
              <Text style={styles.addLabel}>{t('vocabulary.translation')}</Text>
              {addLoading ? <ActivityIndicator size="small" color={APP_THEME.color.mutedSoft} /> : null}
            </View>
            <TextInput
              value={addTranslationDraft}
              onChangeText={setAddTranslationDraft}
              placeholder={t('vocabulary.autoTranslation')}
              placeholderTextColor={APP_THEME.color.mutedFaint}
              style={styles.modalInput}
            />

            {openLangPairId === 'zh-ru' ||
            (addWordDraft.trim().length > 0 && translateSourceForDraft() === 'zh') ? (
              <>
                <Text style={styles.addLabelBelow}>{t('vocabulary.pinyin')}</Text>
                <TextInput
                  value={addPinyinDraft}
                  onChangeText={setAddPinyinDraft}
                  placeholder={t('vocabulary.autoTranslation')}
                  placeholderTextColor={APP_THEME.color.mutedFaint}
                  style={styles.modalInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            ) : null}

            {addErr ? <Text style={styles.addErr}>{addErr}</Text> : null}
            {wordExists() ? <Text style={styles.addErr}>{t('vocabulary.wordExists')}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalGhost} onPress={closeAdd}>
                <Text style={styles.modalGhostText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimary, !canAdd && styles.modalPrimaryDisabled]}
                onPress={submitAddCard}
                disabled={!canAdd}>
                <Text style={styles.modalPrimaryText}>{t('vocabulary.addShort')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={renameTarget !== null} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <Pressable style={styles.modalDim} onPress={() => setRenameTarget(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('vocabulary.renameFolder')}</Text>
            <TextInput
              value={renameDraft}
              onChangeText={setRenameDraft}
              placeholder={t('vocabulary.folderNamePlaceholder')}
              placeholderTextColor={APP_THEME.color.mutedFaint}
              style={styles.modalInput}
              autoFocus
              maxLength={48}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalGhost} onPress={() => setRenameTarget(null)}>
                <Text style={styles.modalGhostText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimary, !renameDraft.trim() && styles.modalPrimaryDisabled]}
                onPress={() => {
                  if (!renameTarget || !renameDraft.trim()) return;
                  renameFolder(renameTarget.id, renameDraft.trim());
                  setRenameTarget(null);
                }}
                disabled={!renameDraft.trim()}>
                <Text style={styles.modalPrimaryText}>{t('teacher.renameSave')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </PremiumScreenShell>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: APP_THEME.color.bg,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  headerBtnPressed: {
    opacity: 0.55,
  },
  hydrate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: ROW_INSET,
    gap: 12,
    position: 'relative',
    minWidth: 0,
    backgroundColor: APP_THEME.color.bg,
  },
  rowPressed: {
    backgroundColor: APP_THEME.color.elevated,
  },
  separator: {
    position: 'absolute',
    left: SEPARATOR_INSET,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: APP_THEME.color.separator,
  },
  folderIcon: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  folderName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.35,
    color: APP_THEME.color.text,
  },
  cardCount: {
    fontSize: 15,
    color: APP_THEME.color.mutedSoft,
  },
  folderSub: {
    marginTop: 3,
    fontSize: 15,
    color: APP_THEME.color.muted,
    letterSpacing: -0.15,
  },
  shareBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shareBtnPressed: {
    opacity: 0.55,
  },
  swipeActions: {
    flexDirection: 'row',
  },
  swipeBtn: {
    width: SWIPE_BTN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeAdd: {
    backgroundColor: APP_THEME.color.link,
  },
  swipeRename: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  swipeDel: {
    backgroundColor: APP_THEME.color.danger,
  },
  newFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: ROW_INSET,
    marginTop: 8,
  },
  newFolderIcon: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.elevated,
  },
  newFolderText: {
    fontSize: 17,
    fontWeight: '600',
    color: APP_THEME.color.link,
    letterSpacing: -0.3,
  },
  modalDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  modalCard: {
    borderRadius: APP_THEME.radius.sheet,
    paddingVertical: 22,
    paddingHorizontal: 22,
    backgroundColor: APP_THEME.color.elevated,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.38,
    color: APP_THEME.color.text,
  },
  modalSub: {
    marginTop: 4,
    ...APP_THEME.type.caption,
    color: APP_THEME.color.muted,
  },
  modalInput: {
    marginTop: 14,
    borderRadius: APP_THEME.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 17,
    color: APP_THEME.color.text,
    backgroundColor: APP_THEME.color.bg,
  },
  modalActions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalGhost: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: APP_THEME.radius.pill,
  },
  modalGhostText: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_THEME.color.muted,
  },
  modalPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: SEND_BTN_ACTIVE,
  },
  modalPrimaryDisabled: {
    opacity: 0.5,
  },
  modalPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: SEND_ICON_ACTIVE,
  },
  addRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addLabel: {
    ...APP_THEME.type.label,
    color: APP_THEME.color.mutedSoft,
  },
  addLabelBelow: {
    marginTop: 14,
    ...APP_THEME.type.label,
    color: APP_THEME.color.mutedSoft,
  },
  addErr: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: APP_THEME.color.danger,
    fontWeight: '600',
  },
});
