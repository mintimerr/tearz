import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { APP_THEME } from '@/constants/theme';
import { pickCompanionPhoto } from '@/utils/pick-companion-photo';

const THUMB = 72;
const THUMB_GAP = 8;
const RECENT_COUNT = 16;

type Props = {
  visible: boolean;
  onPhotoSelected: (uri: string) => void;
};

export function TeacherAttachGallery({ visible, onPhotoSelected }: Props) {
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);

  const loadRecent = useCallback(async () => {
    if (Platform.OS === 'web') {
      setAssets([]);
      setDenied(true);
      return;
    }
    setLoading(true);
    setDenied(false);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setAssets([]);
        setDenied(true);
        return;
      }
      const page = await MediaLibrary.getAssetsAsync({
        first: RECENT_COUNT,
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      setAssets(page.assets);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void loadRecent();
  }, [loadRecent, visible]);

  const pickAsset = async (asset: MediaLibrary.Asset) => {
    let uri = asset.uri;
    try {
      // Full local file (may download from iCloud) — not the strip thumbnail.
      const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: true });
      uri = info.localUri ?? info.uri ?? uri;
    } catch {
      /* use asset.uri */
    }
    if (uri) onPhotoSelected(uri);
  };

  if (!visible) return null;

  if (loading) {
    return (
      <View style={styles.rail}>
        <View style={styles.railHeader}>
          <Text style={styles.railTitle}>Недавние фото</Text>
          <ActivityIndicator color="rgba(242,242,247,0.45)" />
        </View>
        <View style={styles.stripRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.thumbSkeleton} />
          ))}
        </View>
      </View>
    );
  }

  if (denied || assets.length === 0) {
    return (
      <View style={styles.rail}>
        <Pressable
          onPress={() => void pickCompanionPhoto().then((picked) => picked && onPhotoSelected(picked.uri))}
          style={({ pressed }) => [styles.pickBtn, pressed && styles.pickBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Выбрать фото">
          <Ionicons name="image-outline" size={18} color={APP_THEME.color.textSoft} />
          <Text style={styles.pickBtnText}>Выбрать фото</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.rail}>
      <View style={styles.railHeader}>
        <Text style={styles.railTitle}>Недавние фото</Text>
        <Text style={styles.railHint}>выберите одно</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbStrip}
        keyboardShouldPersistTaps="handled">
        {assets.map((asset) => (
          <Pressable
            key={asset.id}
            onPress={() => void pickAsset(asset)}
            style={({ pressed }) => [styles.thumbWrap, pressed && styles.thumbPressed]}
            accessibilityRole="button"
            accessibilityLabel="Выбрать фото">
            <Image source={{ uri: asset.uri }} style={styles.thumb} contentFit="cover" recyclingKey={asset.id} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: APP_THEME.radius.lg,
    backgroundColor: APP_THEME.color.elevated,
  },
  railHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
    paddingHorizontal: 2,
  },
  railTitle: {
    ...APP_THEME.type.caption,
    color: APP_THEME.color.textSoft,
  },
  railHint: {
    ...APP_THEME.type.micro,
    color: APP_THEME.color.mutedSoft,
  },
  stripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THUMB_GAP,
    minHeight: THUMB,
    paddingVertical: 1,
  },
  thumbStrip: {
    gap: THUMB_GAP,
    alignItems: 'center',
    paddingVertical: 1,
  },
  thumbWrap: {
    borderRadius: APP_THEME.radius.md,
    overflow: 'hidden',
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  thumbPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  thumb: {
    width: THUMB,
    height: THUMB,
  },
  thumbSkeleton: {
    width: THUMB,
    height: THUMB,
    borderRadius: APP_THEME.radius.md,
    backgroundColor: APP_THEME.color.surfaceStrong,
  },
  pickBtn: {
    minHeight: THUMB,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: APP_THEME.radius.md,
    backgroundColor: APP_THEME.color.surfaceStrong,
  },
  pickBtnPressed: {
    opacity: 0.85,
  },
  pickBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_THEME.color.textSoft,
  },
});
