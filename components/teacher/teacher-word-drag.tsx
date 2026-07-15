import * as Haptics from 'expo-haptics';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { drillTaskStyles as styles } from '@/components/teacher/teacher-drill-styles';
import { APP_THEME } from '@/constants/theme';

type Rect = { x: number; y: number; width: number; height: number };
type DropMeasure = () => Promise<Rect>;
export type DropTargetRegistry = Map<string, DropMeasure>;

type Ghost = {
  word: string;
  chipIndex: number;
  fingerX: number;
  fingerY: number;
  offsetX: number;
  offsetY: number;
};

type AssignHandler = (targetId: string, word: string, chipIndex: number) => void;

type WordDragApi = {
  registerDrop: (id: string, measure: DropMeasure) => void;
  unregisterDrop: (id: string) => void;
  setAssignHandler: (handler: AssignHandler) => void;
};

const WordDragContext = createContext<WordDragApi | null>(null);

function useWordDrag() {
  const ctx = useContext(WordDragContext);
  if (!ctx) throw new Error('WordDragProvider missing');
  return ctx;
}

export function useWordDragAssign(handler: AssignHandler) {
  const api = useContext(WordDragContext);
  useEffect(() => {
    if (!api) return;
    api.setAssignHandler(handler);
  }, [api, handler]);
}

export function registerDropTarget(registry: DropTargetRegistry, id: string, measure: DropMeasure) {
  registry.set(id, measure);
}

export function unregisterDropTarget(registry: DropTargetRegistry, id: string) {
  registry.delete(id);
}

async function findDropTargetAt(registry: DropTargetRegistry, x: number, y: number, padding = 22) {
  for (const [id, measure] of registry) {
    const r = await measure();
    if (
      x >= r.x - padding &&
      x <= r.x + r.width + padding &&
      y >= r.y - padding &&
      y <= r.y + r.height + padding
    ) {
      return id;
    }
  }
  return null;
}

function hapticDragStart() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function hapticDropSuccess() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

type DragBridge = {
  start: (
    word: string,
    index: number,
    fingerX: number,
    fingerY: number,
    offsetX: number,
    offsetY: number,
  ) => void;
  move: (fingerX: number, fingerY: number) => void;
  end: (fingerX: number, fingerY: number) => void;
};

const dragBridge: DragBridge = {
  start: () => {},
  move: () => {},
  end: () => {},
};

