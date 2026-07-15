import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NativeLanguage } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/locale-context';
import { APP_THEME } from '@/constants/theme';

const OPTIONS: NativeLanguage[] = ['ru', 'zh', 'en'];

const LABEL_KEYS = {
  ru: 'auth.langRu',
  zh: 'auth.langZh',
  en: 'auth.langEn',
} as const;

const FLAG: Record<NativeLanguage, string> = {
  ru: '🇷🇺',
  zh: '🇨🇳',
  en: '🇬🇧',
};

type Props = {
  value: NativeLanguage;
  onChange: (lang: NativeLanguage) => void;
};

/** Компактный выбор языка — правый верхний угол */
export function LanguagePicker({ value, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      {OPTIONS.map((id) => {
        const active = value === id;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            style={({ pressed }) => [
              styles.item,
              active && styles.itemActive,
              pressed && styles.itemPressed,
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(LABEL_KEYS[id])}>
            <Text style={styles.flag}>{FLAG[id]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
  },
  item: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  itemActive: {
    backgroundColor: APP_THEME.color.surface,
    borderColor: APP_THEME.color.borderStrong,
  },
  itemPressed: {
    opacity: 0.85,
  },
  flag: {
    fontSize: 20,
    lineHeight: 24,
  },
});
