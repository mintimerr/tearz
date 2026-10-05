import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/utils/safe-haptics';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameBackButton } from '@/components/game/game-back-button';
import { TeacherChatSwipeRow } from '@/components/teacher/teacher-chat-swipe-row';
import { GAME_THEME } from '@/constants/game-theme';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import { useLocale, useTranslation } from '@/contexts/locale-context';
import {
  useTeacherJourney,
  type TeacherRecentLesson,
} from '@/contexts/teacher-journey-context';
import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function configureChatDeleteLayout() {
  LayoutAnimation.configureNext(
    Platform.OS === 'ios'
      ? {
          duration: 340,
          update: { type: LayoutAnimation.Types.spring, springDamping: 0.78 },
          delete: {
            type: LayoutAnimation.Types.spring,
            springDamping: 0.7,
            property: LayoutAnimation.Properties.opacity,
          },
        }
      : {
          duration: 280,
          update: { type: LayoutAnimation.Types.easeInEaseOut },
          delete: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
          },
        },
  );
}

/**
 * Отдельный экран списка уроков — без Modal/require внутри arcade
 * (там это давало чёрный экран / вылет).
 */
export default function ArcadeChatsRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { lessons, removeRecentLesson, renameRecentLesson } = useTeacherJourney();
  const { chats, removeChat, renameChat } = useCompanionChats();
  const params = useLocalSearchParams<{ language?: string; location?: string }>();
  const language = (params.language as CompanionChatApiLanguage | undefined) ?? 'english';

  const [renameTarget, setRenameTarget] = useState<TeacherRecentLesson | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameFocused, setRenameFocused] = useState(false);
  const renameInputRef = useRef<TextInput>(null);
  const renameBackdrop = useRef(new Animated.Value(0)).current;
  const renameCardAnim = useRef(new Animated.Value(0)).current;
  const renameOpenRun = useRef<Animated.CompositeAnimation | null>(null);
  const renameClosing = useRef(false);

  const rows = useMemo(() => {
    const byId = new Map<string, TeacherRecentLesson>();
    for (const lesson of lessons) byId.set(lesson.id, lesson);
    for (const c of chats) {
      if (!c.id.startsWith('tl-') && c.presence !== 'урок') continue;
      if (byId.has(c.id)) continue;
      byId.set(c.id, {
        id: c.id,
        title: c.profileMetaLine?.trim() || c.preview?.trim() || 'Урок',
        subtitle: 'Преподаватель',
        createdAt: Date.now(),
        spentSecondsTotal: 0,
      });
    }
    return Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [chats, lessons]);

  const formatTime = useCallback(
    (ts: number) => {
      try {
        return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ru-RU', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(ts));
      } catch {
        return '';
      }
    },
    [locale],
  );

  const openLesson = useCallback(
    (lesson: TeacherRecentLesson) => {
      router.push({
        pathname: '/arcade-lesson',
        params: {
          lessonId: lesson.id,
          title: lesson.title,
          language,
          location: typeof params.location === 'string' ? params.location : '',
        },
      } as Href);
    },
    [language, params.location, router],
  );

  const confirmDeleteLesson = useCallback(
    (lesson: TeacherRecentLesson) => {
      Alert.alert(
        t('teacher.deleteLessonTitle'),
        t('teacher.deleteLessonMessage', { title: lesson.title }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
              requestAnimationFrame(() => {
                configureChatDeleteLayout();
                void removeRecentLesson(lesson.id);
                removeChat(lesson.id);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              });
            },
          },
        ],
      );
    },
    [removeChat, removeRecentLesson, t],
  );

  const beginRenameLesson = useCallback((lesson: TeacherRecentLesson) => {
    void Haptics.selectionAsync();
    renameClosing.current = false;
    setRenameDraft(lesson.title);
    setRenameFocused(false);
    setRenameTarget(lesson);
  }, []);

  useEffect(() => {
    if (!renameTarget) return;
    renameClosing.current = false;
    renameOpenRun.current?.stop();
    renameBackdrop.setValue(0);
    renameCardAnim.setValue(0);
    renameOpenRun.current = Animated.parallel([
      Animated.timing(renameBackdrop, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(renameCardAnim, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
    ]);
    renameOpenRun.current.start();
    const tFocus = setTimeout(() => renameInputRef.current?.focus(), 280);
    return () => clearTimeout(tFocus);
  }, [renameBackdrop, renameCardAnim, renameTarget?.id]);

  const closeRenameModal = useCallback(
    (after?: () => void) => {
      if (!renameTarget || renameClosing.current) return;
      renameClosing.current = true;
      renameOpenRun.current?.stop();
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(renameBackdrop, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(renameCardAnim, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        renameClosing.current = false;
        setRenameTarget(null);
        setRenameDraft('');
        setRenameFocused(false);
        after?.();
      });
    },
    [renameBackdrop, renameCardAnim, renameTarget],
  );

  const saveRenameLesson = useCallback(() => {
    if (!renameTarget) return;
    const title = renameDraft.trim();
    if (!title) return;
    void renameRecentLesson(renameTarget.id, title);
    renameChat(renameTarget.id, title);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeRenameModal();
  }, [closeRenameModal, renameChat, renameDraft, renameRecentLesson, renameTarget]);

  const renameCardMotion = useMemo(
    () => ({
      opacity: renameCardAnim,
      transform: [
        { translateY: renameCardAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
        { scale: renameCardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
      ],
    }),
    [renameCardAnim],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TeacherRecentLesson>) => (
      <TeacherChatSwipeRow
        lesson={item}
        subtitle={formatTime(item.createdAt)}
        renameLabel={t('common.rename')}
        deleteLabel={t('common.delete')}
        onOpen={() => openLesson(item)}
        onRename={() => beginRenameLesson(item)}
        onDelete={() => confirmDeleteLesson(item)}
      />
    ),
    [beginRenameLesson, confirmDeleteLesson, formatTime, openLesson, t],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <GameBackButton variant="inline" onPress={() => router.back()} label="Назад" />
        <Text style={styles.title}>{t('teacher.chatsTitle')}</Text>
        <View style={styles.topSpacer} />
      </View>

      {rows.length > 0 ? (
        <FlatList
          data={rows}
          keyExtractor={(l) => l.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Math.max(insets.bottom, 12) + 20 },
          ]}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={36} color="rgba(26,26,26,0.35)" />
          <Text style={styles.emptyTitle}>{t('teacher.chatsEmptyTitle')}</Text>
          <Text style={styles.emptySub}>{t('teacher.chatsEmptySub')}</Text>
        </View>
      )}

      {renameTarget !== null ? (
        <Modal visible transparent animationType="none" onRequestClose={() => closeRenameModal()}>
          <KeyboardAvoidingView
            style={styles.renameRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Animated.View style={[styles.renameBackdrop, { opacity: renameBackdrop }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => closeRenameModal()} />
            </Animated.View>
            <Animated.View style={[styles.renameCard, renameCardMotion]}>
              <Text style={styles.renameTitle}>{t('teacher.renameTitle')}</Text>
              <Text style={styles.renameSubtitle}>{t('teacher.renameLesson')}</Text>
              <View style={[styles.renameInputShell, renameFocused && styles.renameInputShellFocused]}>
                <TextInput
                  ref={renameInputRef}
                  value={renameDraft}
                  onChangeText={setRenameDraft}
                  style={styles.renameInput}
                  placeholder={t('teacher.renameLesson')}
                  placeholderTextColor="rgba(26,26,26,0.35)"
                  onFocus={() => setRenameFocused(true)}
                  onBlur={() => setRenameFocused(false)}
                  onSubmitEditing={saveRenameLesson}
                  returnKeyType="done"
                  maxLength={80}
                />
              </View>
              <View style={styles.renameActions}>
                <Pressable
                  onPress={() => closeRenameModal()}
                  style={({ pressed }) => [styles.renameBtnGhost, pressed && styles.renameBtnPressed]}>
                  <Text style={styles.renameBtnGhostText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={saveRenameLesson}
                  disabled={!renameDraft.trim()}
                  style={({ pressed }) => [
                    styles.renameBtnPrimary,
                    !renameDraft.trim() && styles.renameBtnPrimaryOff,
                    pressed && renameDraft.trim() && styles.renameBtnPressed,
                  ]}
                  accessibilityLabel={t('teacher.renameSave')}>
                  <Text style={styles.renameBtnPrimaryText}>{t('teacher.renameSave')}</Text>
                </Pressable>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: GAME_THEME.color.gold,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  topSpacer: { width: 34 },
  list: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  sep: { height: 10 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: 'rgba(26,26,26,0.55)',
    textAlign: 'center',
    lineHeight: 20,
  },
  renameRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  renameBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  renameCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26,26,26,0.08)',
    shadowColor: '#0B1430',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    zIndex: 2,
  },
  renameTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.3,
  },
  renameSubtitle: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 14,
    color: 'rgba(26,26,26,0.5)',
    lineHeight: 19,
  },
  renameInputShell: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26,26,26,0.12)',
    backgroundColor: 'rgba(92,148,252,0.06)',
    paddingHorizontal: 14,
  },
  renameInputShellFocused: {
    borderColor: 'rgba(92,148,252,0.55)',
  },
  renameInput: {
    minHeight: 48,
    fontSize: 16,
    fontWeight: '600',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.2,
  },
  renameActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  renameBtnGhost: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameBtnGhostText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
  },
  renameBtnPrimary: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.sky,
  },
  renameBtnPrimaryOff: {
    opacity: 0.4,
  },
  renameBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  renameBtnPressed: {
    opacity: 0.86,
  },
});
