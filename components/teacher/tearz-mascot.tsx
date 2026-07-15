import Constants from 'expo-constants';
import LottieView from 'lottie-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { TEARZ_LOTTIE } from './tearz-lottie-source';
import { TearzTeacherHero } from './tearz-teacher-hero';
import { RIVE_MODULE, RIVE_URL } from './tearz-rive-source';

type Props = {
  /** Композер в фокусе/печатает. */
  focused?: boolean;
  /** Реагировать на фокус: прятаться/выглядывать + менять анимацию (главный экран). */
  reactToFocus?: boolean;
  /** Сыграть эмоцию при появлении (имя триггера стейт-машины, напр. 'talk'). */
  greeting?: string | null;
  /** Переопределение размера/стиля зоны. */
  style?: StyleProp<ViewStyle>;
};

/** В Expo Go нет нативного модуля Rive — там используем фоллбэк. */
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

/** Активен ли Rive (есть ассет/URL и мы не в Expo Go). */
export const RIVE_ACTIVE = !!(RIVE_URL || RIVE_MODULE) && !IS_EXPO_GO;

/**
 * Маскот Tearz. На главном экране преподавателя — WebP с книгой;
 * иначе Rive → Lottie → векторный риг.
 */
export function TearzMascot({ focused, reactToFocus, greeting, style }: Props) {
  if (reactToFocus) {
    return <TearzTeacherHero style={style} />;
  }
  if (RIVE_ACTIVE) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TearzRive } = require('./tearz-rive') as typeof import('./tearz-rive');
    return <TearzRive focused={focused} reactToFocus={reactToFocus} greeting={greeting} style={style} />;
  }
  if (!TEARZ_LOTTIE) return <TearzTeacherHero style={style} />;
  return (
    <View style={[styles.zone, style]} pointerEvents="none">
      <LottieView
        source={TEARZ_LOTTIE}
        autoPlay
        loop
        resizeMode="contain"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { height: 200 },
});
