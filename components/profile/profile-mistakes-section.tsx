import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { DrillMistakeCard } from '@/components/profile/drill-mistake-card';
import { GAME_THEME } from '@/constants/game-theme';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/locale-context';
import {
  loadDrillMistakes,
  type TeacherDrillMistakeRecord,
} from '@/utils/teacher-drill-mistakes';

const PREVIEW_COUNT = 3;

/** Блок «История ошибок» на экране профиля. asRow — одна строка без карточек. */
export function ProfileMistakesSection({ asRow = false }: { asRow?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mistakes, setMistakes] = useState<TeacherDrillMistakeRecord[]>([]);

  const reload = useCallback(async () => {
    const userId = user?.id ?? '';
    if (!userId) {
      setMistakes([]);
      setLoading(false);
      return;
    }
    const rows = await loadDrillMistakes(userId);
    setMistakes([...rows].sort((a, b) => b.recordedAt - a.recordedAt));
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void reload();
    }, [reload]),
  );

  const preview = mistakes.slice(0, PREVIEW_COUNT);

  if (asRow) {
    return (
      <Pressable
        onPress={() => router.push('/mistakes')}
        disabled={loading}
        style={({ pressed }) => [styles.asRow, pressed && styles.libraryBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('profile.mistakesOpenLibrary')}>
        <Ionicons name="alert-circle-outline" size={18} color="rgba(26,26,26,0.38)" />
        <Text style={styles.asRowLabel}>{t('profile.mistakesLibraryTitle')}</Text>
        {!loading && mistakes.length > 0 ? <Text style={styles.asRowValue}>{mistakes.length}</Text> : null}
        <Ionicons name="chevron-forward" size={16} color="rgba(26,26,26,0.28)" />
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>{t('profile.mistakesTitle')}</Text>
        {mistakes.length > 0 ? (
          <Text style={styles.countBadge}>{mistakes.length}</Text>
        ) : null}
      </View>
      <View style={styles.panel}>
        {loading ? (
          <View style={styles.emptyPad}>
            <ActivityIndicator color={GAME_THEME.color.ink} />
          </View>
        ) : preview.length === 0 ? (
          <View style={styles.emptyPad}>
            <Ionicons name="sparkles-outline" size={22} color="rgba(26,26,26,0.35)" />
            <Text style={styles.emptyTitle}>{t('profile.mistakesEmptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('profile.mistakesEmptyBody')}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {preview.map((m) => (
              <DrillMistakeCard key={m.id} mistake={m} compact />
            ))}
          </View>
        )}

        <Pressable
          onPress={() => router.push('/mistakes')}
          disabled={loading}
          style={({ pressed }) => [styles.libraryBtn, pressed && styles.libraryBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.mistakesOpenLibrary')}>
          <View style={styles.libraryCopy}>
            <Text style={styles.libraryTitle}>{t('profile.mistakesOpenLibrary')}</Text>
          </View>
          <Ionicons name="library-outline" size={20} color={GAME_THEME.color.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: GAME_THEME.type.micro,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.45)',
  },
  countBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '900',
    color: GAME_THEME.color.cream,
    backgroundColor: GAME_THEME.color.ink,
  },
  sectionSub: {
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.5)',
  },
  panel: {
    backgroundColor: GAME_THEME.color.panelFill,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
    borderRadius: GAME_THEME.radius.panel,
    overflow: 'hidden',
  },
  list: {
    padding: 10,
    gap: 8,
  },
  emptyPad: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.5)',
    textAlign: 'center',
  },
  libraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(26,26,26,0.12)',
    backgroundColor: 'rgba(92,148,252,0.06)',
  },
  libraryBtnPressed: {
    opacity: 0.86,
  },
  libraryCopy: {
    flex: 1,
    gap: 2,
  },
  libraryTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.2,
  },
  librarySub: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.5)',
  },
  asRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  asRowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: GAME_THEME.color.ink,
  },
  asRowValue: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.45)',
  },
});
