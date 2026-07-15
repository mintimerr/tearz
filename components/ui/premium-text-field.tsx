import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type Props = TextInputProps & {
  icon?: keyof typeof Ionicons.glyphMap;
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export function PremiumTextField({ icon, right, containerStyle, style, placeholderTextColor, ...props }: Props) {
  return (
    <View style={[styles.shell, containerStyle]}>
      {icon ? <Ionicons name={icon} size={18} color={APP_THEME.color.mutedSoft} style={styles.icon} /> : null}
      <TextInput
        {...props}
        placeholderTextColor={placeholderTextColor ?? APP_THEME.color.mutedSoft}
        style={[styles.input, style]}
      />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: APP_THEME.radius.md,
    paddingHorizontal: APP_THEME.space.lg,
    backgroundColor: APP_THEME.color.elevated,
  },
  icon: {
    marginRight: APP_THEME.space.sm,
  },
  input: {
    flex: 1,
    minHeight: 46,
    paddingVertical: APP_THEME.space.sm,
    ...APP_THEME.type.body,
    color: APP_THEME.color.text,
  },
});
