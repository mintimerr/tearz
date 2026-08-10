import * as Haptics from 'expo-haptics';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';

import { GAME_THEME } from '@/constants/game-theme';
import { useAuth, type NativeLanguage } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/locale-context';

const LANGS: NativeLanguage[] = ['ru', 'zh', 'en'];

type Props = {
  top: number;
};

function FlagRu() {
  return (
    <View style={flagStyles.frame}>
      <View style={[flagStyles.stripe, { backgroundColor: '#FFFFFF' }]} />
      <View style={[flagStyles.stripe, { backgroundColor: '#0039A6' }]} />
      <View style={[flagStyles.stripe, { backgroundColor: '#D52B1E' }]} />
    </View>
  );
}

function FlagZh() {
  return (
    <View style={[flagStyles.frame, flagStyles.zh]}>
      <Text style={flagStyles.star}>★</Text>
    </View>
  );
}

/** Ровный Union Jack через SVG (без rotate View) */
function FlagUk() {
  const innerW = FLAG_W - 4;
  const innerH = FLAG_H - 4;
  return (
    <View style={[flagStyles.frame, flagStyles.uk]}>
      <Svg width={innerW} height={innerH} viewBox="0 0 60 30">
        <Rect width="60" height="30" fill="#012169" />
        {/* Белые диагонали */}
        <Path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
        {/* Красные диагонали (смещённые полосы St Patrick) */}
        <Path d="M0,0 L60,30" stroke="#C8102E" strokeWidth="2" />
        <Path d="M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
        {/* Белый крест */}
        <Rect x="22" y="0" width="16" height="30" fill="#FFFFFF" />
        <Rect x="0" y="9" width="60" height="12" fill="#FFFFFF" />
        {/* Красный крест St George */}
        <Rect x="26" y="0" width="8" height="30" fill="#C8102E" />
        <Rect x="0" y="11" width="60" height="8" fill="#C8102E" />
      </Svg>
    </View>
  );
}

function Flag({ id }: { id: NativeLanguage }) {
  if (id === 'zh') return <FlagZh />;
  if (id === 'en') return <FlagUk />;
  return <FlagRu />;
}

/**
 * Три кнопки-флага на хабе (RU / 中 / EN).
 */
export function HubLanguageSwitch({ top }: Props) {
  const router = useRouter();
  const { locale, t, setAppLocale } = useTranslation();
  const { user, updateNativeLanguage } = useAuth();

  const applyLanguage = async (next: NativeLanguage) => {
    if (user) {
      await updateNativeLanguage(next);
    } else {
      await setAppLocale(next);
    }
    router.replace('/hub');
  };

  const onPick = (next: NativeLanguage) => {
    if (next === locale) return;
    void Haptics.selectionAsync();
    Alert.alert(t('hub.langRestartTitle'), t('hub.langRestartBody'), [
      { text: t('hub.langRestartCancel'), style: 'cancel' },
      {
        text: t('hub.langRestartConfirm'),
        onPress: () => {
          void applyLanguage(next);
        },
      },
    ]);
  };

  return (
    <View style={[styles.row, { top }]} pointerEvents="box-none">
      {LANGS.map((id) => {
        const active = locale === id;
        return (
          <Pressable
            key={id}
            onPress={() => onPick(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={id}
            hitSlop={6}
            style={({ pressed }) => [
              styles.btn,
              active && styles.btnOn,
              pressed && styles.btnPressed,
            ]}>
            <Flag id={id} />
          </Pressable>
        );
      })}
    </View>
  );
}

const FLAG_W = 28;
const FLAG_H = 20;

const flagStyles = StyleSheet.create({
  frame: {
    width: FLAG_W,
    height: FLAG_H,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    overflow: 'hidden',
    backgroundColor: GAME_THEME.color.cream,
  },
  stripe: {
    flex: 1,
    width: '100%',
  },
  zh: {
    backgroundColor: '#DE2910',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  star: {
    color: '#FFDE00',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 12,
    marginTop: -1,
  },
  uk: {
    backgroundColor: '#012169',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
});

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    right: 12,
    zIndex: 40,
    flexDirection: 'row',
    gap: 4,
  },
  btn: {
    padding: 1,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  btnOn: {
    borderColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.gold,
  },
  btnPressed: {
    opacity: 0.65,
  },
});
