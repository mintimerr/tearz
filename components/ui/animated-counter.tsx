import { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

type Props = {
  value: number;
  /** Длительность анимации в мс. */
  duration?: number;
  style?: StyleProp<TextStyle>;
  /** Форматтер итогового числа. */
  format?: (n: number) => string;
  /** Текст до/после числа. */
  prefix?: string;
  suffix?: string;
};

/** Плавный «count-up» для чисел статистики — премиальный штрих вместо мгновенного появления. */
export function AnimatedCounter({
  value,
  duration = 900,
  style,
  format = (n) => String(n),
  prefix = '',
  suffix = '',
}: Props) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return (
    <Text style={style} allowFontScaling={false}>
      {prefix}
      {format(display)}
      {suffix}
    </Text>
  );
}
