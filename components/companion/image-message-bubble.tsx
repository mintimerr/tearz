import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image as RNImage, StyleSheet, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type Props = {
  uri: string;
  outgoing?: boolean;
  pending?: boolean;
};

const MAX_W = 280;
const MAX_H = 380;
const FALLBACK_W = 248;
const FALLBACK_H = 186;

function fitSize(w: number, h: number) {
  if (w <= 0 || h <= 0) return { width: FALLBACK_W, height: FALLBACK_H };
  const scale = Math.min(MAX_W / w, MAX_H / h, 1);
  return {
    width: Math.max(96, Math.round(w * scale)),
    height: Math.max(72, Math.round(h * scale)),
  };
}

/** Превью фото в чате: целиком, без crop/zoom. */
export function ImageMessageBubble({ uri, pending }: Props) {
  const [box, setBox] = useState({ width: FALLBACK_W, height: FALLBACK_H });

  useEffect(() => {
    let alive = true;
    RNImage.getSize(
      uri,
      (w, h) => {
        if (!alive) return;
        setBox(fitSize(w, h));
      },
      () => {
        if (!alive) return;
        setBox({ width: FALLBACK_W, height: FALLBACK_H });
      },
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  return (
    <View style={[styles.wrap, { width: box.width, height: box.height }]}>
      <Image
        source={{ uri }}
        style={styles.image}
        contentFit="contain"
        transition={120}
        onLoad={(e) => {
          const w = e.source?.width;
          const h = e.source?.height;
          if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
            setBox(fitSize(w, h));
          }
        }}
      />
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
    backgroundColor: 'rgba(0,0,0,0.04)',
    maxWidth: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pending: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
});
