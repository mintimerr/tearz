import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackdrop } from '@/components/ui/ambient-backdrop';
import { APP_THEME } from '@/constants/theme';

type Props = {
  children: ReactNode;
  topOffset?: number;
  horizontalPadding?: number;
  /** Мягкое фирменное свечение фона для «дорогой» глубины. */
  ambient?: boolean;
  ambientIntensity?: number;
  style?: StyleProp<ViewStyle>;
};

export function PremiumScreenShell({
  children,
  topOffset = 8,
  horizontalPadding = APP_THEME.space.xl,
  ambient = false,
  ambientIntensity = 1,
  style,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, style]}>
      {ambient ? <AmbientBackdrop intensity={ambientIntensity} /> : null}
      <View
        style={[
          styles.inner,
          {
            paddingTop: Math.max(insets.top, topOffset),
            paddingHorizontal: horizontalPadding,
          },
        ]}>
        <View style={styles.body}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_THEME.color.bg,
  },
  inner: {
    flex: 1,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
});
