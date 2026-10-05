import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { GAME_THEME } from '@/constants/game-theme';
import {
  TEARZ_BOARD_CHAT_AVATAR_IDLE,
  TEARZ_BOARD_CHAT_AVATAR_IDLE_OFFSET_Y,
  TEARZ_BOARD_CHAT_AVATAR_IDLE_SCALE,
  TEARZ_BOARD_CHAT_AVATAR_PHOTO,
  TEARZ_BOARD_CHAT_AVATAR_PHOTO_OFFSET_BOTTOM,
  TEARZ_BOARD_CHAT_AVATAR_PHOTO_OFFSET_Y,
  TEARZ_BOARD_CHAT_AVATAR_PHOTO_SCALE,
  type TearzBoardChatAvatarVariant,
} from './tearz-board-chat-avatar-source';

type Props = {
  size?: number;
  bordered?: boolean;
  variant?: TearzBoardChatAvatarVariant;
};

/** Tearz в чате — Mario pixel sprite. */
export function TearzBoardChatAvatar({
  size = 44,
  bordered = true,
  variant = 'idle',
}: Props) {
  const photo = variant === 'photo';
  const source = photo ? TEARZ_BOARD_CHAT_AVATAR_PHOTO : TEARZ_BOARD_CHAT_AVATAR_IDLE;
  const scale = photo ? TEARZ_BOARD_CHAT_AVATAR_PHOTO_SCALE : TEARZ_BOARD_CHAT_AVATAR_IDLE_SCALE;
  const offsetY = photo ? TEARZ_BOARD_CHAT_AVATAR_PHOTO_OFFSET_Y : TEARZ_BOARD_CHAT_AVATAR_IDLE_OFFSET_Y;
  const side = size * scale;

  return (
    <View
      style={[
        styles.shell,
        photo && styles.shellPhoto,
        {
          width: size,
          height: size,
          borderRadius: bordered ? 6 : 4,
          borderWidth: bordered ? 2 : 0,
          backgroundColor: GAME_THEME.color.cream,
        },
      ]}>
      <Image
        source={source}
        contentFit="contain"
        cachePolicy="memory-disk"
        style={{
          width: side,
          height: side,
          marginTop: offsetY,
          marginBottom: photo ? TEARZ_BOARD_CHAT_AVATAR_PHOTO_OFFSET_BOTTOM : 0,
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
    borderColor: GAME_THEME.color.ink,
  },
  shellPhoto: {
    justifyContent: 'flex-end',
  },
});
