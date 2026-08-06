import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameBackButton } from '@/components/game/game-back-button';
import { GAME_THEME } from '@/constants/game-theme';
import type { Href } from 'expo-router';

type Props = {
  title: string;
  children: ReactNode;
  showBack?: boolean;
  backHref?: Href;
  onBack?: () => void;
  right?: ReactNode;
  backdrop?: 'sky' | 'void';
  contentPadding?: number;
  style?: StyleProp<ViewStyle>;
  panelStyle?: StyleProp<ViewStyle>;
};

const SIDE = 44;

/**
 * Полноэкранное игровое окно — edge-to-edge, без «карточки» с полями.
 */
export function GameWindowShell({
  title,
  children,
  showBack = true,
  backHref = '/hub',
  onBack,
  right,
  backdrop = 'void',
  contentPadding = 14,
  style,
  panelStyle,
}: Props) {
  const insets = useSafeAreaInsets();
  const bg = backdrop === 'sky' ? GAME_THEME.color.sky : GAME_THEME.color.void;

  return (
    <View style={[styles.root, { backgroundColor: GAME_THEME.color.cream }, style]}>
      <StatusBar style="dark" />

      {/* status strip under notch — same gold as title */}
      <View style={[styles.statusFill, { height: insets.top, backgroundColor: GAME_THEME.color.gold }]} />

      <View style={[styles.panel, panelStyle]}>
        <View style={styles.titleBar}>
          <View style={styles.side}>
            {showBack ? (
              <GameBackButton
                href={backHref}
                onPress={onBack}
                variant="inline"
                style={styles.backInline}
              />
            ) : null}
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          <View style={[styles.side, styles.sideRight]}>{right}</View>
        </View>

        <View
          style={[
            styles.body,
            {
              paddingHorizontal: contentPadding,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}>
          {children}
        </View>
      </View>

      {/* keep backdrop token available for rare overlays */}
      {backdrop === 'sky' ? <View pointerEvents="none" style={[styles.skyHint, { backgroundColor: bg }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  statusFill: {
    width: '100%',
  },
  panel: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 10,
    borderBottomWidth: 3,
    borderBottomColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.gold,
  },
  side: {
    width: SIDE,
    height: SIDE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'center',
  },
  backInline: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  body: {
    flex: 1,
    minHeight: 0,
    paddingTop: 14,
  },
  skyHint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
});
