import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { CHAT_MSG } from '@/constants/chat-message';
import { APP_THEME } from '@/constants/theme';

type Props = {
  fileName: string;
  outgoing?: boolean;
};

export function FileMessageBubble({ fileName, outgoing }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, outgoing && styles.iconWrapOut]}>
        <Ionicons name="document-text-outline" size={20} color={APP_THEME.color.textSoft} />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {fileName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 240,
    paddingVertical: 2,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: APP_THEME.color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOut: {
    backgroundColor: APP_THEME.color.accentGlass,
  },
  name: {
    flex: 1,
    ...CHAT_MSG.body,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: CHAT_MSG.outgoingColor,
  },
});
