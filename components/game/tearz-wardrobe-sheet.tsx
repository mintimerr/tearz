import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import * as Haptics from '@/utils/safe-haptics';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TearzAvatar, TearzCosmeticThumb } from '@/components/game/tearz-avatar';
import { CoinAmount } from '@/components/game/tearz-drop';
import { PremiumButton } from '@/components/ui';
import { GAME_THEME } from '@/constants/game-theme';
import { TERMINAL_LOCATIONS, TERMINAL_SHELF_ONLY, type TerminalLocationId } from '@/constants/terminal-locations';
import {
  cosmeticsForSlot,
  TEARZ_COSMETIC_BY_ID,
  type TearzCosmeticItem,
  type TearzCosmeticSlot,
  type TearzLoadout,
} from '@/constants/tearz-cosmetics';
import { useEngagement } from '@/contexts/engagement-context';

type Tab = TearzCosmeticSlot | 'places';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'color', label: 'Цвет' },
  { id: 'hat', label: 'Шляпа' },
  { id: 'accessory', label: 'Вещи' },
  { id: 'places', label: 'Локации' },
];

const OPEN_PLACES = new Set<TerminalLocationId>(TERMINAL_SHELF_ONLY ?? []);

const PLACE_ORDER: TerminalLocationId[] = [
  'shanghai_metro_bund',
  'asia_arcade',
  'seoul_photo_booth',
  'europe_atm',
  'paris_metro_guimard',
  'uk_phone_box',
];

const PLACE_NAME: Partial<Record<TerminalLocationId, string>> = {
  shanghai_metro_bund: 'Касса на Нанкинской, Шанхай',
  europe_atm: 'У синей арки метро, Берлин',
  paris_metro_guimard: 'Под мостом Бир-Хакейм, Париж',
  seoul_photo_booth: 'Фотобудка в Хондэ, Сеул',
  uk_phone_box: 'Будка у Биг-Бена, Лондон',
  asia_arcade: 'Переулок с автоматами, Токио',
};

/** Numbeo 2026, стоимость жизни с арендой: Шанхай → Токио → Сеул → Берлин → Париж → Лондон. */
const PLACE_PRICE: Partial<Record<TerminalLocationId, number>> = {
  shanghai_metro_bund: 1200,
  asia_arcade: 1600,
  seoul_photo_booth: 1800,
  europe_atm: 2100,
  paris_metro_guimard: 2400,
  uk_phone_box: 3000,
};

const PLACES = PLACE_ORDER.map((id) => {
  const loc = TERMINAL_LOCATIONS.find((item) => item.id === id);
  return {
    id,
    name: PLACE_NAME[id] ?? id,
    open: OPEN_PLACES.has(id),
    price: PLACE_PRICE[id] ?? 0,
    scene: (loc?.scene ?? null) as ImageSource | null,
  };
}).filter((place) => place.scene);

/**
 * Гардероб Tearz — покупка и экипировка за монеты.
 */
