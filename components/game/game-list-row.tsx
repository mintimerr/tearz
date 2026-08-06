import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { GAME_THEME } from '@/constants/game-theme';

type Props = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Строка inventory — ровная высота, одна ширина с соседними CTA. */
export function GameListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  selected,
  style,
}: Props) {
  const body = (
    <View style={[styles.row, selected && styles.rowSelected, style]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={title}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 6,
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  rowSelected: {
    backgroundColor: GAME_THEME.color.paperWarm,
  },
  pressed: {
    opacity: 0.88,
  },
  leading: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    backgroundColor: 'rgba(26,26,26,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
    color: GAME_THEME.color.ink,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
    color: 'rgba(26,26,26,0.5)',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: 4,
  },
});
