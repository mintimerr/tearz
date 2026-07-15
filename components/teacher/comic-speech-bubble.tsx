import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

const INK = 'rgba(21, 34, 56, 0.86)';

type Side = 'left' | 'right';

type Props = {
  side: Side;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

/** Облако речи — ровные пропорции, мягкая обводка. */
export function ComicSpeechBubble({ side, children, style, compact }: Props) {
  const isLeft = side === 'left';

  return (
    <View style={[styles.wrap, isLeft ? styles.wrapLeft : styles.wrapRight, style]}>
      <View
        style={[
          styles.cloud,
          isLeft ? styles.cloudTeacher : styles.cloudStudent,
          compact && styles.cloudCompact,
        ]}>
        <View style={[styles.tail, isLeft ? styles.tailLeft : styles.tailRight]} />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: '86%',
    marginVertical: 8,
  },
  wrapLeft: {
    alignSelf: 'flex-start',
  },
  wrapRight: {
    alignSelf: 'flex-end',
  },
  cloud: {
    position: 'relative',
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#152238',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  cloudTeacher: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 6,
  },
  cloudStudent: {
    backgroundColor: '#FFF8EE',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
  },
  cloudCompact: {
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  tail: {
    position: 'absolute',
    bottom: -7,
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: INK,
    transform: [{ rotate: '45deg' }],
  },
  tailLeft: {
    left: 22,
    backgroundColor: '#FFFFFF',
  },
  tailRight: {
    right: 22,
    backgroundColor: '#FFF8EE',
  },
  content: {
    zIndex: 1,
  },
});
