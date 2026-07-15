import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';
import { useTranslation } from '@/contexts/locale-context';

const CARD_H_COMPACT_BASE = 152;
const CARD_H_COMPACT_PINYIN = 176;
const CARD_H_LARGE_BASE = 420;
const CARD_H_LARGE_PINYIN = 460;

type Props = {
  front: string;
  back: string;
  pinyin?: string;
  frontLabel?: string;
  backLabel?: string;
  width: number;
  size?: 'compact' | 'large';
  onRemove?: () => void;
  onLongPress?: () => void;
};

export function VocabFlipCard({
  front,
  back,
  pinyin,
  frontLabel,
  backLabel,
  width,
  size = 'compact',
  onRemove,
  onLongPress,
}: Props) {
  const { t } = useTranslation();
  const large = size === 'large';
  const cardH = pinyin
    ? large
      ? CARD_H_LARGE_PINYIN
      : CARD_H_COMPACT_PINYIN
    : large
      ? CARD_H_LARGE_BASE
      : CARD_H_COMPACT_BASE;
  const anim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const flipped = useRef(false);

  useEffect(() => {
    flipped.current = false;
    anim.setValue(0);
    pressScale.setValue(1);
  }, [front, back, pinyin, anim, pressScale]);

  const toggle = () => {
    flipped.current = !flipped.current;
    void Haptics.selectionAsync();
    Animated.timing(anim, {
      toValue: flipped.current ? 1 : 0,
      duration: 340,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();
  };

  const pressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.97,
      damping: 20,
      stiffness: 320,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      damping: 18,
      stiffness: 280,
      mass: 0.65,
      useNativeDriver: true,
    }).start();
  };

  const frontOpacity = anim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [1, 0, 0],
  });
  const backOpacity = anim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0, 1],
  });
  const frontScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] });
  const backScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] });
  const frontY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 3] });
  const backY = anim.interpolate({ inputRange: [0, 1], outputRange: [-3, 0] });

  return (
    <View style={[styles.wrap, { width, height: cardH }]}>
      <Pressable
        onPress={toggle}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onLongPress={
          onLongPress
            ? () => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onLongPress();
              }
            : undefined
        }
        delayLongPress={420}
        style={[styles.hit, { width, height: cardH }]}
        accessibilityRole="button"
        accessibilityHint={onLongPress ? t('vocabulary.flipA11yLong') : t('vocabulary.flipA11y')}>
        <Animated.View style={[styles.stage, { width, height: cardH, transform: [{ scale: pressScale }] }]}>
          <Animated.View
            style={[
              styles.face,
              styles.faceFront,
              {
                width,
                height: cardH,
                opacity: frontOpacity,
                transform: [{ translateY: frontY }, { scale: frontScale }],
              },
            ]}>
            {frontLabel ? <Text style={styles.langTag}>{frontLabel}</Text> : null}
            {pinyin ? (
              <Text style={[styles.pinyinFront, onRemove && styles.termWithTrash]} numberOfLines={1}>
                {pinyin}
              </Text>
            ) : null}
            <Text
              style={[
                styles.term,
                large && styles.termLarge,
                pinyin && styles.termWithPinyin,
                onRemove && styles.termWithTrash,
              ]}
              numberOfLines={large ? 6 : 4}>
              {front}
            </Text>
            {large ? null : <Text style={styles.hint}>{t('vocabulary.flipHint')}</Text>}
          </Animated.View>
          <Animated.View
            style={[
              styles.face,
              styles.faceBack,
              {
                width,
                height: cardH,
                opacity: backOpacity,
                transform: [{ translateY: backY }, { scale: backScale }],
              },
            ]}>
            {backLabel ? <Text style={styles.langTag}>{backLabel}</Text> : null}
            <Text style={[styles.term, styles.termBack, large && styles.termBackLarge, onRemove && styles.termWithTrash]} numberOfLines={large ? 8 : 5}>
              {back}
            </Text>
            {large ? null : <Text style={styles.hint}>{t('vocabulary.flipBackHint')}</Text>}
          </Animated.View>
        </Animated.View>
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityLabel={t('vocabulary.removeWord')}
          hitSlop={10}
          style={styles.removeBtn}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onRemove();
          }}>
          <Ionicons name="trash-outline" size={16} color={APP_THEME.color.mutedSoft} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  hit: {},
  stage: {
    position: 'relative',
  },
  face: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: APP_THEME.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  faceFront: {
    backgroundColor: APP_THEME.color.elevated,
  },
  faceBack: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 20,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.bg,
  },
  langTag: {
    position: 'absolute',
    top: 11,
    left: 12,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: APP_THEME.color.mutedSoft,
  },
  pinyinFront: {
    marginTop: 20,
    marginBottom: 2,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
    color: APP_THEME.color.muted,
    textAlign: 'center',
    width: '100%',
  },
  term: {
    marginTop: 10,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.45,
    color: APP_THEME.color.text,
    textAlign: 'center',
    width: '100%',
  },
  termWithPinyin: {
    marginTop: 4,
  },
  termWithTrash: {
    paddingHorizontal: 22,
  },
  termBack: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 23,
    color: APP_THEME.color.textSoft,
  },
  termLarge: {
    marginTop: 14,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 42,
  },
  termBackLarge: {
    fontSize: 28,
    lineHeight: 36,
  },
  hint: {
    position: 'absolute',
    bottom: 11,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.05,
    color: APP_THEME.color.mutedFaint,
  },
});
