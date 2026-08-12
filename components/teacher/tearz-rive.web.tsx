import { Asset } from 'expo-asset';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useStateMachineInput,
} from '@rive-app/react-canvas';

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
  focused?: boolean;
  reactToFocus?: boolean;
  greeting?: string | null;
  style?: StyleProp<ViewStyle>;
};

/** Web: тот же Tearz Rive через canvas runtime. */
export function TearzRive({ focused, reactToFocus, greeting, style }: Props) {
  const peek = useRef(new Animated.Value(0)).current;
  const greeted = useRef(false);

  const { rive, RiveComponent } = useRive({
    src: RIVE_SOURCE_URL,
    artboard: RIVE_ARTBOARD,
    stateMachines: RIVE_STATE_MACHINE,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onRiveReady: (instance) => {
      if (!greeting || greeted.current) return;
      greeted.current = true;
      setTimeout(() => {
        try {
          const input = instance
            .stateMachineInputs(RIVE_STATE_MACHINE)
            ?.find((i) => i.name === greeting);
          input?.fire();
        } catch {
          /* ignore */
        }
      }, 250);
    },
  });

  const talkInput = useStateMachineInput(rive, RIVE_STATE_MACHINE, RIVE_TRIGGER_TALK);
  const idleInput = useStateMachineInput(rive, RIVE_STATE_MACHINE, RIVE_TRIGGER_IDLE);

  useEffect(() => {
    if (!reactToFocus) return;
    Animated.timing(peek, {
      toValue: focused ? 1 : 0,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    try {
      if (focused) talkInput?.fire();
      else idleInput?.fire();
    } catch {
      /* state machine not ready */
    }
  }, [focused, reactToFocus, peek, talkInput, idleInput]);

  const translateX = peek.interpolate({ inputRange: [0, 1], outputRange: [0, 76] });
  const translateY = peek.interpolate({ inputRange: [0, 1], outputRange: [0, 58] });
  const scale = peek.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] });

  return (
    <View style={[styles.zone, style]} pointerEvents="none">
      <Animated.View style={[styles.riveWrap, { transform: [{ translateX }, { translateY }, { scale }] }]}>
        <View style={styles.fill}>
          <RiveComponent style={styles.canvas as never} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { height: 200, overflow: 'hidden' },
  riveWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 236 },
  fill: { flex: 1, width: '100%', height: '100%' },
  canvas: { width: '100%', height: '100%', display: 'block' },
});
