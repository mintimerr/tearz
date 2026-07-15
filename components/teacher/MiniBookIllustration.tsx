import { StyleSheet, View } from 'react-native';
import { APP_THEME } from '@/constants/theme';

import { TEACHER_ACCENT, TEACHER_LIME, TEACHER_CARD_BORDER } from '@/components/teacher/teacher-tokens';

type Props = {
  size?: 'md' | 'lg';
};

/** Мягкая «книга» — Duolingo-дружелюбный объём без растра */
export function MiniBookIllustration({ size = 'md' }: Props) {
  const scale = size === 'lg' ? 1.18 : 1;
  const w = Math.round(72 * scale);
  const h = Math.round(88 * scale);

  return (
    <View style={[styles.wrap, { width: w + 10, height: h }]} accessibilityLabel="Иллюстрация урока">
      <View style={[styles.glow, { width: w + 24, height: h + 16 }]} />
      <View style={[styles.spine, { height: h - 6 }]} />
      <View style={[styles.coverBack, { width: w - 4, height: h - 2 }]} />
      <View style={[styles.cover, { marginLeft: 10, width: w, height: h }]}>
        <View style={styles.coverBand} />
        <View style={styles.limeDot} />
        <View style={styles.pageEdge} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'flex-end',
  },
  glow: {
    position: 'absolute',
    left: -6,
    bottom: -4,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 92, 255, 0.2)',
    opacity: 0.5,
  },
  spine: {
    position: 'absolute',
    left: 0,
    bottom: 2,
    width: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(14, 18, 28, 0.98)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TEACHER_CARD_BORDER,
  },
  coverBack: {
    position: 'absolute',
    left: 6,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(88, 204, 2, 0.12)',
  },
  cover: {
    borderRadius: 14,
    backgroundColor: 'rgba(16, 20, 32, 0.98)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.accentGlass,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  coverBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '26%',
    height: 6,
    backgroundColor: TEACHER_ACCENT,
    opacity: 0.65,
  },
  limeDot: {
    position: 'absolute',
    right: 12,
    top: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TEACHER_LIME,
    opacity: 0.9,
  },
  pageEdge: {
    position: 'absolute',
    right: 0,
    top: 8,
    bottom: 8,
    width: 5,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    backgroundColor: APP_THEME.color.borderStrong,
  },
});
