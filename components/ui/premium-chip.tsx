import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type Props = {
  label?: string;
  children?: ReactNode;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function PremiumChip({ label, children, active, onPress, style, textStyle }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={style}>
      <Animated.View style={[styles.chip, active && styles.chipActive, { transform: [{ scale }] }]}>
        {children ?? <Text style={[styles.text, active && styles.textActive, textStyle]}>{label}</Text>}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: APP_THEME.space.lg,
    paddingVertical: APP_THEME.space.sm,
    borderRadius: APP_THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.elevated,
  },
  chipActive: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  text: {
    ...APP_THEME.type.label,
    fontWeight: '500',
    color: APP_THEME.color.muted,
  },
  textActive: {
    color: APP_THEME.color.text,
    fontWeight: '600',
  },
});
