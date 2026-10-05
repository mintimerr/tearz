import * as Haptics from '@/utils/safe-haptics';
import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { GAME_THEME } from '@/constants/game-theme';
import { useInstructor } from '@/contexts/instructor-context';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Human instructor hub (MVP shell). Cross-device share → API later.
 * @see docs/INSTRUCTOR_MODE.md
 */
export function InstructorHubScreen({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const {
    enabled,
    setEnabled,
    classes,
    createClass,
    publishNote,
    materialsForClass,
    joinWithCodeLocal,
    memberships,
  } = useInstructor();

  const [classTitle, setClassTitle] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const activeClass = classes[0] ?? null;

  const onEnable = useCallback(async () => {
    await setEnabled(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [setEnabled]);

  const onCreateClass = useCallback(async () => {
    const row = await createClass(classTitle);
    setClassTitle('');
    setStatus(`Класс «${row.title}» · код ${row.inviteCode}`);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [classTitle, createClass]);

  const onShareCode = useCallback(async () => {
    if (!activeClass) return;
    await Share.share({
      message: `Присоединяйся к классу «${activeClass.title}» в Tearz. Код: ${activeClass.inviteCode}`,
    });
  }, [activeClass]);

  const onPublish = useCallback(async () => {
    if (!activeClass) return;
    await publishNote(activeClass.id, noteTitle, noteBody);
    setNoteTitle('');
    setNoteBody('');
    setStatus('Материал выдан классу (пока только на этом устройстве)');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [activeClass, noteBody, noteTitle, publishNote]);

  const onJoin = useCallback(async () => {
    const res = await joinWithCodeLocal(joinCode);
    if (res.ok) {
      setJoinCode('');
      setStatus('Код сохранён. Полный шаринг между телефонами — после API.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setStatus(res.error);
    }
  }, [joinCode, joinWithCodeLocal]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Режим преподавателя</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={styles.close}>Закрыть</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            Класс, код для учеников и материалы. AI-учитель Tearz — отдельно; позже — кабинеты для школ.
          </Text>

          {!enabled ? (
            <GameGoldButton label="Включить режим преподавателя" onPress={onEnable} />
          ) : (
            <>
              <Text style={styles.section}>Мой класс</Text>
              {activeClass ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{activeClass.title}</Text>
                  <Text style={styles.code}>{activeClass.inviteCode}</Text>
                  <GameGoldButton label="Поделиться кодом" onPress={onShareCode} />
                </View>
              ) : (
                <View style={styles.card}>
                  <TextInput
                    style={styles.input}
                    placeholder="Название класса"
                    placeholderTextColor="rgba(26,26,26,0.4)"
                    value={classTitle}
                    onChangeText={setClassTitle}
                  />
                  <GameGoldButton label="Создать класс" onPress={onCreateClass} />
                </View>
              )}

              {activeClass ? (
                <>
                  <Text style={styles.section}>Выдать материал</Text>
                  <View style={styles.card}>
                    <TextInput
                      style={styles.input}
                      placeholder="Заголовок"
                      placeholderTextColor="rgba(26,26,26,0.4)"
                      value={noteTitle}
                      onChangeText={setNoteTitle}
                    />
                    <TextInput
                      style={[styles.input, styles.inputMulti]}
                      placeholder="Текст для учеников"
                      placeholderTextColor="rgba(26,26,26,0.4)"
                      value={noteBody}
                      onChangeText={setNoteBody}
                      multiline
                    />
                    <GameGoldButton label="Опубликовать" onPress={onPublish} />
                    {materialsForClass(activeClass.id).map((m) => (
                      <Text key={m.id} style={styles.matRow}>
                        · {m.title}
                      </Text>
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.section}>Я ученик — вступить по коду</Text>
              <View style={styles.card}>
                <TextInput
                  style={styles.input}
                  placeholder="TEARZ-XXXX"
                  placeholderTextColor="rgba(26,26,26,0.4)"
                  autoCapitalize="characters"
                  value={joinCode}
                  onChangeText={setJoinCode}
                />
                <GameGoldButton label="Вступить" onPress={onJoin} />
                {memberships
                  .filter((m) => m.role === 'learner')
                  .map((m) => (
                    <Text key={m.classId} style={styles.matRow}>
                      · {m.title} ({m.inviteCode})
                    </Text>
                  ))}
              </View>
            </>
          )}

          {status ? <Text style={styles.status}>{status}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GAME_THEME.color.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: { color: GAME_THEME.color.ink, fontSize: 22, fontWeight: '800' },
  close: { color: GAME_THEME.color.sky, fontSize: 16, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  lead: { color: 'rgba(26,26,26,0.55)', fontSize: 15, lineHeight: 22, marginBottom: 4 },
  section: {
    color: GAME_THEME.color.ink,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  card: {
    backgroundColor: GAME_THEME.color.cream,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: GAME_THEME.border.thin,
    borderColor: 'rgba(26,26,26,0.12)',
  },
  cardTitle: { color: GAME_THEME.color.ink, fontSize: 18, fontWeight: '700' },
  code: {
    color: GAME_THEME.color.sky,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  input: {
    backgroundColor: GAME_THEME.color.paper,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: GAME_THEME.color.ink,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.12)',
  },
  inputMulti: { minHeight: 88, textAlignVertical: 'top' },
  matRow: { color: 'rgba(26,26,26,0.55)', fontSize: 14 },
  status: { color: GAME_THEME.color.sky, fontSize: 14, marginTop: 8, lineHeight: 20, fontWeight: '600' },
});
