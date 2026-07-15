import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type Props = {
  uri: string;
  outgoing?: boolean;
  pending?: boolean;
};

export function ImageMessageBubble({ uri, pending }: Props) {
  return (
    <View style={styles.wrap}>
      <Image source={{ uri }} style={styles.image} contentFit="cover" transition={120} />
      {pending ? (
        <View style={styles.pending}>
          <ActivityIndicator size="small" color={APP_THEME.color.text} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: 248,
    height: 248,
    maxWidth: '100%',
  },
  pending: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
});
