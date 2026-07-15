import { Image as ExpoImage } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import type { BoardPerformance } from '@/hooks/use-board-performance';
import { WRITE_CLIP_ASPECT } from '@/components/teacher/board-tearz-at-surface';
import { TEARZ_BOARD_WRITE_WEBP } from './tearz-board-hero-source';

const STROKE_GAP_MS = 220;

type Props = {
  performance: BoardPerformance;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
};

/** Kling write-клип на белой поверхности доски — компактно, правый нижний угол. */
export function BoardTearzWriteClip({ performance, width, height, style }: Props) {
  const perf = performance;
  const lastStrokeAt = useRef(0);
  const [strokePlay, setStrokePlay] = useState(0);

  useEffect(() => {
    if (perf.kind !== 'type') return;
    const now = Date.now();
    if (now - lastStrokeAt.current < STROKE_GAP_MS) return;
    lastStrokeAt.current = now;
    setStrokePlay((n) => n + 1);
  }, [perf.kind, perf.pulse]);

  if (!TEARZ_BOARD_WRITE_WEBP) return null;

  return (
    <ExpoImage
      key={`board-write-${strokePlay}`}
      source={TEARZ_BOARD_WRITE_WEBP}
      contentFit="contain"
      contentPosition="bottom right"
      cachePolicy="memory-disk"
      priority="high"
      autoplay
      transition={0}
      style={[styles.clip, { width, height }, style]}
    />
  );
}

export function boardWriteClipSize(surfaceW: number, surfaceH: number) {
  const h = Math.round(surfaceH * 0.46);
  const w = Math.round(h * WRITE_CLIP_ASPECT);
  return {
    w: Math.min(w, Math.round(surfaceW * 0.34)),
    h,
  };
}

const styles = StyleSheet.create({
  clip: {
    backgroundColor: 'transparent',
  },
});
