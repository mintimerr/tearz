import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Large title — Apple / ChatGPT screen opener */
export function ScreenHeader({ title, subtitle, trailing, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: APP_THEME.space.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    color: APP_THEME.color.text,
    ...APP_THEME.type.display,
  },
  trailing: {
    flexShrink: 0,
  },
  subtitle: {
    marginTop: 8,
    ...APP_THEME.type.caption,
    lineHeight: 22,
    color: APP_THEME.color.muted,
    maxWidth: 340,
  },
});
