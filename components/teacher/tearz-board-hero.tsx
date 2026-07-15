import { Image as ExpoImage, type ImageSource } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { TEARZ_BOARD_HERO_WEBP, TEARZ_BOARD_POSE_IDLE } from './tearz-board-hero-source';

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_TEACHER_CUTOUT = require('@/assets/board-concept/tearz-teacher-bold-cutout.png');
/** width / height исходника tearz-teacher-bold-cutout.png */
export const TEARZ_TEACHER_ASPECT = 948 / 963;

type Props = {
  width: number;
  height: number;
  source?: ImageSource;
};

/** Статичный Tearz у доски (без режима ввода). */
export function TearzBoardHero({ width, height, source }: Props) {
  const resolved = source ?? TEARZ_BOARD_HERO_WEBP ?? TEARZ_BOARD_POSE_IDLE;

  return (
    <View style={{ width, height }} pointerEvents="none">
      <ExpoImage
        source={resolved}
        contentFit="contain"
        cachePolicy="memory-disk"
        priority="high"
        autoplay={!!TEARZ_BOARD_HERO_WEBP}
        style={styles.hero}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    height: '100%',
  },
});
