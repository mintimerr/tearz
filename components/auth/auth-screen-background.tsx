import { StyleSheet, View } from 'react-native';

import { AmbientOrbsBackground } from '@/components/ambient-orbs-background';
import { APP_THEME } from '@/constants/theme';

/** Тёмный фон auth — без SVG, совпадает с остальным приложением */
export function AuthScreenBackground() {
  return (
    <View style={styles.base} pointerEvents="none">
      <AmbientOrbsBackground intensity="calm" />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: APP_THEME.color.bg,
  },
});
