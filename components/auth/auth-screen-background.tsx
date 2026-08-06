import { StyleSheet, View } from 'react-native';

import { GAME_THEME } from '@/constants/game-theme';

/** Title-screen backdrop — sky over void, no orbs. */
export function AuthScreenBackground() {
  return (
    <View style={styles.base} pointerEvents="none">
      <View style={styles.sky} />
      <View style={styles.void} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
  },
  sky: {
    flex: 1,
    backgroundColor: GAME_THEME.color.sky,
  },
  void: {
    flex: 1.15,
    backgroundColor: GAME_THEME.color.void,
  },
});
