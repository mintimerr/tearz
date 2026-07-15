import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type SectionProps = {
  title?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

type RowProps = {
  children: ReactNode;
  onPress?: () => void;
  showSeparator?: boolean;
  separatorInset?: number;
};

/** iOS Settings–style grouped block */
export function PremiumGroupedSection({ title, footer, children, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.group}>{children}</View>
      {footer ? <Text style={styles.sectionFooter}>{footer}</Text> : null}
    </View>
  );
}

export function PremiumGroupedRow({
  children,
  onPress,
  showSeparator = true,
  separatorInset,
}: RowProps) {
  const inner = (
    <>
      {children}
      {showSeparator ? (
        <View style={[styles.separator, separatorInset != null && { left: separatorInset }]} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.row}>{inner}</View>;
}

const styles = StyleSheet.create({
  section: {
    marginBottom: APP_THEME.space.xxl,
  },
  sectionTitle: {
    marginBottom: APP_THEME.space.sm,
    marginLeft: APP_THEME.space.lg,
    ...APP_THEME.type.label,
    color: APP_THEME.color.muted,
  },
  sectionFooter: {
    marginTop: APP_THEME.space.sm,
    marginHorizontal: APP_THEME.space.lg,
    ...APP_THEME.type.label,
    lineHeight: 18,
    color: APP_THEME.color.mutedSoft,
  },
  group: {
    borderRadius: APP_THEME.radius.lg,
    backgroundColor: APP_THEME.color.elevated,
    overflow: 'hidden',
  },
  row: {
    position: 'relative',
    backgroundColor: APP_THEME.color.elevated,
  },
  rowPressed: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  separator: {
    position: 'absolute',
    left: APP_THEME.space.lg,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: APP_THEME.color.separator,
  },
});
