import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
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
import Animated, {
  Easing,
  FadeIn,
  FadeInRight,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { APP_THEME } from '@/constants/theme';

const THUMB = 76;
const THUMB_GAP = 8;
const RECENT_COUNT = 20;
const SHEET_OPEN_H = 168;

type RecentPhoto = { id: string; uri: string };

type Props = {
  visible: boolean;
  onPhotoSelected: (uri: string) => void;
  onBrowseFiles: () => void;
};

export function CompanionAttachmentSheet({ visible, onPhotoSelected, onBrowseFiles }: Props) {
  const progress = useSharedValue(0);
  const [photos, setPhotos] = useState<RecentPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    progress.value = withSpring(visible ? 1 : 0, {
      damping: 22,
      stiffness: 280,
      mass: 0.85,
    });
  }, [progress, visible]);

  const loadRecent = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPhotos([]);
      setDenied(true);
      return;
    }
    setLoading(true);
    setDenied(false);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setPhotos([]);
        setDenied(true);
        return;
      }
      const page = await MediaLibrary.getAssetsAsync({
        first: RECENT_COUNT,
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      const resolved = await Promise.all(
        page.assets.map(async (asset) => {
          try {
            const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false });
            return { id: asset.id, uri: info.localUri ?? info.uri ?? asset.uri };
          } catch {
            return { id: asset.id, uri: asset.uri };
          }
        }),
      );
      setPhotos(resolved.filter((p) => Boolean(p.uri)));
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void loadRecent();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [loadRecent, visible]);

  const shellStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, SHEET_OPEN_H]),
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.6, 1]),
    marginBottom: interpolate(progress.value, [0, 1], [0, 8]),
  }));

  const pickPhoto = useCallback(
    (uri: string) => {
      void Haptics.selectionAsync();
      onPhotoSelected(uri);
    },
    [onPhotoSelected],
  );

  const openBrowse = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBrowseFiles();
  }, [onBrowseFiles]);

  return (
    <Animated.View style={[styles.shell, shellStyle]} pointerEvents={visible ? 'auto' : 'none'}>
      <View style={styles.panel}>
        <View style={styles.handle} />

        {loading ? (
          <View style={styles.loaderRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Animated.View
                key={i}
                entering={FadeIn.delay(i * 40).duration(220)}
                style={styles.thumbSkeleton}
              />
            ))}
            <ActivityIndicator style={styles.loaderSpinner} color={APP_THEME.color.muted} />
          </View>
        ) : denied || photos.length === 0 ? (
          <Animated.View entering={FadeIn.duration(240)} style={styles.emptyRow}>
            <Ionicons name="images-outline" size={22} color={APP_THEME.color.mutedFaint} />
            <Text style={styles.emptyText}>
              {denied ? 'Нет доступа к галерее' : 'Нет недавних фото'}
            </Text>
          </Animated.View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbStrip}
            keyboardShouldPersistTaps="handled">
            {photos.map((photo, index) => (
              <Animated.View
                key={photo.id}
                entering={FadeInRight.delay(index * 32)
                  .duration(280)
                  .easing(Easing.out(Easing.cubic))}>
                <Pressable
                  onPress={() => pickPhoto(photo.uri)}
                  style={({ pressed }) => [styles.thumbWrap, pressed && styles.thumbPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Отправить фото">
                  <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" transition={80} />
                </Pressable>
              </Animated.View>
            ))}
          </ScrollView>
        )}

        <Animated.View entering={FadeIn.delay(120).duration(300)}>
          <Pressable
            onPress={openBrowse}
            style={({ pressed }) => [styles.browsePill, pressed && styles.browsePillPressed]}
            accessibilityRole="button"
            accessibilityLabel="Добавить файлы">
            <View style={styles.browseIconWrap}>
              <Ionicons name="folder-open-outline" size={20} color={APP_THEME.color.textSoft} />
            </View>
            <Text style={styles.browseLabel}>Добавить файлы</Text>
            <Ionicons name="chevron-forward" size={18} color={APP_THEME.color.mutedSoft} />
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
  },
  panel: {
    gap: 10,
    paddingTop: 4,
    paddingHorizontal: 2,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: APP_THEME.color.borderStrong,
  },
  thumbStrip: {
    gap: THUMB_GAP,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  thumbWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: APP_THEME.color.elevated,
  },
  thumbPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  thumb: {
    width: THUMB,
    height: THUMB,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THUMB_GAP,
    minHeight: THUMB,
    paddingHorizontal: 2,
  },
  thumbSkeleton: {
    width: THUMB,
    height: THUMB,
    borderRadius: 14,
    backgroundColor: APP_THEME.color.elevated,
  },
  loaderSpinner: {
    marginLeft: 4,
  },
  emptyRow: {
    minHeight: THUMB,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: APP_THEME.color.mutedSoft,
    letterSpacing: -0.2,
  },
  browsePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: APP_THEME.radius.md,
    backgroundColor: APP_THEME.color.elevated,
  },
  browsePillPressed: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  browseIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: APP_THEME.color.elevatedSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: APP_THEME.color.text,
    letterSpacing: -0.25,
  },
});
