import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { TeacherAttachGallery } from '@/components/teacher/teacher-attach-gallery';
import type { TeacherComposerAttachment } from '@/components/teacher/teacher-home-composer';
import { GAME_THEME } from '@/constants/game-theme';
import {
  TEACHER_MUTED,
  TEACHER_TITLE,
} from '@/components/teacher/teacher-tokens';

const SEND_SIZE = 36;
const SEND_BTN_ACTIVE = GAME_THEME.color.paperWarm;
const SEND_ICON_ACTIVE = GAME_THEME.color.ink;
const SEND_ICON_IDLE = 'rgba(26,26,26,0.35)';

type Props = {
  input: string;
  onChangeText: (text: string) => void;
  onSubmit: (text: string, attachment?: TeacherComposerAttachment | null) => void;
  bottomInset?: number;
  disabled?: boolean;
};

export function TeacherChatComposer({
  input,
  onChangeText,
  onSubmit,
  bottomInset = 0,
  disabled,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<TeacherComposerAttachment | null>(null);
  const inputRef = useRef<TextInput>(null);
  const focusProgress = useSharedValue(0);
  const canSend = (input.trim().length > 0 || pendingAttachment !== null) && !disabled;

  useEffect(() => {
    focusProgress.value = withTiming(focused ? 1 : 0, {
      duration: focused ? 320 : 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [focusProgress, focused]);

  const inputShellMotion = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      ['#F0F6FF', GAME_THEME.color.cream],
    ),
  }));

  const submit = () => {
    const q = input.trim();
    if ((!q && !pendingAttachment) || disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    setAttachOpen(false);
    const attachment = pendingAttachment;
    setPendingAttachment(null);
    onSubmit(q, attachment);
  };

  const closeAttach = () => setAttachOpen(false);

  const onGalleryPhoto = (uri: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingAttachment({ kind: 'image', uri });
    setAttachOpen(false);
  };

  const handleBrowseFiles = async () => {
    if (disabled) return;
    setAttachOpen(false);
    if (Platform.OS === 'web') {
      Alert.alert('Файлы', 'Выбор файлов доступен в приложении на iOS или Android.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      const { uri, name, mimeType } = asset;
      const isImage =
        mimeType?.startsWith('image/') === true ||
        /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(name ?? '');

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (isImage) {
        setPendingAttachment({ kind: 'image', uri, name: name ?? undefined });
      } else {
        setPendingAttachment({
          kind: 'file',
          uri,
          fileName: name?.trim() || 'Файл',
          mimeType,
        });
      }
    } catch {
      Alert.alert('Файлы', 'Не удалось открыть приложение «Файлы».');
    }
  };

  return (
    <View style={[styles.dock, bottomInset > 0 && { paddingBottom: bottomInset }]}>
      {attachOpen ? (
        <Pressable
          style={styles.attachBackdrop}
          onPress={closeAttach}
          accessibilityLabel="Закрыть меню вложений"
        />
      ) : null}

      {attachOpen ? (
        <View style={styles.attachPanel}>
          <TeacherAttachGallery visible={attachOpen} onPhotoSelected={onGalleryPhoto} />
          <Pressable
            onPress={() => void handleBrowseFiles()}
            style={({ pressed }) => [styles.attachFileBtn, pressed && styles.attachFileBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Выбрать файл">
            <Ionicons name="document-outline" size={20} color={GAME_THEME.color.ink} />
            <Text style={styles.attachMenuLabel}>Файл</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.inputMount}>
        <Animated.View
          style={[styles.inputShell, inputShellMotion, disabled && styles.inputShellDisabled]}>
          <Pressable
            onPress={() => {
              if (disabled) return;
              void Haptics.selectionAsync();
              setAttachOpen((open) => !open);
            }}
            disabled={disabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={attachOpen ? 'Закрыть меню вложений' : 'Прикрепить фото или файл'}
            style={({ pressed }) => [styles.attachBtn, pressed && styles.attachBtnPressed]}>
            <Ionicons
              name={attachOpen ? 'close' : 'attach-outline'}
              size={21}
              color={GAME_THEME.color.ink}
            />
          </Pressable>

          <View style={styles.inputCol}>
            {pendingAttachment ? (
              <View style={styles.pendingRow}>
                <Ionicons
                  name={pendingAttachment.kind === 'image' ? 'image-outline' : 'document-outline'}
                  size={14}
                  color="rgba(26,26,26,0.55)"
                />
                <Text style={styles.pendingText} numberOfLines={1}>
                  {pendingAttachment.kind === 'image'
                    ? pendingAttachment.name ?? 'Фото'
                    : pendingAttachment.fileName}
                </Text>
                <Pressable
                  onPress={() => setPendingAttachment(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Убрать вложение">
                  <Ionicons name="close-circle" size={18} color="rgba(26,26,26,0.45)" />
                </Pressable>
              </View>
            ) : null}
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Задайте вопрос по уроку…"
              placeholderTextColor="rgba(26,26,26,0.35)"
              value={input}
              onChangeText={onChangeText}
              onFocus={() => {
                setFocused(true);
                setAttachOpen(false);
              }}
              onBlur={() => setFocused(false)}
              multiline
              maxLength={2000}
              editable={!disabled}
              contextMenuHidden={false}
              autoCorrect
              autoCapitalize="sentences"
              returnKeyType="default"
              blurOnSubmit={false}
              textAlignVertical="center"
            />
          </View>

          <Pressable
            onPress={submit}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendBtn,
              canSend ? styles.sendBtnOn : styles.sendBtnOff,
              canSend && pressed && styles.sendBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Отправить">
            <Ionicons
              name="arrow-up"
              size={20}
              color={canSend ? SEND_ICON_ACTIVE : SEND_ICON_IDLE}
            />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'relative',
    paddingTop: 12,
    paddingHorizontal: 12,
    borderTopWidth: 3,
    borderTopColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.cream,
    zIndex: 4,
  },
  attachBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  attachPanel: {
    width: '100%',
    marginBottom: 8,
    gap: 9,
    zIndex: 2,
  },
  attachFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: GAME_THEME.radius.button,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  attachFileBtnPressed: {
    backgroundColor: GAME_THEME.color.gold,
  },
  attachMenuLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: GAME_THEME.color.ink,
  },
  inputMount: {
    width: '100%',
    zIndex: 2,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    minHeight: 48,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 3,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  inputShellDisabled: {
    opacity: 0.5,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  attachBtnPressed: {
    opacity: 0.85,
    backgroundColor: GAME_THEME.color.gold,
  },
  inputCol: {
    flex: 1,
    minWidth: 0,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(26,26,26,0.06)',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  pendingText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: TEACHER_MUTED,
  },
  input: {
    minHeight: 36,
    maxHeight: 120,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.28,
    color: TEACHER_TITLE,
  },
  sendBtn: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: SEND_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 3,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  sendBtnOn: {
    backgroundColor: SEND_BTN_ACTIVE,
  },
  sendBtnOff: {
    backgroundColor: 'rgba(26,26,26,0.08)',
  },
  sendBtnPressed: {
    opacity: 0.88,
    transform: [{ translateY: 1 }],
  },
});
