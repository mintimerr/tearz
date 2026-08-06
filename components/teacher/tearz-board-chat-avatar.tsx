import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { GAME_THEME } from '@/constants/game-theme';
import {
  TEARZ_BOARD_CHAT_AVATAR,
  TEARZ_BOARD_CHAT_AVATAR_OFFSET_Y,
  TEARZ_BOARD_CHAT_AVATAR_SCALE,
} from './tearz-board-chat-avatar-source';

type Props = {
  size?: number;
  bordered?: boolean;
};

/** Tearz в чате — Mario pixel sprite. */
export function TearzBoardChatAvatar({ size = 44, bordered = true }: Props) {
  const side = size * TEARZ_BOARD_CHAT_AVATAR_SCALE;

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: bordered ? 6 : 4,
          borderWidth: bordered ? 2 : 0,
        },
      ]}>
      <Image
        source={TEARZ_BOARD_CHAT_AVATAR}
        contentFit="contain"
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
    backgroundColor: GAME_THEME.color.cream,
    borderColor: GAME_THEME.color.ink,
  },
});
