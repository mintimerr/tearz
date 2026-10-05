import * as Haptics from '@/utils/safe-haptics';
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
import Animated, {
  Easing,
  LinearTransition,
  ZoomIn,
  ZoomOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { drillTaskStyles as styles } from '@/components/teacher/teacher-drill-styles';
import { GAME_THEME } from '@/constants/game-theme';

type Rect = { x: number; y: number; width: number; height: number };
type DropMeasure = () => Promise<Rect>;
export type DropTargetRegistry = Map<string, DropMeasure>;

type AssignHandler = (targetId: string, word: string, chipIndex: number) => void;

type WordDragApi = {
  registerDrop: (id: string, measure: DropMeasure) => void;
  unregisterDrop: (id: string) => void;
  setAssignHandler: (handler: AssignHandler) => void;
  setHoverDropId: (id: string | null) => void;
  hoverDropId: string | null;
  isDragging: boolean;
  setDragging: (v: boolean) => void;
  /** Быстрый hit-test по кэшу (без measure каждый кадр). */
  findDropAtCached: (x: number, y: number) => string | null;
  /** Перемерить все drop-зоны (на старте драга). */
  refreshDropCache: () => Promise<void>;
  findDropAt: (x: number, y: number) => Promise<string | null>;
  assignToDrop: (targetId: string, word: string, chipIndex: number) => void;
};

const WordDragContext = createContext<WordDragApi | null>(null);

const SPRING_RETURN = { damping: 20, stiffness: 220, mass: 0.7 };
const SPRING_POP = { damping: 18, stiffness: 320, mass: 0.45 };

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

/** Блокировка скролла во время перетаскивания. */
export function useWordDragScrollLock() {
  return useContext(WordDragContext)?.isDragging ?? false;
}

export function registerDropTarget(registry: DropTargetRegistry, id: string, measure: DropMeasure) {
  registry.set(id, measure);
}

export function unregisterDropTarget(registry: DropTargetRegistry, id: string) {
  registry.delete(id);
}

async function findDropTargetAt(registry: DropTargetRegistry, x: number, y: number, padding = 28) {
  let best: { id: string; dist: number } | null = null;
  for (const [id, measure] of registry) {
    const r = await measure();
    const inside =
      x >= r.x - padding &&
      x <= r.x + r.width + padding &&
      y >= r.y - padding &&
      y <= r.y + r.height + padding;
    if (!inside) continue;
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const dist = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (!best || dist < best.dist) best = { id, dist };
  }
  return best?.id ?? null;
}

function hapticDragStart() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function hapticDropSuccess() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

function hapticReturn() {
  void Haptics.selectionAsync();
}

export function WordDragProvider({ children }: { children: ReactNode }) {
  const registryRef = useRef<DropTargetRegistry>(new Map());
  const cacheRef = useRef<Map<string, Rect>>(new Map());
  const assignRef = useRef<AssignHandler>(() => {});
  const [hoverDropId, setHoverDropId] = useState<string | null>(null);
  const [isDragging, setDragging] = useState(false);

  const findDropAt = useCallback(
    (x: number, y: number) => findDropTargetAt(registryRef.current, x, y),
    [],
  );

  const refreshDropCache = useCallback(async () => {
    const next = new Map<string, Rect>();
    for (const [id, measure] of registryRef.current) {
      next.set(id, await measure());
    }
    cacheRef.current = next;
  }, []);

  const findDropAtCached = useCallback((x: number, y: number) => {
    const padding = 28;
    let best: { id: string; dist: number } | null = null;
    for (const [id, r] of cacheRef.current) {
      const inside =
        x >= r.x - padding &&
        x <= r.x + r.width + padding &&
        y >= r.y - padding &&
        y <= r.y + r.height + padding;
      if (!inside) continue;
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const dist = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (!best || dist < best.dist) best = { id, dist };
    }
    return best?.id ?? null;
  }, []);

  const assignToDrop = useCallback((targetId: string, word: string, chipIndex: number) => {
    assignRef.current(targetId, word, chipIndex);
    hapticDropSuccess();
  }, []);

  const api = useMemo<WordDragApi>(
    () => ({
      registerDrop: (id, measure) => registerDropTarget(registryRef.current, id, measure),
      unregisterDrop: (id) => unregisterDropTarget(registryRef.current, id),
      setAssignHandler: (handler) => {
        assignRef.current = handler;
      },
      setHoverDropId,
      hoverDropId,
      isDragging,
      setDragging,
      findDropAtCached,
      refreshDropCache,
      findDropAt,
      assignToDrop,
    }),
    [assignToDrop, findDropAt, findDropAtCached, hoverDropId, isDragging, refreshDropCache],
  );

  return <WordDragContext.Provider value={api}>{children}</WordDragContext.Provider>;
}

export function DrillDropZone({
  id,
  children,
  style,
  onPress,
  onClear,
}: {
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** Утащить в любую сторону — убрать слово из пропуска. */
  onClear?: () => void;
}) {
  const { registerDrop, unregisterDrop, hoverDropId } = useWordDrag();
  const ref = useRef<View>(null);
  const hovered = hoverDropId === id;
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

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

  const clearJS = useCallback(() => {
    onClear?.();
    tx.value = 0;
    ty.value = 0;
    scale.value = 1;
    opacity.value = 1;
  }, [onClear, opacity, scale, tx, ty]);

  const resetJS = useCallback(() => {
    tx.value = withSpring(0, SPRING_RETURN);
    ty.value = withSpring(0, SPRING_RETURN);
    scale.value = withSpring(1, SPRING_POP);
    opacity.value = withTiming(1, { duration: 160 });
  }, [opacity, scale, tx, ty]);

  const panClear = Gesture.Pan()
    .enabled(Boolean(onClear))
    .minDistance(8)
    .onUpdate((e) => {
      'worklet';
      tx.value = e.translationX;
      ty.value = e.translationY;
      const dist = Math.hypot(e.translationX, e.translationY);
      opacity.value = Math.max(0.35, 1 - dist / 140);
      scale.value = 1 + Math.min(0.08, dist / 400);
    })
    .onEnd((e) => {
      'worklet';
      const dist = Math.hypot(e.translationX, e.translationY);
      // Утащили в любую сторону достаточно далеко — вернуть в банк.
      if (dist > 42) {
        runOnJS(clearJS)();
      } else {
        runOnJS(resetJS)();
      }
    });

  const tap = Gesture.Tap()
    .enabled(Boolean(onPress))
    .maxDuration(240)
    .onEnd(() => {
      'worklet';
      if (onPress) runOnJS(onPress)();
    });

  const gesture = onClear ? Gesture.Exclusive(panClear, tap) : tap;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const body = (
    <Animated.View collapsable={false} style={[style, hovered && stylesHost.dropHovered, animStyle]}>
      {children}
    </Animated.View>
  );

  return (
    <View ref={ref} onLayout={sync} collapsable={false}>
      {onClear || onPress ? <GestureDetector gesture={gesture}>{body}</GestureDetector> : body}
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
  const { findDropAt, findDropAtCached, refreshDropCache, assignToDrop, setHoverDropId, setDragging } =
    useWordDrag();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const elev = useSharedValue(0);
  const handled = useSharedValue(false);
  const [lifting, setLifting] = useState(false);

  useEffect(() => {
    if (isUsed) {
      opacity.value = 0.36;
      tx.value = 0;
      ty.value = 0;
      scale.value = 1;
      elev.value = 0;
      setLifting(false);
    } else {
      opacity.value = 1;
    }
  }, [elev, isUsed, opacity, scale, tx, ty]);

  const springHome = useCallback(() => {
    setHoverDropId(null);
    setDragging(false);
    setLifting(false);
    hapticReturn();
    tx.value = withSpring(0, SPRING_RETURN);
    ty.value = withSpring(0, SPRING_RETURN);
    scale.value = withSpring(1, SPRING_POP);
    elev.value = 0;
  }, [elev, scale, setDragging, setHoverDropId, tx, ty]);

  const finishAssign = useCallback(
    (targetId: string) => {
      assignToDrop(targetId, word, index);
      tx.value = 0;
      ty.value = 0;
      scale.value = 1;
      elev.value = 0;
      opacity.value = 0.36;
      setLifting(false);
      setDragging(false);
      setHoverDropId(null);
    },
    [assignToDrop, elev, index, opacity, scale, setDragging, setHoverDropId, tx, ty, word],
  );

  const snapSuccess = useCallback(
    (targetId: string) => {
      scale.value = withTiming(0.9, { duration: 110, easing: Easing.out(Easing.cubic) });
      opacity.value = withTiming(0, { duration: 130, easing: Easing.out(Easing.cubic) }, (done) => {
        if (!done) return;
        runOnJS(finishAssign)(targetId);
      });
    },
    [finishAssign, opacity, scale],
  );

  const onDragEndJS = useCallback(
    async (absX: number, absY: number) => {
      const targetId = (await findDropAt(absX, absY)) ?? findDropAtCached(absX, absY);
      if (targetId) {
        snapSuccess(targetId);
      } else {
        springHome();
      }
    },
    [findDropAt, findDropAtCached, snapSuccess, springHome],
  );

  const startDragJS = useCallback(() => {
    setDragging(true);
    setLifting(true);
    hapticDragStart();
    void refreshDropCache();
  }, [refreshDropCache, setDragging]);

  const cancelDragJS = useCallback(() => {
    springHome();
  }, [springHome]);

  const pan = Gesture.Pan()
    .enabled(!disabled && !isUsed)
    .minDistance(4)
    .averageTouches(true)
    .onBegin(() => {
      'worklet';
      handled.value = false;
    })
    .onStart(() => {
      'worklet';
      elev.value = 1;
      scale.value = withSpring(1.1, SPRING_POP);
      runOnJS(startDragJS)();
    })
    .onUpdate((e) => {
      'worklet';
      // Только UI-thread — без runOnJS на кадр (главный источник 30 fps).
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      if (handled.value) return;
      handled.value = true;
      runOnJS(onDragEndJS)(e.absoluteX, e.absoluteY);
    })
    .onFinalize((_e, success) => {
      'worklet';
      if (!success && !handled.value) {
        handled.value = true;
        runOnJS(cancelDragJS)();
      }
    });

  const tap = Gesture.Tap()
    .enabled(!disabled && !isUsed)
    .maxDuration(220)
    .onEnd(() => {
      'worklet';
      runOnJS(onTap)(word, index);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    zIndex: elev.value > 0.5 ? 90 : 1,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        collapsable={false}
        style={[
          styles.bankChip,
          stylesHost.chipBase,
          selected && styles.bankChipSelected,
          isUsed && styles.bankChipUsed,
          lifting && stylesHost.chipLifted,
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

/** Чип в собранной строке: тап → назад в банк; drag → поменять местами / вернуть. */
function AssembledWordChip({
  word,
  index,
  disabled,
  onRemove,
  onReorder,
}: {
  word: string;
  index: number;
  disabled: boolean;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const { setDragging } = useWordDrag();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const elev = useSharedValue(0);
  const handled = useSharedValue(false);
  const startIndex = useSharedValue(index);
  const chipWidth = useSharedValue(72);

  useEffect(() => {
    startIndex.value = index;
  }, [index, startIndex]);

  const finishHome = useCallback(() => {
    setDragging(false);
    tx.value = withSpring(0, SPRING_RETURN);
    ty.value = withSpring(0, SPRING_RETURN);
    scale.value = withSpring(1, SPRING_POP);
    elev.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [elev, scale, setDragging, tx, ty]);

  const animateRemove = useCallback(
    (slotIndex: number) => {
      hapticReturn();
      scale.value = withTiming(0.82, { duration: 140, easing: Easing.out(Easing.cubic) });
      opacity.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) }, (done) => {
        if (!done) return;
        runOnJS(onRemove)(slotIndex);
      });
    },
    [onRemove, opacity, scale],
  );

  const commitReorder = useCallback(
    (from: number, translationX: number, translationY: number, width: number) => {
      // Утащили вниз / далеко — вернуть в банк
      if (translationY > 56 || Math.hypot(translationX, translationY) > 140) {
        animateRemove(from);
        setDragging(false);
        return;
      }
      const step = Math.max(40, width + 10);
      const delta = Math.round(translationX / step);
      const to = Math.max(0, from + delta);
      if (to !== from) {
        hapticDropSuccess();
        onReorder(from, to);
      } else {
        hapticReturn();
      }
      finishHome();
    },
    [animateRemove, finishHome, onReorder, setDragging],
  );

  const startDragJS = useCallback(() => {
    setDragging(true);
    hapticDragStart();
  }, [setDragging]);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(6)
    .onBegin(() => {
      'worklet';
      handled.value = false;
    })
    .onStart(() => {
      'worklet';
      elev.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) });
      scale.value = withSpring(1.1, SPRING_POP);
      runOnJS(startDragJS)();
    })
    .onUpdate((e) => {
      'worklet';
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      if (handled.value) return;
      handled.value = true;
      runOnJS(commitReorder)(startIndex.value, e.translationX, e.translationY, chipWidth.value);
    })
    .onFinalize((_e, success) => {
      'worklet';
      if (!success && !handled.value) {
        handled.value = true;
        runOnJS(finishHome)();
      }
    });

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDuration(240)
    .onEnd(() => {
      'worklet';
      runOnJS(animateRemove)(index);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    zIndex: elev.value > 0.02 ? 80 : 1,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
    shadowOpacity: 0.12 + elev.value * 0.28,
    shadowRadius: 4 + elev.value * 14,
    shadowOffset: { width: 0, height: 2 + elev.value * 10 },
    elevation: elev.value > 0.02 ? 12 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        collapsable={false}
        entering={ZoomIn.springify().damping(16).stiffness(280)}
        exiting={ZoomOut.duration(160)}
        layout={LinearTransition.springify().damping(18).stiffness(240)}
        onLayout={(e) => {
          chipWidth.value = e.nativeEvent.layout.width;
        }}
        style={[styles.bankChip, stylesHost.assembledChip, animStyle]}>
        <Text style={styles.bankChipText}>{word}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Сборка предложения: drag из банка → в строку; reorder в строке; тап → назад.
 */
export function SentenceOrderBoard({
  bankWords,
  placedIndices,
  disabled,
  onChange,
  emptyHint,
  sectionLabelBuilt,
  sectionLabelWords,
}: {
  bankWords: string[];
  placedIndices: number[];
  disabled: boolean;
  onChange: (nextIndices: number[]) => void;
  emptyHint: string;
  sectionLabelBuilt: string;
  sectionLabelWords: string;
}) {
  const used = useMemo(() => new Set(placedIndices), [placedIndices]);

  const appendWord = useCallback(
    (bankIndex: number) => {
      if (used.has(bankIndex) || disabled) return;
      onChange([...placedIndices, bankIndex]);
    },
    [disabled, onChange, placedIndices, used],
  );

  const removeAt = useCallback(
    (slotIndex: number) => {
      if (disabled) return;
      onChange(placedIndices.filter((_, i) => i !== slotIndex));
    },
    [disabled, onChange, placedIndices],
  );

  const reorder = useCallback(
    (from: number, toRaw: number) => {
      if (disabled) return;
      const to = Math.max(0, Math.min(placedIndices.length - 1, toRaw));
      if (from === to) return;
      const next = [...placedIndices];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      onChange(next);
    },
    [disabled, onChange, placedIndices],
  );

  return (
    <View style={stylesHost.assemblyRoot}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{sectionLabelBuilt}</Text>
        <DrillDropZone id="sentence" style={[styles.sentenceBuilt, stylesHost.sentenceDrop]}>
          {placedIndices.length === 0 ? (
            <Text style={[styles.sentenceBuiltText, stylesHost.emptyHint]}>{emptyHint}</Text>
          ) : (
            <View style={stylesHost.assembledRow}>
              {placedIndices.map((bankIndex, slotIndex) => (
                <AssembledWordChip
                  key={`placed-${bankIndex}`}
                  word={bankWords[bankIndex] ?? ''}
                  index={slotIndex}
                  disabled={disabled}
                  onRemove={removeAt}
                  onReorder={reorder}
                />
              ))}
            </View>
          )}
        </DrillDropZone>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{sectionLabelWords}</Text>
        <DraggableWordBank
          words={bankWords}
          usedIndices={used}
          selectedIndex={null}
          disabled={disabled}
          onTap={(_word, index) => {
            void Haptics.selectionAsync();
            appendWord(index);
          }}
        />
      </View>
    </View>
  );
}

const stylesHost = StyleSheet.create({
  bankRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    overflow: 'visible',
    zIndex: 2,
  },
  chipBase: {
    shadowColor: '#1A3A7A',
    backgroundColor: GAME_THEME.color.cream,
  },
  chipLifted: {
    shadowColor: '#1A3A7A',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  dropHovered: {
    borderColor: GAME_THEME.color.sky,
    backgroundColor: GAME_THEME.color.paperWarm,
    transform: [{ scale: 1.02 }],
  },
  assemblyRoot: {
    gap: 16,
    overflow: 'visible',
  },
  sentenceDrop: {
    flexWrap: 'wrap',
    minHeight: 72,
    overflow: 'visible',
  },
  assembledRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  assembledChip: {
    shadowColor: '#1A3A7A',
    backgroundColor: GAME_THEME.color.paperWarm,
  },
  emptyHint: {
    color: 'rgba(26,26,26,0.42)',
    fontWeight: '600',
  },
});
