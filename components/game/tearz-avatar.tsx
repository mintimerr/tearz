import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import {
  TEARZ_COSMETIC_BY_ID,
  poseBodyMetricsFor,
  poseHatMetricsFor,
  resolveCosmeticThumbSource,
  resolveHatOverlaySource,
  resolveTearzOutfitSource,
  type TearzLoadout,
  normalizeLoadout,
  DEFAULT_TEARZ_LOADOUT,
} from '@/constants/tearz-cosmetics';

type Props = {
  loadout: TearzLoadout;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

function isBareClassic(loadout: TearzLoadout) {
  const L = normalizeLoadout(loadout);
  return (
    (!L.hatId || L.hatId === 'hat-none') &&
    (!L.accessoryId || L.accessoryId === 'acc-none') &&
    (!L.colorId || L.colorId === DEFAULT_TEARZ_LOADOUT.colorId || L.colorId === 'color-classic')
  );
}

/**
 * Поза предмета (книга, телефон, геймпад…) в выбранном цвете.
 * Шляпа садится на ту же позу, между ушами.
 * Голый classic без шмоток — Mario idle, как в хабе.
 */
export function TearzAvatar({ loadout, size = 96, style }: Props) {
  const L = normalizeLoadout(loadout);
  if (isBareClassic(L)) {
    return (
      <View style={[styles.wrap, { width: size, height: size }, style]}>
        <Image source={TEARZ_MARIO.idle} style={{ width: size, height: size }} contentFit="contain" transition={0} />
      </View>
    );
  }

  const source = resolveTearzOutfitSource(L);
  const body = poseBodyMetricsFor(L);
  const hat = resolveHatOverlaySource(L);
  const hatMetrics = poseHatMetricsFor(L);
  const drawH = size;
  const drawW = size * body.aspect;
  const ox = (size - drawW) / 2;

  let topPad = 0;
  let leftPad = 0;
  let boxW = size;
  let hatBox: { left: number; top: number; width: number; height: number } | null = null;
  if (hat && hatMetrics) {
    const headW = drawW * body.headW;
    const hatW = headW * hatMetrics.scale;
    const hatH = hatW / hatMetrics.aspect;
    const headX = ox + drawW * body.cx;
    const headY = drawH * body.head;
    const hatLeft = headX - hatW * hatMetrics.seatX;
    const hatTop = headY - hatH * hatMetrics.anchor;
    topPad = Math.max(0, -hatTop);
    leftPad = Math.max(0, -hatLeft);
    const rightPad = Math.max(0, hatLeft + hatW - size);
    boxW = size + leftPad + rightPad;
    hatBox = { left: hatLeft + leftPad, top: hatTop + topPad, width: hatW, height: hatH };
  }

  return (
    <View style={[styles.wrap, { width: boxW, height: size + topPad }, style]}>
      <Image
        source={source}
        style={{ position: 'absolute', left: ox + leftPad, top: topPad, width: drawW, height: drawH }}
        contentFit="fill"
        transition={0}
      />
      {hat && hatBox ? (
        <Image source={hat} style={{ position: 'absolute', ...hatBox }} contentFit="fill" transition={0} />
      ) : null}
    </View>
  );
}

/** Мини-превью айтема: отдельный реф Tearz в этой шмотке. */
export function TearzCosmeticThumb({
  itemId,
  size = 52,
}: {
  itemId: string;
  size?: number;
}) {
  const item = TEARZ_COSMETIC_BY_ID[itemId];
  if (!item) return <View style={{ width: size, height: size }} />;

  if (item.empty) {
    return (
      <View style={[styles.thumbEmpty, { width: size, height: size }]}>
        <View style={styles.thumbDash} />
      </View>
    );
  }

  const source = resolveCosmeticThumbSource(item);
  if (!source) return <View style={{ width: size, height: size }} />;

  return (
    <Image source={source} style={{ width: size, height: size }} contentFit="contain" transition={0} />
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(26,26,26,0.06)',
  },
  thumbDash: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(26,26,26,0.28)',
  },
});
