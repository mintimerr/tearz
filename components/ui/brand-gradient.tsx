import { useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { APP_THEME } from '@/constants/theme';

type Props = {
  /** Цвета градиента (по умолчанию сигнатурный синий → cyan). */
  colors?: readonly string[];
  /** Угол: 'diagonal' | 'horizontal' | 'vertical'. */
  direction?: 'diagonal' | 'horizontal' | 'vertical';
  style?: StyleProp<ViewStyle>;
  /** Прозрачность всего слоя. */
  opacity?: number;
  borderRadius?: number;
};

let gradIdSeq = 0;

/** Заливка фирменным градиентом через SVG (без новых нативных зависимостей). */
export function BrandGradient({
  colors = APP_THEME.brandGradient,
  direction = 'diagonal',
  style,
  opacity = 1,
  borderRadius = 0,
}: Props) {
  const idRef = useRef<string | undefined>(undefined);
  if (!idRef.current) idRef.current = `tearz-grad-${gradIdSeq++}`;
  const id = idRef.current;
  const coords =
    direction === 'horizontal'
      ? { x1: '0', y1: '0', x2: '1', y2: '0' }
      : direction === 'vertical'
        ? { x1: '0', y1: '0', x2: '0', y2: '1' }
        : { x1: '0', y1: '0', x2: '1', y2: '1' };

  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} {...coords}>
            {colors.map((c, i) => (
              <Stop
                key={i}
                offset={`${(i / Math.max(1, colors.length - 1)) * 100}%`}
                stopColor={c}
                stopOpacity={opacity}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
