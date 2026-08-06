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

import { GAME_THEME } from '@/constants/game-theme';

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
            <ActivityIndicator style={styles.loaderSpinner} color={GAME_THEME.color.ink} />
          </View>
        ) : denied || photos.length === 0 ? (
          <Animated.View entering={FadeIn.duration(240)} style={styles.emptyRow}>
            <Ionicons name="images-outline" size={22} color="rgba(26,26,26,0.4)" />
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
              <Ionicons name="folder-open-outline" size={20} color={GAME_THEME.color.ink} />
            </View>
            <Text style={styles.browseLabel}>Добавить файлы</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(26,26,26,0.4)" />
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
    backgroundColor: 'rgba(26,26,26,0.2)',
  },
  thumbStrip: {
    gap: THUMB_GAP,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  thumbWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  thumbPressed: {
    opacity: 0.82,
    transform: [{ translateY: 1 }],
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
    borderRadius: 10,
    backgroundColor: 'rgba(26,26,26,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(26,26,26,0.12)',
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
    fontWeight: '700',
    color: 'rgba(26,26,26,0.5)',
    letterSpacing: -0.2,
  },
  browsePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: GAME_THEME.radius.button,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 3,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  browsePillPressed: {
    backgroundColor: GAME_THEME.color.sky,
    transform: [{ translateY: 1 }],
    borderBottomWidth: 2,
  },
  browseIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.25,
  },
});
