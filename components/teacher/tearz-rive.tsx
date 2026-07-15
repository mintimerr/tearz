import { Asset } from 'expo-asset';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Rive, { Fit, type RiveRef } from 'rive-react-native';

import {
  RIVE_ARTBOARD,
  RIVE_MODULE,
  RIVE_STATE_MACHINE,
  RIVE_TRIGGER_IDLE,
  RIVE_TRIGGER_TALK,
  RIVE_URL,
} from './tearz-rive-source';

const RIVE_SOURCE_URL = RIVE_URL ?? Asset.fromModule(RIVE_MODULE).uri;

type Props = {
  /** Композер в фокусе/печатает. */
  focused?: boolean;
  /** Реагировать на фокус: прятаться/выглядывать + триггерить talk/idle. */
  reactToFocus?: boolean;
  /** Сыграть эмоцию при появлении (имя триггера, напр. 'talk'). */
  greeting?: string | null;
  /** Переопределение размера/стиля зоны. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Rive-маскот Tearz (артборд «Main», стейт-машина «State Machine 1»).
 * - reactToFocus: при вводе уезжает к краю/прячется и триггерит «talk», иначе «idle».
 * - greeting: при монтировании играет указанную эмоцию (напр. приветствие «talk»).
 */
export function TearzRive({ focused, reactToFocus, greeting, style }: Props) {
  const ref = useRef<RiveRef>(null);
  const peek = useRef(new Animated.Value(0)).current;
  const greeted = useRef(false);

  const fire = (trigger: string) => {
    try {
      ref.current?.fireState(RIVE_STATE_MACHINE, trigger);
    } catch {
      // стейт-машина ещё не готова — игнорируем
    }
  };

  // Реакция на фокус композера.
  useEffect(() => {
    if (!reactToFocus) return;
    Animated.timing(peek, {
      toValue: focused ? 1 : 0,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    fire(focused ? RIVE_TRIGGER_TALK : RIVE_TRIGGER_IDLE);
  }, [focused, reactToFocus, peek]);

  // Приветственная эмоция — когда Rive реально запустился (надёжнее таймера).
  const handlePlay = () => {
    if (!greeting || greeted.current) return;
    greeted.current = true;
    setTimeout(() => fire(greeting), 250);
  };

  const translateX = peek.interpolate({ inputRange: [0, 1], outputRange: [0, 76] });
  const translateY = peek.interpolate({ inputRange: [0, 1], outputRange: [0, 58] });
  const scale = peek.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] });

  return (
    <View style={[styles.zone, style]} pointerEvents="none">
      <Animated.View style={[styles.riveWrap, { transform: [{ translateX }, { translateY }, { scale }] }]}>
        <Rive
          ref={ref}
          url={RIVE_SOURCE_URL}
          artboardName={RIVE_ARTBOARD}
          stateMachineName={RIVE_STATE_MACHINE}
          autoplay
          onPlay={handlePlay}
          fit={Fit.Contain}
          style={styles.fill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { height: 200, overflow: 'hidden' },
  riveWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 236 },
  fill: { flex: 1 },
});
