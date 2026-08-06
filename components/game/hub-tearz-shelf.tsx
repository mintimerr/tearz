import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TEARZ_CATALOG, type TearzCatalogItem } from '@/constants/tearz-collection';
import { GAME_THEME } from '@/constants/game-theme';

type Props = {
  ownedIds: string[];
};

/**
 * Коллекция на хабе: персонажи стоят на планке.
 * Тап — подсказка «кто это / как открыть».
 */
export function HubTearzShelf({ ownedIds }: Props) {
  const owned = useMemo(() => new Set(ownedIds), [ownedIds]);
  const [focusId, setFocusId] = useState<string | null>(null);

  const focus = focusId ? TEARZ_CATALOG.find((t) => t.id === focusId) : null;
  const focusOwned = focus ? owned.has(focus.id) : false;
  const count = ownedIds.filter((id) => TEARZ_CATALOG.some((t) => t.id === id)).length;

  const caption = focus
    ? focusOwned
      ? `${focus.nameRu} — ${focus.blurbRu}`
      : `${focus.nameRu} · ${focus.howToGetRu}`
    : 'Твои Tearz за уроки и диалоги';

  return (
    <View style={styles.wrap} accessibilityRole="summary" accessibilityLabel={`Коллекция Tearz, ${count} из ${TEARZ_CATALOG.length}`}>
      <View style={styles.header}>
        <Text style={styles.title}>Коллекция</Text>
        <Text style={styles.count}>
          {count}/{TEARZ_CATALOG.length}
        </Text>
      </View>

      <View style={styles.stage}>
        <View style={styles.figures}>
          {TEARZ_CATALOG.map((item) => (
            <Figure
              key={item.id}
              item={item}
              unlocked={owned.has(item.id)}
              selected={focusId === item.id}
              onPress={() => {
                void Haptics.selectionAsync();
                setFocusId((prev) => (prev === item.id ? null : item.id));
              }}
            />
          ))}
        </View>
        <View style={styles.plank} pointerEvents="none">
          <View style={styles.plankTop} />
          <View style={styles.plankFace} />
          <View style={styles.plankLip} />
        </View>
      </View>

      <Text style={styles.caption} numberOfLines={2}>
        {caption}
      </Text>
    </View>
  );
}

function Figure({
  item,
  unlocked,
  selected,
  onPress,
}: {
  item: TearzCatalogItem;
  unlocked: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.figure,
        selected && styles.figureSelected,
        pressed && styles.figurePressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        unlocked ? `${item.nameRu}, открыт` : `${item.nameRu}, закрыт. ${item.howToGetRu}`
      }
      hitSlop={6}>
      <View style={[styles.spriteWrap, !unlocked && styles.spriteLocked]}>
        <Image
          source={item.source}
          style={[styles.sprite, !unlocked && styles.spriteSilhouette]}
          contentFit="contain"
          transition={0}
        />
      </View>
      {!unlocked ? <View style={styles.lockDot} /> : null}
    </Pressable>
  );
}

const INK = GAME_THEME.color.ink;
const WOOD = '#C4A574';
const WOOD_DARK = '#8B6914';
const WOOD_EDGE = '#5C4018';

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: GAME_THEME.color.cream,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  count: {
    fontSize: 13,
    fontWeight: '900',
    color: GAME_THEME.color.cream,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  stage: {
    position: 'relative',
    paddingTop: 4,
    paddingBottom: 10,
  },
  figures: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    zIndex: 2,
    paddingHorizontal: 4,
    minHeight: 72,
  },
  figure: {
    alignItems: 'center',
    width: 56,
  },
  figureSelected: {
    transform: [{ translateY: -4 }],
  },
  figurePressed: {
    opacity: 0.88,
  },
  spriteWrap: {
    width: 52,
    height: 64,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  spriteLocked: {
    opacity: 0.55,
  },
  sprite: {
    width: 52,
    height: 64,
  },
  spriteSilhouette: {
    tintColor: 'rgba(20, 28, 48, 0.72)',
  },
  lockDot: {
    position: 'absolute',
    bottom: 2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1.5,
    borderColor: INK,
  },
  plank: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  plankTop: {
    height: 3,
    backgroundColor: '#E8D4A8',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  plankFace: {
    height: 12,
    backgroundColor: WOOD,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: WOOD_EDGE,
  },
  plankLip: {
    height: 5,
    backgroundColor: WOOD_DARK,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  caption: {
    marginTop: 2,
    paddingHorizontal: 6,
    minHeight: 32,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    color: GAME_THEME.color.cream,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
