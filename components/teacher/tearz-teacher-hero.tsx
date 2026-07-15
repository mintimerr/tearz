import { Image as ExpoImage } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { APP_THEME } from '@/constants/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const HERO = require('../../assets/images/tearz-teacher-hero.webp');

/** Пропорции ассета (scripts/crop-teacher-hero-frames.py). */
const ASPECT = 360 / 220;

type Props = {
  style?: StyleProp<ViewStyle>;
};

/** Tearz листает книгу — зацикленный WebP над композером преподавателя. */
export function TearzTeacherHero({ style }: Props) {
  return (
    <View style={[styles.zone, style]} pointerEvents="none">
      <View style={styles.box}>
        <ExpoImage source={HERO} contentFit="contain" transition={0} autoplay style={styles.img} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: APP_THEME.color.bg,
  },
  box: {
    width: '100%',
    maxWidth: 280,
    aspectRatio: ASPECT,
  },
  img: {
    width: '100%',
    height: '100%',
  },
});
