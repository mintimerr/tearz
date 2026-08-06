import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { GameWindowShell } from '@/components/game/game-window-shell';
import { GAME_THEME } from '@/constants/game-theme';
import { useTranslation } from '@/contexts/locale-context';
import { useVocabulary } from '@/contexts/vocabulary-context';
import { fetchSharedVocabPack } from '@/services/vocab-share-api';
import type { VocabShareGetResponse } from '@/types/vocab-share-api';
import { cardCountLabel } from '@/utils/vocab-folders';

export default function VocabImportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { importSharedFolder, vocabularyHydrated } = useVocabulary();

  const [pack, setPack] = useState<VocabShareGetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const shareId = typeof id === 'string' ? id.trim() : '';
    if (!shareId) {
      setError(t('vocabulary.shareNotFound'));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchSharedVocabPack(shareId);
        if (!cancelled) setPack(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('vocabulary.shareNotFound'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const goBack = useCallback(() => {
    router.replace('/(tabs)/vocabulary');
  }, [router]);

  const onImport = useCallback(() => {
    if (!pack || importing) return;
    setImporting(true);
    const folderId = importSharedFolder({ name: pack.name, cards: pack.cards });
    if (folderId) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/vocabulary');
      return;
    }
    setImporting(false);
    setError(t('vocabulary.shareImportFailed'));
  }, [importSharedFolder, importing, pack, router, t]);

  const loading = !pack && !error;

  return (
    <GameWindowShell
      title={t('vocabulary.shareImportTitle')}
      onBack={goBack}
      backHref="/(tabs)/vocabulary"
      contentPadding={20}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={GAME_THEME.color.ink} size="large" />
          <Text style={styles.hint}>{t('vocabulary.shareLoading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.iconWrap}>
            <Ionicons name="alert-circle-outline" size={32} color="rgba(26,26,26,0.45)" />
          </View>
          <Text style={styles.title}>{t('vocabulary.shareNotFound')}</Text>
          <Text style={styles.sub}>{error}</Text>
          <GameGoldButton label={t('vocabulary.shareGoVocab')} onPress={goBack} style={styles.primaryBtn} />
        </View>
      ) : pack ? (
        <View style={styles.center}>
          <View style={styles.iconWrap}>
            <Ionicons name="folder-open-outline" size={30} color={GAME_THEME.color.ink} />
          </View>
          <Text style={styles.eyebrow}>{t('vocabulary.shareImportTitle')}</Text>
          <Text style={styles.title}>{pack.name}</Text>
          <Text style={styles.sub}>{cardCountLabel(pack.cards.length, t)}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.ghostBtn} onPress={goBack} disabled={importing}>
              <Text style={styles.ghostBtnText}>{t('common.cancel')}</Text>
            </Pressable>
            <GameGoldButton
              label={importing ? t('common.loading') : t('vocabulary.shareImportConfirm')}
              onPress={onImport}
              disabled={importing || !vocabularyHydrated}
              style={styles.primaryBtn}
            />
          </View>
        </View>
      ) : null}
    </GameWindowShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,26,26,0.06)',
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
    marginBottom: 6,
  },
  eyebrow: {
    fontSize: GAME_THEME.type.micro,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: 'rgba(26,26,26,0.45)',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: GAME_THEME.type.title,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  sub: {
    fontSize: GAME_THEME.type.body,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  hint: {
    marginTop: 12,
    fontSize: GAME_THEME.type.body,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.45)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  ghostBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: GAME_THEME.radius.button,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
  },
  ghostBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.55)',
  },
  primaryBtn: {
    minWidth: 148,
  },
});
