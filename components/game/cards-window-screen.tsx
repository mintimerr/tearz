import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/utils/safe-haptics';
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

import { GameGoldButton } from '@/components/game/game-gold-button';
import { GameListRow } from '@/components/game/game-list-row';
import { GameWindowShell } from '@/components/game/game-window-shell';
import { SpotlightAnchor } from '@/components/onboarding/tearz-spotlight';
import { VocabStudyModal } from '@/components/vocabulary/vocab-study-modal';
import { GAME_THEME } from '@/constants/game-theme';
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

const SWIPE_BTN_WIDTH = 72;

export function CardsWindowScreen() {
  const { t, locale } = useTranslation();
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
  const [addFolderId, setAddFolderId] = useState<string | null>(null);
  const [addWordDraft, setAddWordDraft] = useState('');
  const [sharingFolderId, setSharingFolderId] = useState<string | null>(null);
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const folders = useMemo(
    () => buildFolderViews(customFolders, entries, t('vocabulary.fallbackTranslation'), t),
    [customFolders, entries, t],
  );

  const openFolder = folders.find((f) => f.id === openFolderId) ?? null;
  const openMeta = openFolderId ? resolveFolderMeta(openFolderId, customFolders) : null;
  const addFolder = folders.find((f) => f.id === addFolderId) ?? null;
  const addMeta = addFolderId ? resolveFolderMeta(addFolderId, customFolders) : null;
  const addLangPairId = addFolderId ? langPairIdFromBuiltinFolderId(addFolderId) : null;

  const openCards = useMemo(() => {
    if (!openFolderId) return [];
    return resolveFolderCards(openFolderId, customFolders, entries, t('vocabulary.fallbackTranslation'));
  }, [openFolderId, customFolders, entries, t]);

  const studyActive = openFolderId !== null && openCards.length > 0;

  const addFolderCards = useMemo(() => {
    if (!addFolderId || addMeta?.isBuiltin) return [];
    const folder = customFolders.find((f) => f.id === addFolderId);
    return (
      folder?.cards.map((c) => ({
        front: c.front,
        back: c.back,
        pinyin: c.pinyin,
      })) ?? []
    );
  }, [addFolderId, addMeta?.isBuiltin, customFolders]);

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
    if (addLangPairId === 'zh-ru') return 'zh';
    const w = addWordDraft.trim();
    if (!w) return 'en';
    const d = detectWordLang(w);
    if (d === 'zh') return 'zh';
    if (d === 'ru') return 'ru';
    return 'en';
  }, [addLangPairId, addWordDraft]);

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

  const openAddCard = useCallback(
    (folderId?: string) => {
      const id = folderId ?? openFolderId;
      if (!id) return;
      setAddFolderId(id);
      resetAddSuggestion();
      setAddWordDraft('');
      setAddOpen(true);
      void Haptics.selectionAsync();
    },
    [openFolderId, resetAddSuggestion],
  );

  const closeAdd = useCallback(() => {
    setAddOpen(false);
    setAddFolderId(null);
    resetAddSuggestion();
    setAddWordDraft('');
  }, [resetAddSuggestion]);

  const wordExists = useCallback(() => {
    const w = addWordDraft.trim();
    if (!w) return false;
    if (addMeta?.isBuiltin) return hasWord(w);
    if (addFolderId) return hasCardInFolder(addFolderId, w);
    return false;
  }, [addFolderId, addMeta?.isBuiltin, addWordDraft, hasCardInFolder, hasWord]);

  const canAdd = addWordDraft.trim().length > 0 && addTranslationDraft.trim().length > 0 && !addLoading && !wordExists();

  const submitAddCard = useCallback(() => {
    const w = addWordDraft.trim();
    const tr = addTranslationDraft.trim();
    const py = addPinyinDraft.trim();
    if (!w || !tr || !addFolderId) return;
    if (wordExists()) return;

    const src = translateSourceForDraft();
    let ok = false;

    if (addMeta?.isBuiltin) {
      ok = addWord(w, {
        translation: tr,
        pinyin: src === 'zh' ? py || undefined : undefined,
        lang: detectWordLang(w),
      });
    } else {
      ok = addCardToFolder(addFolderId, {
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
    addFolderId,
    addMeta?.isBuiltin,
    closeAdd,
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
      // Системные EN/中文 — без свайпа: «+» уже на плашке, удалять нельзя.
      if (folder.isBuiltin) return null;

      const startRename = () => {
        setRenameTarget(folder);
        setRenameDraft(folder.name);
        swipeRefs.current.get(folder.id)?.close();
      };

      return (
        <View style={styles.swipeActions}>
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
    [confirmDeleteFolder, t],
  );

  const renderFolderRow = useCallback(
    ({ item: folder }: ListRenderItemInfo<VocabFolderView>) => {
      return (
        <Swipeable
          ref={(el) => {
            if (el) swipeRefs.current.set(folder.id, el);
            else swipeRefs.current.delete(folder.id);
          }}
          enabled={!folder.isBuiltin}
          overshootRight={false}
          friction={2}
          rightThreshold={40}
          activeOffsetX={[-12, 12]}
          failOffsetY={[-8, 8]}
          renderRightActions={
            folder.isBuiltin ? undefined : () => renderFolderRightActions(folder)
          }>
          <GameListRow
            title={folder.name}
            subtitle={folder.subtitle}
            leading={
              <View style={[styles.folderIconLeading, { backgroundColor: folder.color }]}>
                <Ionicons
                  name={folder.isBuiltin ? 'language' : 'folder'}
                  size={20}
                  color="#FFFFFF"
                />
              </View>
            }
            trailing={
              <View style={styles.folderTrailing}>
                <Text style={styles.cardCount}>{folder.cardCount}</Text>
                <Pressable
                  style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}
                  hitSlop={8}
                  onPress={() => {
                    openAddCard(folder.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('vocabulary.addWord')}>
                  <Ionicons name="add" size={20} color={GAME_THEME.color.ink} />
                </Pressable>
                {folder.cardCount > 0 ? (
                  <Pressable
                    style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}
                    hitSlop={8}
                    disabled={sharingFolderId === folder.id}
                    onPress={() => void shareFolder(folder)}
                    accessibilityRole="button"
                    accessibilityLabel={t('vocabulary.shareFolder')}>
                    {sharingFolderId === folder.id ? (
                      <ActivityIndicator size="small" color={GAME_THEME.color.ink} />
                    ) : (
                      <Ionicons name="share-outline" size={18} color={GAME_THEME.color.ink} />
                    )}
                  </Pressable>
                ) : null}
              </View>
            }
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (folder.cardCount === 0) {
                openAddCard(folder.id);
                return;
              }
              setOpenFolderId(folder.id);
            }}
          />
        </Swipeable>
      );
    },
    [openAddCard, renderFolderRightActions, shareFolder, sharingFolderId, t],
  );

  const frontLabel =
    openMeta?.langPair?.frontLang ?? openFolder?.name ?? t('vocabulary.myWords');
  const backLabel = openMeta?.langPair?.backLang ?? t('vocabulary.translation');

  const addCardSheet = (
    <Pressable style={styles.modalDim} onPress={closeAdd}>
      <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
        <Text style={styles.modalTitle}>{t('vocabulary.addTitle')}</Text>
        <Text style={styles.modalSub}>{addFolder?.name ?? t('vocabulary.cards')}</Text>

        <TextInput
          value={addWordDraft}
          onChangeText={setAddWordDraft}
          placeholder={
            addLangPairId === 'zh-ru' ? t('vocabulary.placeholderZh') : t('vocabulary.placeholderOther')
          }
          placeholderTextColor="rgba(26,26,26,0.35)"
          style={styles.modalInput}
          autoCorrect={false}
          autoCapitalize="none"
        />

        <View style={styles.addRow}>
          <Text style={styles.addLabel}>{t('vocabulary.translation')}</Text>
          {addLoading ? <ActivityIndicator size="small" color={GAME_THEME.color.ink} /> : null}
        </View>
        <TextInput
          value={addTranslationDraft}
          onChangeText={setAddTranslationDraft}
          placeholder={t('vocabulary.autoTranslation')}
          placeholderTextColor="rgba(26,26,26,0.35)"
          style={styles.modalInput}
        />

        {addLangPairId === 'zh-ru' ||
        (addWordDraft.trim().length > 0 && translateSourceForDraft() === 'zh') ? (
          <>
            <Text style={styles.addLabelBelow}>{t('vocabulary.pinyin')}</Text>
            <TextInput
              value={addPinyinDraft}
              onChangeText={setAddPinyinDraft}
              placeholder={t('vocabulary.autoTranslation')}
              placeholderTextColor="rgba(26,26,26,0.35)"
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
          <GameGoldButton
            label={t('vocabulary.addShort')}
            onPress={submitAddCard}
            disabled={!canAdd}
            size="sm"
          />
        </View>
      </Pressable>
    </Pressable>
  );

  return (
    <>
      <GameWindowShell
        title={t('vocabulary.title')}
        contentPadding={12}
        right={
          <Pressable
            onPress={openCreateFolder}
            hitSlop={8}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('vocabulary.newFolder')}>
            <Ionicons name="add" size={22} color={GAME_THEME.color.ink} />
          </Pressable>
        }>
        {!vocabularyHydrated ? (
          <View style={styles.hydrate}>
            <ActivityIndicator color={GAME_THEME.color.ink} size="large" />
          </View>
        ) : (
          <View style={styles.listWrap}>
            <FlatList
              data={folders}
              keyExtractor={(f) => f.id}
              renderItem={renderFolderRow}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
            <SpotlightAnchor
              tipId="coachCards2"
              line={t('onboarding.spotCards')}
              style={styles.spotAnchor}>
              <GameGoldButton
                label={t('vocabulary.newFolder')}
                onPress={openCreateFolder}
                size="md"
                style={styles.newFolderBtn}
              />
            </SpotlightAnchor>
          </View>
        )}
      </GameWindowShell>

      {studyActive ? (
        <VocabStudyModal
          folderName={openFolder?.name ?? ''}
          cards={openCards}
          frontLabel={frontLabel}
          backLabel={backLabel}
          onClose={() => setOpenFolderId(null)}
          onAddWord={openAddCard}
          overlay={addOpen ? addCardSheet : null}
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
              placeholderTextColor="rgba(26,26,26,0.35)"
              style={styles.modalInput}
              autoFocus
              maxLength={48}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalGhost} onPress={closeCreateFolder}>
                <Text style={styles.modalGhostText}>{t('common.cancel')}</Text>
              </Pressable>
              <GameGoldButton
                label={t('vocabulary.createFolder')}
                onPress={submitCreateFolder}
                disabled={!createName.trim()}
                size="sm"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={addOpen && !studyActive} transparent animationType="fade" onRequestClose={closeAdd}>
        {addOpen && !studyActive ? addCardSheet : null}
      </Modal>

      <Modal visible={renameTarget !== null} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <Pressable style={styles.modalDim} onPress={() => setRenameTarget(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('vocabulary.renameFolder')}</Text>
            <TextInput
              value={renameDraft}
              onChangeText={setRenameDraft}
              placeholder={t('vocabulary.folderNamePlaceholder')}
              placeholderTextColor="rgba(26,26,26,0.35)"
              style={styles.modalInput}
              autoFocus
              maxLength={48}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalGhost} onPress={() => setRenameTarget(null)}>
                <Text style={styles.modalGhostText}>{t('common.cancel')}</Text>
              </Pressable>
              <GameGoldButton
                label={t('teacher.renameSave')}
                onPress={() => {
                  if (!renameTarget || !renameDraft.trim()) return;
                  renameFolder(renameTarget.id, renameDraft.trim());
                  setRenameTarget(null);
                }}
                disabled={!renameDraft.trim()}
                size="sm"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  headerBtnPressed: {
    opacity: 0.55,
  },
  hydrate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
    flexGrow: 1,
  },
  folderIconLeading: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  folderTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 72,
    justifyContent: 'flex-end',
  },
  cardCount: {
    fontSize: 15,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'right',
    color: 'rgba(26,26,26,0.55)',
  },
  shareBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shareBtnPressed: {
    opacity: 0.55,
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 10,
    overflow: 'hidden',
    borderRadius: 6,
    // Подложка на случай субпиксельной щели между кнопками
    backgroundColor: GAME_THEME.color.danger,
  },
  swipeBtn: {
    width: SWIPE_BTN_WIDTH,
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  swipeRename: {
    backgroundColor: GAME_THEME.color.phosphor,
    borderLeftWidth: 2,
    borderRightWidth: 0,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  swipeDel: {
    backgroundColor: GAME_THEME.color.danger,
    borderLeftWidth: 0,
    borderRightWidth: 2,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  spotAnchor: {
    alignSelf: 'stretch',
    marginTop: 4,
  },
  newFolderBtn: {
    alignSelf: 'stretch',
  },
  modalDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  modalCard: {
    borderRadius: GAME_THEME.radius.panel,
    paddingVertical: 22,
    paddingHorizontal: 22,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
  },
  modalTitle: {
    fontSize: GAME_THEME.type.title,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: GAME_THEME.color.ink,
  },
  modalSub: {
    marginTop: 4,
    fontSize: GAME_THEME.type.body,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
  },
  modalInput: {
    marginTop: 14,
    borderRadius: GAME_THEME.radius.panel,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 17,
    color: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.panelMuted,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
  },
  modalActions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  modalGhost: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: GAME_THEME.radius.pill,
  },
  modalGhostText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.55)',
  },
  addRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addLabel: {
    fontSize: GAME_THEME.type.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.55)',
  },
  addLabelBelow: {
    marginTop: 14,
    fontSize: GAME_THEME.type.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.55)',
  },
  addErr: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: GAME_THEME.color.danger,
    fontWeight: '700',
  },
});
