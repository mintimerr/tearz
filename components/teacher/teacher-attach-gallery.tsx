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
import { GAME_THEME } from '@/constants/game-theme';
import { pickCompanionPhoto, takeCompanionPhoto } from '@/utils/pick-companion-photo';

const THUMB = 72;
/** Экранные px (полоса вне zoom). Не крошечные — 4–5 фото в ряд достаточно. */
const THUMB_GAME = 52;
const THUMB_GAP = 8;
const THUMB_GAP_GAME = 7;
const RECENT_COUNT = 16;

type Props = {
  visible: boolean;
  onPhotoSelected: (uri: string) => void;
  /** Светлая панель под игровой chrome (аркада). */
  tone?: 'default' | 'game';
  /** Крестик в заголовке (игровой тон). */
  onClose?: () => void;
};

export function TeacherAttachGallery({
  visible,
  onPhotoSelected,
  tone = 'default',
  onClose,
}: Props) {
  const game = tone === 'game';
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

  const openCamera = () => {
    void takeCompanionPhoto().then((picked) => picked && onPhotoSelected(picked.uri));
  };

  const openLibrary = () => {
    void pickCompanionPhoto().then((picked) => picked && onPhotoSelected(picked.uri));
  };

  if (!visible) return null;

  const thumb = game ? THUMB_GAME : THUMB;
  const gap = game ? THUMB_GAP_GAME : THUMB_GAP;
  const ink = game ? GAME_THEME.color.ink : APP_THEME.color.textSoft;

  const closeBtn = onClose ? (
    <Pressable
      onPress={onClose}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Закрыть"
      style={({ pressed }) => [
        styles.closeBtn,
        game && styles.closeBtnGame,
        pressed && styles.closeBtnPressed,
      ]}>
      <Ionicons name="close" size={game ? 15 : 16} color={ink} />
    </Pressable>
  ) : null;

  const header = game ? null : (
    <View style={styles.railHeader}>
      <Text style={styles.railTitle}>Недавние фото</Text>
      {onClose ? (
        closeBtn
      ) : (
        <Text style={styles.railHint}>камера или галерея</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.rail, game && styles.railGame]}>
        {header}
        <View style={[styles.stripRow, game && styles.stripRowGame, { gap }]}>
          {game && closeBtn ? <View style={styles.closeInStrip}>{closeBtn}</View> : null}
          <View
            style={[
              styles.cameraTile,
              game && styles.cameraTileGame,
              styles.thumbSkeleton,
              game && styles.thumbSkeletonGame,
              { width: thumb, height: thumb },
            ]}
          />
          {Array.from({ length: 3 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.thumbSkeleton,
                game && styles.thumbSkeletonGame,
                { width: thumb, height: thumb },
              ]}
            />
          ))}
        </View>
      </View>
    );
  }

  if (denied || assets.length === 0) {
    return (
      <View style={[styles.rail, game && styles.railGame]}>
        {header}
        <View style={[styles.emptyActions, game && styles.emptyActionsGame]}>
          {game && closeBtn ? <View style={styles.closeInStrip}>{closeBtn}</View> : null}
          <Pressable
            onPress={openCamera}
            style={({ pressed }) => [
              styles.pickBtn,
              styles.pickBtnFlex,
              game && styles.pickBtnGame,
              pressed && styles.pickBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Сделать фото">
            <Ionicons name="camera-outline" size={game ? 16 : 18} color={ink} />
            <Text style={[styles.pickBtnText, game && styles.pickBtnTextGame]}>Камера</Text>
          </Pressable>
          <Pressable
            onPress={openLibrary}
            style={({ pressed }) => [
              styles.pickBtn,
              styles.pickBtnFlex,
              game && styles.pickBtnGame,
              pressed && styles.pickBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Выбрать фото">
            <Ionicons name="image-outline" size={game ? 16 : 18} color={ink} />
            <Text style={[styles.pickBtnText, game && styles.pickBtnTextGame]}>Галерея</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.rail, game && styles.railGame]}>
      {header}
      <View style={game ? styles.stripWithClose : undefined}>
        {game && closeBtn ? <View style={styles.closeInStrip}>{closeBtn}</View> : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={game ? styles.stripScrollGame : undefined}
          contentContainerStyle={[styles.thumbStrip, game && styles.thumbStripGame, { gap }]}
          keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={openCamera}
            style={({ pressed }) => [
              styles.cameraTile,
              game && styles.cameraTileGame,
              { width: thumb, height: thumb },
              pressed && styles.thumbPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Сделать фото">
            <Ionicons name="camera" size={game ? 22 : 26} color={ink} />
            {!game ? <Text style={styles.cameraLabel}>Камера</Text> : null}
          </Pressable>
          {assets.map((asset) => (
            <Pressable
              key={asset.id}
              onPress={() => void pickAsset(asset)}
              style={({ pressed }) => [
                styles.thumbWrap,
                game && styles.thumbWrapGame,
                pressed && styles.thumbPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Выбрать фото">
              <Image
                source={{ uri: asset.uri }}
                style={{ width: thumb, height: thumb }}
                contentFit="cover"
                recyclingKey={asset.id}
              />
            </Pressable>
          ))}
        </ScrollView>
      </View>
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
  cameraTile: {
    width: THUMB,
    height: THUMB,
    borderRadius: APP_THEME.radius.md,
    backgroundColor: APP_THEME.color.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cameraLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: APP_THEME.color.mutedSoft,
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
  emptyActions: {
    flexDirection: 'row',
    gap: 8,
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
  pickBtnFlex: {
    flex: 1,
  },
  pickBtnPressed: {
    opacity: 0.85,
  },
  pickBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_THEME.color.textSoft,
  },
  railGame: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingTop: 7,
    paddingHorizontal: 7,
    paddingBottom: 7,
  },
  stripRowGame: {
    minHeight: THUMB_GAME,
  },
  stripWithClose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stripScrollGame: {
    flex: 1,
  },
  thumbStripGame: {
    paddingVertical: 0,
  },
  closeInStrip: {
    flexShrink: 0,
  },
  emptyActionsGame: {
    alignItems: 'center',
    minHeight: THUMB_GAME,
  },
  cameraTileGame: {
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 1.5,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 8,
  },
  thumbWrapGame: {
    borderWidth: 1.5,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbSkeletonGame: {
    backgroundColor: 'rgba(26,26,26,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(26,26,26,0.12)',
    borderRadius: 8,
  },
  pickBtnGame: {
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 1.5,
    borderColor: GAME_THEME.color.ink,
    minHeight: THUMB_GAME,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pickBtnTextGame: {
    color: GAME_THEME.color.ink,
    fontWeight: '800',
    fontSize: 13,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeBtnGame: {
    width: 34,
    height: THUMB_GAME,
    borderRadius: 8,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 1.5,
    borderColor: GAME_THEME.color.ink,
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
});
