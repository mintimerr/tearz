import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

export type PickedPhoto = { uri: string; name?: string };

/** Выбор одного фото из галереи (iOS / Android / web). */
export async function pickCompanionPhoto(): Promise<PickedPhoto | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Фото', 'Разреши доступ к галерее в настройках, чтобы отправлять снимки.');
      return null;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.fileName ?? undefined };
}
