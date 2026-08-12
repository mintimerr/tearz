import { Asset } from 'expo-asset';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useStateMachineInput,
} from '@rive-app/react-canvas';

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

export const RIVE_BOARD_ACTIVE = !!(RIVE_BOARD_URL || RIVE_BOARD_MODULE);

type Props = {
  width: number;
  height: number;
  director: BoardDirectorCue;
};

/** Web: тот же BoardMachine через canvas runtime. */
export function TearzBoardRive({ width, height, director }: Props) {
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
        console.warn('[TearzBoardRive.web] asset load failed', e);
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError || !uri) {
    if (loadError) {
      return <TearzBoardRig width={width} height={height} director={director} />;
    }
    return <View style={{ width, height }} pointerEvents="none" />;
  }

  return (
    <TearzBoardRiveInner
      key={uri}
      width={width}
      height={height}
      director={director}
      uri={uri}
      onError={() => setLoadError(true)}
    />
  );
}

function TearzBoardRiveInner({
  width,
  height,
  director,
  uri,
  onError,
}: Props & { uri: string; onError: () => void }) {
  const ready = useRef(false);
  const lastFiredPulse = useRef(-1);
  const idleRef = useRef<{ fire: () => void } | null>(null);

  const { rive, RiveComponent } = useRive({
    src: uri,
    artboard: RIVE_BOARD_ARTBOARD,
    stateMachines: RIVE_BOARD_STATE_MACHINE,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.BottomRight }),
    onRiveReady: (instance) => {
      ready.current = true;
      requestAnimationFrame(() => {
        try {
          instance
            .stateMachineInputs(RIVE_BOARD_STATE_MACHINE)
            ?.find((i) => i.name === RIVE_BOARD_TRIGGER.idle)
            ?.fire();
        } catch {
          idleRef.current?.fire();
        }
      });
    },
    onLoadError: () => onError(),
  });

  const strokeInput = useStateMachineInput(rive, RIVE_BOARD_STATE_MACHINE, RIVE_BOARD_TRIGGER.stroke);
  const eraseInput = useStateMachineInput(rive, RIVE_BOARD_STATE_MACHINE, RIVE_BOARD_TRIGGER.erase);
  const idleInput = useStateMachineInput(rive, RIVE_BOARD_STATE_MACHINE, RIVE_BOARD_TRIGGER.idle);
  const gazeXInput = useStateMachineInput(rive, RIVE_BOARD_STATE_MACHINE, RIVE_BOARD_INPUT.gazeX);
  const gazeYInput = useStateMachineInput(rive, RIVE_BOARD_STATE_MACHINE, RIVE_BOARD_INPUT.gazeY);
  idleRef.current = idleInput;

  useEffect(() => {
    if (!ready.current || RIVE_BOARD_LEGACY_BOOTSTRAP) return;
    try {
      if (gazeXInput && typeof gazeXInput.value === 'number') {
        gazeXInput.value = director.gazeBoard * 100;
      }
      if (gazeYInput && typeof gazeYInput.value === 'number') {
        gazeYInput.value = director.gazeLine * 100;
      }
    } catch {
      /* gaze inputs may be absent */
    }
  }, [director.gazeBoard, director.gazeLine, gazeXInput, gazeYInput]);

  useEffect(() => {
    if (!ready.current) return;
    if (director.pulse === lastFiredPulse.current) return;
    lastFiredPulse.current = director.pulse;

    const trigger = director.riveTrigger;
    if (!trigger || trigger === 'look' || trigger === 'focus') return;

    const mapped =
      trigger === 'stroke' ? strokeInput : trigger === 'erase' ? eraseInput : null;
    if (!mapped) return;
    requestAnimationFrame(() => {
      try {
        mapped.fire();
      } catch {
        /* ignore */
      }
    });
  }, [director.pulse, director.riveTrigger, strokeInput, eraseInput]);

  return (
    <View style={[styles.root, { width, height }]} pointerEvents="none">
      <RiveComponent style={styles.canvas as never} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'visible',
  },
  canvas: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
});
