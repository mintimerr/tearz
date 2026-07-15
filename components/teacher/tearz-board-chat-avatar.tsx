import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';
import {
  TEARZ_BOARD_CHAT_AVATAR,
  TEARZ_BOARD_CHAT_AVATAR_OFFSET_Y,
  TEARZ_BOARD_CHAT_AVATAR_SCALE,
} from './tearz-board-chat-avatar-source';

type Props = {
  size?: number;
  bordered?: boolean;
};

/** Tearz — torso-up, руки сложены, улыбка, в камеру. */
export function TearzBoardChatAvatar({ size = 44, bordered = true }: Props) {
  const side = size * TEARZ_BOARD_CHAT_AVATAR_SCALE;

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
        },
      ]}>
      <Image
        source={TEARZ_BOARD_CHAT_AVATAR}
        contentFit="cover"
        cachePolicy="memory-disk"
        style={{
          width: side,
          height: side,
          marginTop: TEARZ_BOARD_CHAT_AVATAR_OFFSET_Y,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: APP_THEME.color.border,
  },
});
