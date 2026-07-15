import { StyleSheet, View } from 'react-native';
import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path, Polygon, Rect } from 'react-native-svg';

import { APP_THEME } from '@/constants/theme';
import type { WordScriptLang } from '@/utils/detect-word-lang';

const OUTLINE = '#3a2f55';
const STROKE = 2.6;

/** Пятиконечная звезда: outer / inner радиусы, поворот в градусах */
function starPoints(cx: number, cy: number, outer: number, inner: number, rotDeg: number): string {
  const rot = (rotDeg * Math.PI) / 180;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (Math.PI / 2 + (i * Math.PI) / 5);
    const x = cx + r * Math.cos(a);
    const y = cy - r * Math.sin(a);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(' ');
}

function FlagUk() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 72 48" preserveAspectRatio="xMidYMid meet">
      <Rect
        x={3}
        y={3}
        width={66}
        height={42}
        rx={6}
        ry={6}
        fill="#2f6fdb"
        stroke={OUTLINE}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Path
        d="M 12 8 L 60 40 M 60 8 L 12 40"
        stroke="#f8fafc"
        strokeWidth={11}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M 12 8 L 60 40 M 60 8 L 12 40"
        stroke="#e11d48"
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x={30} y={8} width={12} height={32} rx={1} fill="#f8fafc" stroke={OUTLINE} strokeWidth={1.2} />
      <Rect x={8} y={18} width={56} height={12} rx={1} fill="#f8fafc" stroke={OUTLINE} strokeWidth={1.2} />
      <Rect x={33} y={8} width={6} height={32} rx={0.5} fill="#e11d48" />
      <Rect x={8} y={21} width={56} height={6} rx={0.5} fill="#e11d48" />
    </Svg>
  );
}

function FlagCn() {
  const big = starPoints(16, 16, 7.2, 2.9, 0);
  const s1 = starPoints(30, 8, 2.5, 1.0, 22);
  const s2 = starPoints(33, 13, 2.5, 1.0, 48);
  const s3 = starPoints(33, 19, 2.5, 1.0, 12);
  const s4 = starPoints(30, 24, 2.5, 1.0, 62);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 72 48" preserveAspectRatio="xMidYMid meet">
      <Rect
        x={3}
        y={3}
        width={66}
        height={42}
        rx={6}
        ry={6}
        fill="#f23a3a"
        stroke={OUTLINE}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Polygon points={big} fill="#ffd84d" stroke={OUTLINE} strokeWidth={1.4} strokeLinejoin="round" />
      <Polygon points={s1} fill="#ffd84d" stroke={OUTLINE} strokeWidth={1} strokeLinejoin="round" />
      <Polygon points={s2} fill="#ffd84d" stroke={OUTLINE} strokeWidth={1} strokeLinejoin="round" />
      <Polygon points={s3} fill="#ffd84d" stroke={OUTLINE} strokeWidth={1} strokeLinejoin="round" />
      <Polygon points={s4} fill="#ffd84d" stroke={OUTLINE} strokeWidth={1} strokeLinejoin="round" />
    </Svg>
  );
}

function FlagRu() {
  const rid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const clip = `tearzFlagRu${rid}`;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 72 48" preserveAspectRatio="xMidYMid meet">
      <Defs>
        <ClipPath id={clip}>
          <Rect x={3} y={3} width={66} height={42} rx={6} ry={6} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clip})`}>
        <Rect x={3} y={3} width={66} height={14} fill="#f8fafc" />
        <Rect x={3} y={17} width={66} height={14} fill="#2f6fdb" />
        <Rect x={3} y={31} width={66} height={14} fill="#e11d48" />
      </G>
      <Rect
        x={3}
        y={3}
        width={66}
        height={42}
        rx={6}
        ry={6}
        fill="none"
        stroke={OUTLINE}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FlagForLang({ code }: { code: WordScriptLang }) {
  if (code === 'zh') return <FlagCn />;
  if (code === 'ru') return <FlagRu />;
  return <FlagUk />;
}

const LABEL: Record<WordScriptLang, string> = {
  en: 'English',
  zh: '中文',
  ru: 'Русский',
};

type Props = {
  langs: WordScriptLang[];
};

/** Одна строка мультяшных флагов языков из словаря */
export function CartoonStudyFlagsRow({ langs }: Props) {
  if (!langs.length) {
    return null;
  }
  return (
    <View style={styles.row}>
      {langs.map((code) => (
        <View
          key={code}
          style={styles.bubble}
          accessibilityRole="image"
          accessibilityLabel={LABEL[code]}>
          <View style={styles.flagFrame}>
            <FlagForLang code={code} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  bubble: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: APP_THEME.color.accentSoft,
  },
  flagFrame: {
    width: 72,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