export function TearzWardrobeSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const {
    coins,
    ownedCosmeticIds,
    tearzLoadout,
    purchaseCosmetic,
    equipCosmetic,
  } = useEngagement();
  const [tab, setTab] = useState<Tab>('color');

  const ownedCosmetics = useMemo(() => new Set(ownedCosmeticIds), [ownedCosmeticIds]);
  const cosmetics = tab === 'places' ? [] : cosmeticsForSlot(tab);

  const onBuyOrEquip = (item: TearzCosmeticItem) => {
    const owned = ownedCosmetics.has(item.id) || item.price === 0;
    if (owned) {
      equipCosmetic(item.id);
      return;
    }
    if (coins < item.price) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Мало капель', `Нужно ${item.price}, сейчас ${coins}`);
      return;
    }
    Alert.alert(item.nameRu, `Купить за ${item.price} капель?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Купить',
        onPress: () => {
          const ok = purchaseCosmetic(item.id);
          if (!ok) Alert.alert('Не вышло', 'Недостаточно капель или уже куплено');
        },
      },
    ]);
  };

  const isEquippedCosmetic = (item: TearzCosmeticItem) => {
    if (item.slot === 'color') return tearzLoadout.colorId === item.id;
    if (item.slot === 'hat') {
      if (item.empty) return !tearzLoadout.hatId;
      return tearzLoadout.hatId === item.id;
    }
    if (item.empty) return !tearzLoadout.accessoryId;
    return tearzLoadout.accessoryId === item.id;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12), paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Магазин</Text>
          <View style={styles.coinsPill}>
            <CoinAmount value={coins} textStyle={styles.coinsText} size={16} />
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} accessibilityLabel="Закрыть">
            <Ionicons name="close" size={22} color={GAME_THEME.color.ink} />
          </Pressable>
        </View>

        {tab === 'places' ? null : (
          <>
            <Text style={styles.lead}>Выбери цвет, шляпу и предмет. Так Tearz будет выглядеть в городе.</Text>
            <View style={styles.previewCard}>
              <TearzAvatar loadout={tearzLoadout} size={156} />
              <Text style={styles.previewHint}>Так он выглядит сейчас</Text>
            </View>
          </>
        )}

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => {
                void Haptics.selectionAsync();
                setTab(t.id);
              }}
              style={[styles.tab, tab === t.id && styles.tabOn]}>
              <Text
                style={[styles.tabText, tab === t.id && styles.tabTextOn]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={tab === 'places' ? styles.placeList : styles.grid}
          showsVerticalScrollIndicator={false}>
          {tab === 'places'
            ? PLACES.map((place) => (
                <Pressable
                  key={place.id}
                  onPress={() => {
                    Alert.alert(
                      place.name,
                      place.open ? 'Это место уже открыто.' : 'Этот экран ещё не доработан.',
                    );
                  }}
                  style={({ pressed }) => [styles.placeCard, pressed && styles.placeRowPressed]}>
                  <View style={styles.placeArt}>
                    <Image source={place.scene} style={styles.placeImage} contentFit="cover" />
                    {place.open ? (
                      <View style={styles.placeOpenPill}>
                        <Text style={styles.placeOpenText}>Открыто</Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.placeDim} />
                        <View style={styles.placeLock}>
                          <Ionicons name="lock-closed" size={18} color="#fff" />
                        </View>
                      </>
                    )}
                    <View style={styles.placeScrim} pointerEvents="none">
                      <Svg width="100%" height="100%">
                        <Defs>
                          <LinearGradient id={`place-scrim-${place.id}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
                            <Stop offset="100%" stopColor="#000000" stopOpacity="0.78" />
                          </LinearGradient>
                        </Defs>
                        <Rect width="100%" height="100%" fill={`url(#place-scrim-${place.id})`} />
                      </Svg>
                    </View>
                    <Text style={styles.placeTitle} numberOfLines={2}>
                      {place.name}
                    </Text>
                  </View>
                  {place.open ? null : (
                    <CoinAmount
                      value={place.price.toLocaleString('ru-RU')}
                      textStyle={styles.placePrice}
                      size={22}
                    />
                  )}
                </Pressable>
              ))
            : cosmetics.map((item) => {
            const owned = ownedCosmetics.has(item.id) || item.price === 0;
            const on = isEquippedCosmetic(item);
            return (
              <Pressable
                key={item.id}
                onPress={() => onBuyOrEquip(item)}
                style={[styles.card, on && styles.cardOn]}>
                <View style={styles.cardArt}>
                  <TearzCosmeticThumb itemId={item.id} size={56} />
                </View>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.nameRu}
                </Text>
                {owned ? (
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {on ? 'Выбрано' : 'Куплено'}
                  </Text>
                ) : (
                  <CoinAmount value={item.price} textStyle={styles.cardMeta} size={12} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <PremiumButton variant="primary" label="Готово" onPress={onClose} />
      </View>
    </Modal>
  );
}

/** Превью текущего лука — для полки/профиля. */
export function TearzLoadoutPreview({ loadout, size = 72 }: { loadout: TearzLoadout; size?: number }) {
  return <TearzAvatar loadout={loadout} size={size} />;
}

export function cosmeticLabel(id: string | null): string {
  if (!id) return '—';
  return TEARZ_COSMETIC_BY_ID[id]?.nameRu ?? id;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
    paddingHorizontal: 16,
    gap: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  coinsPill: {
    backgroundColor: 'rgba(255, 210, 74, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  coinsText: {
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    fontSize: 14,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,26,26,0.06)',
  },
  lead: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(26,26,26,0.62)',
  },
  previewCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    gap: 8,
  },
  previewHint: {
    fontSize: 12,
    color: 'rgba(26,26,26,0.45)',
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(26,26,26,0.05)',
    alignItems: 'center',
  },
  tabOn: {
    backgroundColor: GAME_THEME.color.ink,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.55)',
  },
  tabTextOn: {
    color: '#fff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 8,
    paddingBottom: 20,
  },
  card: {
    width: '31%',
    flexGrow: 1,
    minWidth: 96,
    maxWidth: '32%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(26,26,26,0.08)',
    alignItems: 'center',
    gap: 4,
  },
  cardOn: {
    borderColor: GAME_THEME.color.sky,
    backgroundColor: 'rgba(90, 168, 255, 0.12)',
  },
  cardArt: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 12,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  cardMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.5)',
    textAlign: 'center',
  },
  placeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 4,
    paddingBottom: 20,
  },
  placeCard: {
    width: '48%',
    flexGrow: 1,
    maxWidth: '48.5%',
    gap: 8,
  },
  placeRowPressed: {
    opacity: 0.86,
  },
  placeArt: {
    height: 168,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#D9D9D9',
  },
  placeImage: {
    width: '100%',
    height: '100%',
  },
  placeDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 12, 18, 0.38)',
  },
  placeLock: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  placeOpenPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  placeOpenText: {
    fontSize: 11,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  placeScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
  },
  placeTitle: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: '#FFFFFF',
  },
  placePrice: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: GAME_THEME.color.ink,
  },
});
