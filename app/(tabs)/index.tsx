import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { FlatList, Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompanionFindBottomSheet } from '@/components/companion-find-bottom-sheet';
import { StreakChip } from '@/components/engagement/streak-chip';
import { PremiumChip, PremiumScreenShell, ScreenHeader } from '@/components/ui';
import { APP_THEME } from '@/constants/theme';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import { useTranslation } from '@/contexts/locale-context';
import type { CompanionChatRow } from '@/contexts/companion-chats-context';

const ONLINE = APP_THEME.color.online;
const TAB_BAR_CORE = APP_THEME.tabBar.core;
const AVATAR = 52;
const ROW_INSET = 16;
const SEPARATOR_INSET = ROW_INSET + AVATAR + 12;
const SWIPE_BTN_WIDTH = 72;
const FIND_FAB_SIZE = 46;

type FilterId = 'all' | 'favorites';

function Avatar({ letter, color, online }: { letter: string; color: string; online: boolean }) {
  return (
    <View style={styles.avatarWrap}>
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.avatarLetter}>{letter}</Text>
      </View>
      {online ? <View style={styles.onlineDot} /> : null}
    </View>
  );
}

export default function CompanionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { chats, companionChatsHydrated, removeChat, toggleFavorite, isFavorite } = useCompanionChats();
  const [filter, setFilter] = useState<FilterId>('all');
  const [findSheetOpen, setFindSheetOpen] = useState(false);
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const filters = useMemo(
    () => [
      { id: 'all' as const, label: t('companion.filterAll') },
      { id: 'favorites' as const, label: t('companion.filterFavorites') },
    ],
    [t],
  );

  const tabBarOffset = TAB_BAR_CORE + insets.bottom;
  const findFabBottom = tabBarOffset + 12;
  const listPadBottom = findFabBottom + FIND_FAB_SIZE + 16;

  const rows = useMemo(
    () =>
      chats.filter((c) => {
        if (c.id.startsWith('tl-')) return false;
        if (filter === 'favorites') return isFavorite(c.id);
        return true;
      }),
    [chats, filter, isFavorite],
  );

  const openFind = useCallback(() => setFindSheetOpen(true), []);

  const openChat = useCallback(
    (c: CompanionChatRow) => {
      router.push({
        pathname: '/companion-chat',
        params: {
          id: c.id,
          name: c.name,
          online: c.online ? '1' : '0',
          letter: c.letter,
          color: c.color,
          ...(c.companionLang ? { companionLang: c.companionLang } : {}),
          ...(c.companionOpeningLine ? { openingLine: encodeURIComponent(c.companionOpeningLine) } : {}),
          ...(c.profileMetaLine ? { profileMetaLine: encodeURIComponent(c.profileMetaLine) } : {}),
        },
      });
    },
    [router],
  );

  const renderRightActions = useCallback(
    (c: CompanionChatRow) => {
      const fav = isFavorite(c.id);
      return (
        <View style={styles.swipeActions}>
          <TouchableOpacity
            style={[styles.swipeBtn, styles.swipeFav]}
            activeOpacity={0.8}
            onPress={() => {
              toggleFavorite(c.id);
              swipeRefs.current.get(c.id)?.close();
            }}>
            <Ionicons name={fav ? 'star' : 'star-outline'} size={22} color="#FFD60A" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeBtn, styles.swipeDel]}
            activeOpacity={0.8}
            onPress={() => removeChat(c.id)}>
            <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      );
    },
    [isFavorite, removeChat, toggleFavorite],
  );

  const renderItem = useCallback(
    ({ item: c, index }: ListRenderItemInfo<CompanionChatRow>) => {
      const isLast = index === rows.length - 1;
      return (
        <Swipeable
          ref={(el) => {
            if (el) swipeRefs.current.set(c.id, el);
            else swipeRefs.current.delete(c.id);
          }}
          overshootRight={false}
          friction={2}
          rightThreshold={40}
          activeOffsetX={[-12, 12]}
          failOffsetY={[-8, 8]}
          renderRightActions={() => renderRightActions(c)}>
          <Pressable
            onPress={() => openChat(c)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Avatar letter={c.letter} color={c.color} online={c.online} />
            <View style={styles.rowMain}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.time}>{c.time}</Text>
              </View>
              <View style={styles.rowBottom}>
                <Text style={[styles.preview, c.unread > 0 && styles.previewUnread]} numberOfLines={2}>
                  {c.preview}
                </Text>
                {c.unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{c.unread > 99 ? '99+' : c.unread}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            {!isLast ? <View style={styles.separator} /> : null}
          </Pressable>
        </Swipeable>
      );
    },
    [openChat, renderRightActions, rows.length],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <Pressable style={styles.search} onPress={openFind}>
          <Ionicons name="search" size={17} color={APP_THEME.color.mutedSoft} />
          <Text style={styles.searchPlaceholder}>{t('companion.search')}</Text>
        </Pressable>
        <View style={styles.filtersRow}>
          {filters.map((f) => (
            <PremiumChip
              key={f.id}
              active={filter === f.id}
              label={f.label}
              onPress={() => setFilter(f.id)}
            />
          ))}
        </View>
      </View>
    ),
    [filter, filters, openFind, t],
  );

  const listEmpty = useMemo(() => {
    if (!companionChatsHydrated) {
      return (
        <View style={styles.listHydrate}>
          <ActivityIndicator color={APP_THEME.color.text} size="large" />
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>{t('companion.emptyTitle')}</Text>
        <Text style={styles.empty}>{t('companion.emptySub')}</Text>
      </View>
    );
  }, [companionChatsHydrated, openFind, t]);

  return (
    <PremiumScreenShell topOffset={8} style={styles.root}>
      <ScreenHeader title={t('tabs.companion')} trailing={<StreakChip compact />} />

      <FlatList
        data={companionChatsHydrated ? rows : []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        style={styles.list}
        contentContainerStyle={[rows.length === 0 && styles.listEmptyGrow, { paddingBottom: listPadBottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        windowSize={8}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      <Pressable
        onPress={openFind}
        style={({ pressed }) => [
          styles.findFab,
          { bottom: findFabBottom },
          pressed && styles.findFabPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('companion.newChat')}>
        <Ionicons name="add" size={26} color="#09090B" />
      </Pressable>

      <CompanionFindBottomSheet visible={findSheetOpen} onClose={() => setFindSheetOpen(false)} />
    </PremiumScreenShell>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: APP_THEME.color.bg,
  },
  findFab: {
    position: 'absolute',
    right: ROW_INSET,
    zIndex: 10,
    width: FIND_FAB_SIZE,
    height: FIND_FAB_SIZE,
    borderRadius: FIND_FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F5',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 6,
  },
  findFabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.94 }],
  },
  list: {
    flex: 1,
  },
  listEmptyGrow: {
    flexGrow: 1,
  },
  listHeader: {
    gap: APP_THEME.space.md,
    marginBottom: APP_THEME.space.sm,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: APP_THEME.radius.pill,
    paddingVertical: 11,
    paddingHorizontal: APP_THEME.space.lg,
    backgroundColor: APP_THEME.color.elevated,
    gap: 8,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 17,
    letterSpacing: -0.2,
    color: APP_THEME.color.mutedSoft,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_THEME.space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: ROW_INSET,
    gap: 12,
    backgroundColor: APP_THEME.color.bg,
    position: 'relative',
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
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: ONLINE,
    borderWidth: 2.5,
    borderColor: APP_THEME.color.bg,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  name: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.35,
    color: APP_THEME.color.text,
  },
  time: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.15,
    color: APP_THEME.color.mutedSoft,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  preview: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.15,
    color: APP_THEME.color.muted,
  },
  previewUnread: {
    color: APP_THEME.color.textSoft,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: APP_THEME.color.link,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  swipeActions: {
    flexDirection: 'row',
  },
  swipeBtn: {
    width: SWIPE_BTN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeFav: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  swipeDel: {
    backgroundColor: APP_THEME.color.danger,
  },
  emptyWrap: {
    paddingTop: 56,
    paddingHorizontal: APP_THEME.space.xl,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    ...APP_THEME.type.titleLg,
    color: APP_THEME.color.text,
    textAlign: 'center',
  },
  empty: {
    ...APP_THEME.type.caption,
    color: APP_THEME.color.mutedSoft,
    textAlign: 'center',
    lineHeight: 22,
  },
  listHydrate: {
    paddingTop: 80,
    alignItems: 'center',
  },
});
