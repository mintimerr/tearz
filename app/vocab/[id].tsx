import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PremiumScreenShell } from '@/components/ui';
import { APP_THEME } from '@/constants/theme';
import { useTranslation } from '@/contexts/locale-context';
import { useVocabulary } from '@/contexts/vocabulary-context';
import { fetchSharedVocabPack } from '@/services/vocab-share-api';
import type { VocabShareGetResponse } from '@/types/vocab-share-api';
import { cardCountLabel } from '@/utils/vocab-folders';

export default function VocabImportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    <PremiumScreenShell style={styles.root}>
      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={APP_THEME.color.text} size="large" />
            <Text style={styles.hint}>{t('vocabulary.shareLoading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <View style={styles.iconWrap}>
              <Ionicons name="alert-circle-outline" size={32} color={APP_THEME.color.muted} />
            </View>
            <Text style={styles.title}>{t('vocabulary.shareNotFound')}</Text>
            <Text style={styles.sub}>{error}</Text>
            <Pressable style={styles.primaryBtn} onPress={goBack}>
              <Text style={styles.primaryBtnText}>{t('vocabulary.shareGoVocab')}</Text>
            </Pressable>
          </View>
        ) : pack ? (
          <View style={styles.center}>
            <View style={styles.iconWrap}>
              <Ionicons name="folder-open-outline" size={30} color={APP_THEME.color.text} />
            </View>
            <Text style={styles.eyebrow}>{t('vocabulary.shareImportTitle')}</Text>
            <Text style={styles.title}>{pack.name}</Text>
            <Text style={styles.sub}>
              {cardCountLabel(pack.cards.length, t)}
            </Text>
            <View style={styles.actions}>
              <Pressable style={styles.ghostBtn} onPress={goBack} disabled={importing}>
                <Text style={styles.ghostBtnText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, importing && styles.primaryBtnDisabled]}
                onPress={onImport}
                disabled={importing || !vocabularyHydrated}>
                {importing ? (
                  <ActivityIndicator color="#09090B" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>{t('vocabulary.shareImportConfirm')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </PremiumScreenShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_THEME.color.bg,
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.elevated,
    marginBottom: 6,
  },
  eyebrow: {
    ...APP_THEME.type.label,
    color: APP_THEME.color.mutedSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    ...APP_THEME.type.titleLg,
    color: APP_THEME.color.text,
    textAlign: 'center',
  },
  sub: {
    ...APP_THEME.type.caption,
    color: APP_THEME.color.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  hint: {
    marginTop: 12,
    ...APP_THEME.type.caption,
    color: APP_THEME.color.mutedSoft,
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
    borderRadius: APP_THEME.radius.pill,
  },
  ghostBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_THEME.color.muted,
  },
  primaryBtn: {
    minWidth: 148,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#09090B',
  },
});
