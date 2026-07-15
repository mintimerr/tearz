import Constants from 'expo-constants';
import { Asset } from 'expo-asset';
import { useCallback, useEffect, useRef, useState, Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Rive, { Alignment, Fit, type RiveRef } from 'rive-react-native';

import type { BoardDirectorCue } from '@/hooks/use-board-director';
import {
  RIVE_BOARD_ARTBOARD,
  RIVE_BOARD_INPUT,
  RIVE_BOARD_LEGACY_BOOTSTRAP,
  RIVE_BOARD_MODULE,
  RIVE_BOARD_STATE_MACHINE,
  RIVE_BOARD_TRIGGER,
  RIVE_BOARD_URL,
} from './tearz-board-rive-source';
import { TearzBoardRig } from './tearz-board-rig';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

export const RIVE_BOARD_ACTIVE = !!(RIVE_BOARD_URL || RIVE_BOARD_MODULE) && !IS_EXPO_GO;

type Props = {
  width: number;
  height: number;
  director: BoardDirectorCue;
};

class RiveBoardErrorBoundary extends Component<
  { width: number; height: number; director: BoardDirectorCue; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.warn('[TearzBoardRive] fell back to sprite rig:', err);
  }

  render() {
    if (this.state.failed) {
      return (
        <TearzBoardRig
          width={this.props.width}
          height={this.props.height}
          director={this.props.director}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * Tearz у доски — Rive BoardMachine.
 * Каждый pulse → один trigger. При падении native view → sprite rig.
 */
export function TearzBoardRive({ width, height, director }: Props) {
  return (
    <RiveBoardErrorBoundary width={width} height={height} director={director}>
      <TearzBoardRiveInner width={width} height={height} director={director} />
    </RiveBoardErrorBoundary>
  );
}

function TearzBoardRiveInner({ width, height, director }: Props) {
  const ref = useRef<RiveRef>(null);
  const ready = useRef(false);
  const lastFiredPulse = useRef(-1);
  const [uri, setUri] = useState<string | null>(RIVE_BOARD_URL);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (RIVE_BOARD_URL) {
      setUri(RIVE_BOARD_URL);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(RIVE_BOARD_MODULE);
        await asset.downloadAsync();
        const next = asset.localUri ?? asset.uri;
        if (!cancelled && next) setUri(next);
      } catch (e) {
        console.warn('[TearzBoardRive] asset load failed', e);
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
      ready.current = false;
    };
  }, []);

  const fire = useCallback((trigger: string) => {
    if (!ready.current || !trigger || !ref.current) return;
    try {
      ref.current.fireState(RIVE_BOARD_STATE_MACHINE, trigger);
    } catch {
      // view ещё не привязан / уже размонтирован
    }
  }, []);

  const setNumber = useCallback((name: string, value: number) => {
    if (!ready.current || RIVE_BOARD_LEGACY_BOOTSTRAP || !ref.current) return;
    try {
      ref.current.setInputState(RIVE_BOARD_STATE_MACHINE, name, value);
    } catch {
      // gaze inputs могут отсутствовать
    }
  }, []);

  const handlePlay = useCallback(() => {
    ready.current = true;
    // Не стрелять в тот же тик, что mount — иначе «Could not find view with tag»
    requestAnimationFrame(() => {
      if (!ready.current) return;
      fire(RIVE_BOARD_TRIGGER.idle);
    });
  }, [fire]);

  const handleError = useCallback(() => {
    ready.current = false;
    setLoadError(true);
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    setNumber(RIVE_BOARD_INPUT.gazeX, director.gazeBoard * 100);
    setNumber(RIVE_BOARD_INPUT.gazeY, director.gazeLine * 100);
  }, [director.gazeBoard, director.gazeLine, setNumber]);

  useEffect(() => {
    if (!ready.current) return;
    if (director.pulse === lastFiredPulse.current) return;
    lastFiredPulse.current = director.pulse;

    const trigger = director.riveTrigger;
    if (!trigger) return;

    // look/focus пока без анимаций в .riv — не дёргаем (меньше риска crash)
    if (trigger === 'look' || trigger === 'focus') return;

    const mapped =
      trigger === 'stroke'
        ? RIVE_BOARD_TRIGGER.stroke
        : trigger === 'erase'
          ? RIVE_BOARD_TRIGGER.erase
          : null;

    if (mapped) {
      requestAnimationFrame(() => fire(mapped));
    }
  }, [director.pulse, director.riveTrigger, fire]);

  if (loadError || !uri) {
    if (loadError) {
      return <TearzBoardRig width={width} height={height} director={director} />;
    }
    return <View style={{ width, height }} pointerEvents="none" />;
  }

  return (
    <View style={[styles.root, { width, height }]} pointerEvents="none" collapsable={false}>
      <Rive
        ref={ref}
        url={uri}
        artboardName={RIVE_BOARD_ARTBOARD}
        stateMachineName={RIVE_BOARD_STATE_MACHINE}
        autoplay
        onPlay={handlePlay}
        onError={handleError}
        fit={Fit.Contain}
        alignment={Alignment.BottomRight}
        style={styles.fill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'visible',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});
