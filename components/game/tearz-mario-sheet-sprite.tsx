import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  TEARZ_MARIO_SHEETS,
  type TearzMarioSheetId,
} from '@/components/game/tearz-mario-sheets';

type Props = {
  sheet: TearzMarioSheetId;
  /** Индекс кадра 0..frames-1 */
  frame: number;
  size: number;
  /** −1 смотрит влево */
  facing?: 1 | -1;
  style?: StyleProp<ViewStyle>;
};

/**
 * Нарезка горизонтального sprite sheet — как кадры Mario.
 */
export function TearzMarioSheetSprite({ sheet, frame, size, facing = 1, style }: Props) {
  const meta = TEARZ_MARIO_SHEETS[sheet];
  const cols = meta.frames;
  const safeFrame = ((frame % cols) + cols) % cols;
  const cellAspect = meta.sheetW / cols / meta.sheetH;
  const drawH = size;
  const drawW = Math.round(size * cellAspect);
  const sheetDrawW = drawW * cols;

  return (
    <View
      style={[{ width: drawW, height: drawH, transform: [{ scaleX: facing }] }, style]}
      pointerEvents="none">
      <View style={[styles.clip, { width: drawW, height: drawH }]}>
        <Image
          source={meta.source}
          style={{
            width: sheetDrawW,
            height: drawH,
            marginLeft: -safeFrame * drawW,
          }}
          contentFit="fill"
          transition={0}
          cachePolicy="memory-disk"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
