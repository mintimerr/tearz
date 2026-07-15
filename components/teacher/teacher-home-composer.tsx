import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Reanimated, { type AnimatedStyle } from 'react-native-reanimated';

import { TeacherAttachGallery } from '@/components/teacher/teacher-attach-gallery';
import { APP_THEME } from '@/constants/theme';
import { TEACHER_MUTED_SOFT, TEACHER_TITLE } from '@/components/teacher/teacher-tokens';

const SEND_SIZE = 36;
const SEND_ACTIVE_BG = '#F4F4F5';
const SEND_ACTIVE_ICON = '#0A0A0C';

export type TeacherComposerAttachment =
  | { kind: 'image'; uri: string; name?: string }
  | { kind: 'file'; uri: string; fileName: string; mimeType?: string | null };

export type TeacherHomeComposerRef = {
  focus: () => void;
  clear: () => void;
  blur: () => void;
  setDraft: (text: string) => void;
};

type Props = {
  onSubmit: (question: string, attachment?: TeacherComposerAttachment | null) => void;
  insetStyle?: StyleProp<AnimatedStyle<ViewStyle>>;
  disabled?: boolean;
  /** Анимируемый плейсхолдер (печатается по буквам снаружи). */
  placeholderOverride?: string;
  onFocusChange?: (focused: boolean) => void;
};

export const TeacherHomeComposer = forwardRef<TeacherHomeComposerRef, Props>(function TeacherHomeComposer(
  { onSubmit, insetStyle, disabled, placeholderOverride, onFocusChange },
  ref,
) {
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<TeacherComposerAttachment | null>(null);
  const inputRef = useRef<TextInput>(null);
  const canSend = (draft.trim().length > 0 || pendingAttachment !== null) && !disabled;

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      setDraft('');
      setPendingAttachment(null);
      setAttachOpen(false);
    },
    blur: () => {
      inputRef.current?.blur();
      Keyboard.dismiss();
      setAttachOpen(false);
    },
    setDraft: (text: string) => {
      setDraft(text);
      setAttachOpen(false);
    },
  }));

  const submit = () => {
    const q = draft.trim();
    if ((!q && !pendingAttachment) || disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    setAttachOpen(false);
    setDraft('');
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

  const shellContent = (
    <>
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
          name={attachOpen ? 'close' : 'add'}
          size={22}
          color={
            attachOpen || pendingAttachment
              ? 'rgba(242, 242, 247, 0.88)'
              : 'rgba(242, 242, 247, 0.42)'
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
              <Ionicons name="close-circle" size={17} color={APP_THEME.color.mutedSoft} />
            </Pressable>
          </View>
        ) : null}
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholderOverride ?? 'Спросите преподавателя…'}
          placeholderTextColor={TEACHER_MUTED_SOFT}
          value={draft}
          onChangeText={setDraft}
          onFocus={() => {
            setFocused(true);
            setAttachOpen(false);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            setFocused(false);
            onFocusChange?.(false);
          }}
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
          color={canSend ? SEND_ACTIVE_ICON : 'rgba(242, 242, 247, 0.32)'}
        />
      </Pressable>
    </>
  );

  return (
    <Reanimated.View style={[styles.root, insetStyle]}>
      {attachOpen ? (
        <Pressable style={styles.attachBackdrop} onPress={closeAttach} accessibilityLabel="Закрыть" />
      ) : null}

      {attachOpen ? (
        <View style={styles.attachPanel}>
          <TeacherAttachGallery visible={attachOpen} onPhotoSelected={onGalleryPhoto} />
          <Pressable
            onPress={() => void handleBrowseFiles()}
            style={({ pressed }) => [styles.attachFileBtn, pressed && styles.attachFileBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Выбрать файл">
            <Ionicons name="document-outline" size={18} color="rgba(242, 242, 247, 0.82)" />
            <Text style={styles.attachMenuLabel}>Файл</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.floatShadow}>
        <View style={[styles.bar, focused && styles.barFocused]}>
          <View style={styles.topHighlight} pointerEvents="none" />
          <View style={styles.floatInner}>{shellContent}</View>
        </View>
      </View>
    </Reanimated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    position: 'relative',
    zIndex: 4,
  },
  attachBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  attachPanel: {
    marginBottom: 10,
    gap: 8,
    zIndex: 2,
  },
  attachFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: APP_THEME.radius.md,
    backgroundColor: APP_THEME.color.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  attachFileBtnPressed: {
    opacity: 0.88,
  },
  attachMenuLabel: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.18,
    color: APP_THEME.color.textSoft,
  },
  floatShadow: {
    borderRadius: 26,
    zIndex: 2,
    ...Platform.select({
      android: { elevation: 8 },
    }),
  },
  bar: {
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: APP_THEME.color.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  barFocused: {
    backgroundColor: APP_THEME.color.surfaceStrong,
    borderColor: APP_THEME.color.borderStrong,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: APP_THEME.color.border,
  },
  floatInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 8,
    paddingVertical: 9,
    minHeight: 52,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    backgroundColor: APP_THEME.color.accentSoft,
  },
  attachBtnPressed: {
    opacity: 0.6,
    backgroundColor: APP_THEME.color.accentGlass,
  },
  inputCol: {
    flex: 1,
    minWidth: 0,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: APP_THEME.color.accentSoft,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  pendingText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: APP_THEME.color.muted,
  },
  input: {
    minHeight: 36,
    maxHeight: 120,
    paddingVertical: Platform.OS === 'ios' ? 7 : 5,
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
    overflow: 'hidden',
    marginBottom: 2,
  },
  sendBtnOn: {
    backgroundColor: SEND_ACTIVE_BG,
  },
  sendBtnOff: {
    backgroundColor: APP_THEME.color.accentSoft,
  },
  sendBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.94 }],
  },
});
