import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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

import { CompanionFindBottomSheet } from '@/components/companion-find-bottom-sheet';
import { GameGoldButton } from '@/components/game/game-gold-button';
import { GameListRow } from '@/components/game/game-list-row';
import { GameWindowShell } from '@/components/game/game-window-shell';
import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import { GAME_THEME } from '@/constants/game-theme';
import { useCompanionChats, type CompanionChatRow } from '@/contexts/companion-chats-context';
import { useTranslation } from '@/contexts/locale-context';

const ONLINE = GAME_THEME.color.ok;
const SWIPE_BTN_WIDTH = 72;

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

function GameFilterChip({
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
        styles.filterChip,
        active && styles.filterChipOn,
        pressed && styles.filterChipPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function DialogsWindowScreen() {
  const router = useRouter();
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
            activeOpacity={0.85}
            onPress={() => {
              toggleFavorite(c.id);
              swipeRefs.current.get(c.id)?.close();
            }}>
            <Ionicons name={fav ? 'star' : 'star-outline'} size={20} color={GAME_THEME.color.ink} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeBtn, styles.swipeDel]}
            activeOpacity={0.85}
            onPress={() => removeChat(c.id)}>
            <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      );
    },
    [isFavorite, removeChat, toggleFavorite],
  );

  const renderItem = useCallback(
    ({ item: c }: ListRenderItemInfo<CompanionChatRow>) => (
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
        <GameListRow
          title={c.name}
          subtitle={c.preview}
          selected={c.unread > 0}
          leading={<Avatar letter={c.letter} color={c.color} online={c.online} />}
          trailing={
            <View style={styles.chatTrailing}>
              <Text style={styles.time}>{c.time}</Text>
              {c.unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{c.unread > 99 ? '99+' : c.unread}</Text>
                </View>
              ) : isFavorite(c.id) ? (
                <Ionicons name="star" size={14} color={GAME_THEME.color.sky} />
              ) : null}
            </View>
          }
          onPress={() => openChat(c)}
        />
      </Swipeable>
    ),
    [isFavorite, openChat, renderRightActions],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <Pressable
          style={({ pressed }) => [styles.search, pressed && styles.searchPressed]}
          onPress={openFind}
          accessibilityRole="button"
          accessibilityLabel={t('companion.search')}>
          <Ionicons name="search" size={18} color={GAME_THEME.color.ink} />
          <Text style={styles.searchPlaceholder}>{t('companion.search')}</Text>
        </Pressable>
        <View style={styles.filtersRow}>
          {filters.map((f) => (
            <GameFilterChip
              key={f.id}
              label={f.label}
              active={filter === f.id}
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
          <ActivityIndicator color={GAME_THEME.color.ink} size="large" />
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Image source={TEARZ_MARIO.talk} style={styles.emptyMascot} contentFit="contain" />
        <Text style={styles.emptyTitle}>{t('companion.emptyTitle')}</Text>
        <Text style={styles.empty}>{t('companion.emptySub')}</Text>
        <GameGoldButton
          label={t('companion.newChat')}
          onPress={openFind}
          size="md"
          style={styles.emptyCta}
        />
      </View>
    );
  }, [companionChatsHydrated, openFind, t]);

  return (
    <>
      <GameWindowShell
        title={t('tabs.companion')}
        contentPadding={14}
        right={
          <Pressable
            onPress={openFind}
            hitSlop={8}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('companion.newChat')}>
            <Ionicons name="add" size={22} color={GAME_THEME.color.ink} />
          </Pressable>
        }>
        <View style={styles.body}>
          <FlatList
            data={companionChatsHydrated ? rows : []}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
            style={styles.list}
            contentContainerStyle={[
              styles.listContent,
              rows.length === 0 && styles.listEmptyGrow,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={12}
            windowSize={8}
            removeClippedSubviews={Platform.OS === 'android'}
          />
          {rows.length > 0 ? (
            <GameGoldButton
              label={t('companion.newChat')}
              onPress={openFind}
              size="md"
              style={styles.newChatBtn}
            />
          ) : null}
        </View>
      </GameWindowShell>

      <CompanionFindBottomSheet visible={findSheetOpen} onClose={() => setFindSheetOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  headerBtnPressed: {
    opacity: 0.65,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  listEmptyGrow: {
    flexGrow: 1,
  },
  newChatBtn: {
    alignSelf: 'stretch',
    marginTop: 10,
  },
  listHeader: {
    gap: 12,
    marginBottom: 12,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    gap: 10,
  },
  searchPressed: {
    opacity: 0.85,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.4)',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.paper,
  },
  filterChipOn: {
    backgroundColor: GAME_THEME.color.gold,
    borderBottomWidth: 4,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  filterChipPressed: {
    opacity: 0.8,
    transform: [{ translateY: 1 }],
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(26,26,26,0.55)',
  },
  filterChipTextOn: {
    color: GAME_THEME.color.ink,
  },
  chatTrailing: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    minWidth: 48,
  },
  avatarWrap: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ONLINE,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  time: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: 'rgba(26,26,26,0.45)',
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: GAME_THEME.color.gold,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
  },
  swipeActions: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  swipeBtn: {
    width: SWIPE_BTN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  swipeFav: {
    backgroundColor: GAME_THEME.color.gold,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  swipeDel: {
    backgroundColor: GAME_THEME.color.danger,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    borderLeftWidth: 0,
  },
  emptyWrap: {
    flexGrow: 1,
    paddingTop: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyMascot: {
    width: 120,
    height: 120,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  empty: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  emptyCta: {
    alignSelf: 'stretch',
    marginTop: 4,
  },
  listHydrate: {
    paddingTop: 80,
    alignItems: 'center',
  },
});
