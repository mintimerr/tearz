import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameWindowShell } from '@/components/game/game-window-shell';
import { DrillMistakeCard } from '@/components/profile/drill-mistake-card';
import { GAME_THEME } from '@/constants/game-theme';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/locale-context';
import {
  loadDrillMistakes,
  type TeacherDrillMistakeRecord,
} from '@/utils/teacher-drill-mistakes';

export default function MistakesLibraryScreen() {
  const insets = useSafeAreaInsets();
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

  const topicCount = useMemo(() => {
    const set = new Set<string>();
    for (const m of mistakes) {
      const topic = m.lessonTopic?.trim();
      if (topic) set.add(topic);
    }
    return set.size;
  }, [mistakes]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<TeacherDrillMistakeRecord>) => (
      <DrillMistakeCard mistake={item} defaultExpanded={index === 0} />
    ),
    [],
  );

  return (
    <GameWindowShell title={t('profile.mistakesLibraryTitle')} backHref="/me" contentPadding={0} titleDivider={false}>
      <View style={styles.root}>
        <View style={styles.leadWrap}>
          <Text style={styles.lead}>{t('profile.mistakesLibraryLead')}</Text>
          {!loading && mistakes.length > 0 ? (
            <Text style={styles.meta}>
              {t('profile.mistakesLibraryMeta', {
                count: mistakes.length,
                topics: topicCount,
              })}
            </Text>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={GAME_THEME.color.ink} />
          </View>
        ) : mistakes.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="library-outline" size={36} color="rgba(26,26,26,0.28)" />
            <Text style={styles.emptyTitle}>{t('profile.mistakesEmptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('profile.mistakesEmptyBody')}</Text>
          </View>
        ) : (
          <FlatList
            data={mistakes}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </GameWindowShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
  leadWrap: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 4,
  },
  lead: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
  },
  meta: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.4)',
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  sep: {
    height: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
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
});