export function WordDragProvider({ children }: { children: ReactNode }) {
  const registryRef = useRef<DropTargetRegistry>(new Map());
  const assignRef = useRef<AssignHandler>(() => {});
  const overlayRef = useRef<View>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [overlayOrigin, setOverlayOrigin] = useState({ x: 0, y: 0 });

  const refreshOverlayOrigin = useCallback(() => {
    overlayRef.current?.measureInWindow((x, y) => {
      setOverlayOrigin({ x, y });
    });
  }, []);

  const endDrag = useCallback(async (fingerX: number, fingerY: number, session: Ghost) => {
    const targetId = await findDropTargetAt(registryRef.current, fingerX, fingerY);
    if (targetId) {
      assignRef.current(targetId, session.word, session.chipIndex);
      hapticDropSuccess();
    }
  }, []);

  dragBridge.start = (word, chipIndex, fingerX, fingerY, offsetX, offsetY) => {
    hapticDragStart();
    overlayRef.current?.measureInWindow((ox, oy) => {
      setOverlayOrigin({ x: ox, y: oy });
      setGhost({ word, chipIndex, fingerX, fingerY, offsetX, offsetY });
    });
  };
  dragBridge.move = (fingerX, fingerY) => {
    setGhost((prev) => (prev ? { ...prev, fingerX, fingerY } : null));
  };
  dragBridge.end = (fingerX, fingerY) => {
    setGhost((prev) => {
      if (prev) void endDrag(fingerX, fingerY, prev);
      return null;
    });
  };

  const api = useMemo<WordDragApi>(
    () => ({
      registerDrop: (id, measure) => registerDropTarget(registryRef.current, id, measure),
      unregisterDrop: (id) => unregisterDropTarget(registryRef.current, id),
      setAssignHandler: (handler) => {
        assignRef.current = handler;
      },
    }),
    [],
  );

  const ghostLeft = ghost ? ghost.fingerX - overlayOrigin.x - ghost.offsetX : 0;
  const ghostTop = ghost ? ghost.fingerY - overlayOrigin.y - ghost.offsetY : 0;

  return (
    <WordDragContext.Provider value={api}>
      <View style={stylesHost.host}>
        {children}
        <View
          ref={overlayRef}
          onLayout={refreshOverlayOrigin}
          style={stylesHost.overlay}
          pointerEvents="box-none">
          {ghost ? (
            <View
              style={[
                styles.bankChip,
                stylesHost.ghostChip,
                { left: ghostLeft, top: ghostTop },
              ]}>
              <Text style={styles.bankChipText}>{ghost.word}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </WordDragContext.Provider>
  );
}

export function DrillDropZone({
  id,
  children,
  style,
  onPress,
}: {
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const { registerDrop, unregisterDrop } = useWordDrag();
  const ref = useRef<View>(null);

  const sync = useCallback(() => {
    registerDrop(id, () =>
      new Promise<Rect>((resolve) => {
        ref.current?.measureInWindow((x, y, width, height) => {
          resolve({ x, y, width, height });
        });
      }),
    );
  }, [id, registerDrop]);

  useEffect(() => {
    sync();
    return () => unregisterDrop(id);
  }, [id, sync, unregisterDrop]);

  if (onPress) {
    return (
      <View ref={ref} onLayout={sync} collapsable={false}>
        <Pressable onPress={onPress} style={style}>
          {children}
        </Pressable>
      </View>
    );
  }

  return (
    <View ref={ref} onLayout={sync} collapsable={false} style={style}>
      {children}
    </View>
  );
}

function DraggableWordChip({
  word,
  index,
  disabled,
  isUsed,
  selected,
  onTap,
}: {
  word: string;
  index: number;
  disabled: boolean;
  isUsed: boolean;
  selected: boolean;
  onTap: (word: string, index: number) => void;
}) {
  const chipRef = useRef<View>(null);
  const scale = useSharedValue(1);
  const dragging = useSharedValue(false);

  const handleDragStart = useCallback((fingerX: number, fingerY: number) => {
    chipRef.current?.measureInWindow((x, y) => {
      dragBridge.start(word, index, fingerX, fingerY, fingerX - x, fingerY - y);
    });
  }, [index, word]);

  const pan = Gesture.Pan()
    .enabled(!disabled && !isUsed)
    .minDistance(4)
    .onStart((e) => {
      dragging.value = true;
      scale.value = 1.04;
      runOnJS(handleDragStart)(e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      runOnJS(dragBridge.move)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      dragging.value = false;
      scale.value = 1;
      runOnJS(dragBridge.end)(e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      dragging.value = false;
      scale.value = withSpring(1);
    });

  const tap = Gesture.Tap()
    .enabled(!disabled && !isUsed)
    .onEnd(() => {
      runOnJS(onTap)(word, index);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  const animStyle = useAnimatedStyle(() => ({
    opacity: dragging.value ? 0.28 : 1,
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        ref={chipRef}
        collapsable={false}
        style={[
          styles.bankChip,
          selected && styles.bankChipSelected,
          isUsed && styles.bankChipUsed,
          animStyle,
        ]}>
        <Text style={[styles.bankChipText, isUsed && styles.bankChipTextUsed]}>{word}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

export function DraggableWordBank({
  words,
  usedIndices,
  selectedIndex,
  disabled,
  onTap,
}: {
  words: string[];
  usedIndices: Set<number>;
  selectedIndex: number | null;
  disabled: boolean;
  onTap: (word: string, index: number) => void;
}) {
  return (
    <View style={stylesHost.bankRow}>
      {words.map((word, wi) => (
        <DraggableWordChip
          key={`${word}-${wi}`}
          word={word}
          index={wi}
          disabled={disabled}
          isUsed={usedIndices.has(wi)}
          selected={selectedIndex === wi}
          onTap={onTap}
        />
      ))}
    </View>
  );
}

const stylesHost = StyleSheet.create({
  host: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    elevation: 2000,
  },
  ghostChip: {
    position: 'absolute',
    borderColor: APP_THEME.color.borderStrong,
    backgroundColor: 'rgba(22, 22, 24, 0.96)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  bankRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    overflow: 'visible',
  },
});
