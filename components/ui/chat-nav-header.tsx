import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type Props = {
  backLabel: string;
  onBack: () => void;
  name: string;
  subtitle?: ReactNode;
  statusText?: string;
  online?: boolean;
  avatarLetter?: string;
  avatarColor?: string;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  onCallPress?: () => void;
  callAccessibilityLabel?: string;
};

/** Шапка экрана диалога — iOS-style «назад к списку» + контакт */
export function ChatNavHeader({
  backLabel,
  onBack,
  name,
  subtitle,
  statusText,
  online,
  avatarLetter,
  avatarColor,
  leadingIcon,
  onCallPress,
  callAccessibilityLabel = 'Звонок',
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.navRow}>
        <Pressable
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 12 }}
          style={({ pressed }) => [styles.backRow, pressed && styles.backRowPressed]}
          accessibilityRole="button"
          accessibilityLabel={backLabel}>
          <Ionicons name="chevron-back" size={22} color={APP_THEME.color.link} />
          <Text style={styles.backLabel} numberOfLines={1}>
            {backLabel}
          </Text>
        </Pressable>
        {onCallPress ? (
          <Pressable
            onPress={onCallPress}
            hitSlop={10}
            style={({ pressed }) => [styles.callBtn, pressed && styles.callBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={callAccessibilityLabel}>
            <Ionicons name="call-outline" size={22} color={APP_THEME.color.link} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.contactRow}>
        {leadingIcon ? (
          <View style={styles.iconBadge}>
            <Ionicons name={leadingIcon} size={17} color={APP_THEME.color.textSoft} />
          </View>
        ) : avatarLetter && avatarColor ? (
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarLetter}>{avatarLetter}</Text>
          </View>
        ) : null}
        <View style={styles.contactText}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {name}
          </Text>
          {subtitle ? (
            typeof subtitle === 'string' ? (
              <Text style={styles.subtitleText} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            )
          ) : statusText ? (
            <View style={styles.statusRow}>
              {online !== undefined ? (
                <View style={[styles.statusDot, { opacity: online ? 1 : 0.45 }]} />
              ) : null}
              <Text style={styles.subtitleText} numberOfLines={1}>
                {statusText}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 4,
    paddingBottom: 10,
    paddingHorizontal: APP_THEME.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_THEME.color.separator,
    backgroundColor: APP_THEME.color.bg,
    gap: 10,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    paddingRight: 8,
    marginLeft: -6,
    gap: 2,
    flexShrink: 1,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.elevated,
  },
  callBtnPressed: {
    opacity: 0.72,
  },
  backRowPressed: {
    opacity: 0.72,
  },
  backLabel: {
    ...APP_THEME.type.title,
    fontSize: 16,
    color: APP_THEME.color.link,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_THEME.color.text,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.elevated,
  },
  contactText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...APP_THEME.type.title,
    fontSize: 17,
    color: APP_THEME.color.text,
  },
  subtitleText: {
    marginTop: 2,
    ...APP_THEME.type.micro,
    color: APP_THEME.color.mutedSoft,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: APP_THEME.color.online,
  },
});
