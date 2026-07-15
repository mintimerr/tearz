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
import { APP_THEME } from '@/constants/theme';
import {
  TEACHER_MUTED,
  TEACHER_MUTED_SOFT,
  TEACHER_TITLE,
} from '@/components/teacher/teacher-tokens';

const SEND_SIZE = 36;
const SEND_BTN_ACTIVE = '#F4F4F5';
const SEND_ICON_ACTIVE = '#09090B';
const SEND_ICON_IDLE = APP_THEME.color.muted;

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
      [APP_THEME.color.elevated, APP_THEME.color.elevatedSoft],
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
            <Ionicons name="document-outline" size={20} color={APP_THEME.color.textSoft} />
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
              color={
                attachOpen || pendingAttachment ? APP_THEME.color.textSoft : APP_THEME.color.mutedSoft
              }
            />
          </Pressable>

          <View style={styles.inputCol}>
            {pendingAttachment ? (
              <View style={styles.pendingRow}>
                <Ionicons
                  name={pendingAttachment.kind === 'image' ? 'image-outline' : 'document-outline'}
                  size={14}
                  color="rgba(242, 242, 247, 0.55)"
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
                  <Ionicons name="close-circle" size={18} color={APP_THEME.color.mutedSoft} />
                </Pressable>
              </View>
            ) : null}
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Задайте вопрос по уроку…"
              placeholderTextColor={TEACHER_MUTED_SOFT}
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
    paddingTop: 8,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: APP_THEME.color.separator,
    backgroundColor: APP_THEME.color.bg,
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
    borderRadius: APP_THEME.radius.md,
    backgroundColor: APP_THEME.color.elevated,
  },
  attachFileBtnPressed: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  attachMenuLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: APP_THEME.color.textSoft,
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
    borderRadius: 24,
    backgroundColor: APP_THEME.color.elevated,
  },
  inputShellDisabled: {
    opacity: 0.5,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  attachBtnPressed: {
    opacity: 0.85,
    backgroundColor: APP_THEME.color.accentSoft,
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
    backgroundColor: APP_THEME.color.elevatedSoft,
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
  },
  sendBtnOn: {
    backgroundColor: SEND_BTN_ACTIVE,
  },
  sendBtnOff: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  sendBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.95 }],
  },
});
