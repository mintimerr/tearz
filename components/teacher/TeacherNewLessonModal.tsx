import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_THEME } from '@/constants/theme';
import { TEACHER_MUTED, TEACHER_MUTED_SOFT, TEACHER_TITLE } from '@/components/teacher/teacher-tokens';

const SEND_BTN_ACTIVE = '#F4F4F5';
const SEND_ICON_ACTIVE = '#09090B';

const PROMPT = 'С какой темой или проблемой вам нужна помощь?';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmitLesson: (question: string) => void;
};

export function TeacherNewLessonModal({ visible, onClose, onSubmitLesson }: Props) {
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState('');
  const backdrop = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(420)).current;

  useEffect(() => {
    if (!visible) {
      setQuestion('');
      return;
    }
    sheetY.setValue(420);
    backdrop.setValue(0);
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(sheetY, {
        toValue: 0,
        damping: 28,
        stiffness: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, backdrop, sheetY]);

  const closeAnim = (after?: () => void) => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetY, {
        toValue: 440,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        after?.();
        onClose();
      }
    });
  };

  const submit = () => {
    const q = question.trim();
    if (!q) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeAnim(() => onSubmitLesson(q));
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => closeAnim()}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeAnim()}>
          <Animated.View style={[styles.dim, { opacity: backdrop }]} />
        </Pressable>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}>
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, 16) + 8,
                transform: [{ translateY: sheetY }],
              },
            ]}>
            <View style={styles.handle} />
            <Text style={styles.sheetKicker}>Новый урок</Text>
            <Text style={styles.prompt}>{PROMPT}</Text>
            <Text style={styles.hint}>Опиши коротко — начнём с этого в чате с преподавателем.</Text>
            <TextInput
              style={styles.input}
              placeholder="Например: не понимаю Past Simple в вопросах"
              placeholderTextColor={APP_THEME.color.mutedFaint}
              value={question}
              onChangeText={setQuestion}
              multiline
              maxLength={400}
              textAlignVertical="top"
            />
            <View style={styles.actions}>
              <Pressable style={styles.ghostBtn} onPress={() => closeAnim()} hitSlop={6}>
                <Text style={styles.ghostBtnText}>Отмена</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, question.trim().length === 0 && styles.primaryBtnOff]}
                disabled={question.trim().length === 0}
                onPress={submit}>
                <Text style={styles.primaryBtnText}>Начать урок</Text>
                <Ionicons name="arrow-forward" size={18} color={SEND_ICON_ACTIVE} />
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  kav: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: APP_THEME.radius.sheet,
    borderTopRightRadius: APP_THEME.radius.sheet,
    paddingHorizontal: 22,
    paddingTop: 8,
    backgroundColor: APP_THEME.color.elevated,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: APP_THEME.color.borderStrong,
    marginBottom: 14,
  },
  sheetKicker: {
    ...APP_THEME.type.micro,
    color: TEACHER_MUTED_SOFT,
    marginBottom: 8,
  },
  prompt: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.44,
    lineHeight: 28,
    color: TEACHER_TITLE,
    marginBottom: 8,
  },
  hint: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: TEACHER_MUTED,
    marginBottom: 14,
  },
  input: {
    minHeight: 100,
    maxHeight: 160,
    borderRadius: APP_THEME.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    color: TEACHER_TITLE,
    backgroundColor: APP_THEME.color.bg,
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ghostBtn: {
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  ghostBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: TEACHER_MUTED,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: SEND_BTN_ACTIVE,
  },
  primaryBtnOff: { opacity: 0.45 },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: SEND_ICON_ACTIVE,
    letterSpacing: -0.22,
  },
});
