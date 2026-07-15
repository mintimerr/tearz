import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandGradient, GlowCard } from '@/components/ui';
import { APP_THEME } from '@/constants/theme';
import { useTranslation } from '@/contexts/locale-context';
import { TEACHER_MUTED, TEACHER_MUTED_SOFT, TEACHER_TITLE } from '@/components/teacher/teacher-tokens';
import type { TeacherGoal } from '@/hooks/use-teacher-goal';

const MS_DAY = 86_400_000;

type Props = {
  goal: TeacherGoal | null;
  lessonsCount: number;
  onSave: (title: string, targetDate: number | null) => void;
};

const DEADLINE_CHOICES = [
  { id: 'none', days: null as number | null },
  { id: '30', days: 30 },
  { id: '60', days: 60 },
  { id: '90', days: 90 },
];

function daysLeft(targetDate: number): number {
  return Math.max(0, Math.ceil((targetDate - Date.now()) / MS_DAY));
}

export function TeacherGoalCard({ goal, lessonsCount, onSave }: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDays, setDraftDays] = useState<number | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const openEditor = () => {
    void Haptics.selectionAsync();
    setDraftTitle(goal?.title ?? '');
    setDraftDays(goal?.targetDate ? daysLeft(goal.targetDate) : null);
    setEditing(true);
  };

  const save = () => {
    const title = draftTitle.trim();
    if (!title) return;
    const targetDate = draftDays != null ? Date.now() + draftDays * MS_DAY : null;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSave(title, targetDate);
    setEditing(false);
  };

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.98, friction: 8, tension: 320, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 240, useNativeDriver: true }).start();

  const left = goal?.targetDate != null ? daysLeft(goal.targetDate) : null;
  const elapsed =
    goal?.targetDate != null && goal.targetDate > goal.createdAt
      ? Math.min(1, Math.max(0, (Date.now() - goal.createdAt) / (goal.targetDate - goal.createdAt)))
      : null;

  return (
    <>
      <Pressable onPress={openEditor} onPressIn={pressIn} onPressOut={pressOut} accessibilityRole="button">
        <Animated.View style={{ transform: [{ scale }] }}>
          {goal ? (
            <GlowCard radius={APP_THEME.radius.sheet} glowStrength={0.4} borderColor={APP_THEME.color.brandBorder}>
              <BrandGradient direction="diagonal" opacity={0.14} />
              <View style={styles.inner}>
                <View style={styles.headRow}>
                  <View style={styles.iconOrb}>
                    <BrandGradient borderRadius={13} direction="diagonal" />
                    <Ionicons name="flag" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.eyebrow}>{t('teacher.goalEyebrow')}</Text>
                  <Ionicons name="create-outline" size={17} color={TEACHER_MUTED_SOFT} />
                </View>

                <Text style={styles.title} numberOfLines={2}>
                  {goal.title}
                </Text>

                {left != null ? (
                  <View style={styles.countRow}>
                    <Text style={styles.countNum}>{left}</Text>
                    <Text style={styles.countLabel}>{t('teacher.goalDaysLeft')}</Text>
                  </View>
                ) : null}

                {elapsed != null ? (
                  <View style={styles.track}>
                    <View style={[styles.trackFill, { width: `${Math.max(3, elapsed * 100)}%` }]}>
                      <BrandGradient direction="horizontal" />
                    </View>
                  </View>
                ) : null}

                <Text style={styles.metaText}>{t('teacher.goalLessonsDone', { count: lessonsCount })}</Text>
              </View>
            </GlowCard>
          ) : (
            <GlowCard radius={APP_THEME.radius.sheet} glowStrength={0.32}>
              <View style={styles.emptyInner}>
                <View style={styles.iconOrb}>
                  <BrandGradient borderRadius={13} direction="diagonal" />
                  <Ionicons name="flag" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.emptyCol}>
                  <Text style={styles.emptyTitle}>{t('teacher.goalEmptyTitle')}</Text>
                  <Text style={styles.emptySub}>{t('teacher.goalEmptySub')}</Text>
                </View>
                <Ionicons name="add-circle" size={26} color={APP_THEME.color.brandBright} />
              </View>
            </GlowCard>
          )}
        </Animated.View>
      </Pressable>

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('teacher.goalSheetTitle')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('teacher.goalPlaceholder')}
              placeholderTextColor={TEACHER_MUTED_SOFT}
              value={draftTitle}
              onChangeText={setDraftTitle}
              autoFocus
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <Text style={styles.sheetLabel}>{t('teacher.goalDeadline')}</Text>
            <View style={styles.chipsRow}>
              {DEADLINE_CHOICES.map((c) => {
                const active = draftDays === c.days;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setDraftDays(c.days);
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityRole="button">
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {c.days == null ? t('teacher.goalNoDeadline') : t('teacher.goalDays', { count: c.days })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={save}
              disabled={!draftTitle.trim()}
              style={[styles.saveBtn, !draftTitle.trim() && styles.saveBtnOff]}
              accessibilityRole="button">
              {draftTitle.trim() ? <BrandGradient borderRadius={APP_THEME.radius.lg} direction="horizontal" /> : null}
              <Text style={[styles.saveText, !draftTitle.trim() && styles.saveTextOff]}>
                {t('teacher.goalSave')}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  inner: {
    padding: 18,
    gap: 10,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconOrb: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  eyebrow: {
    ...APP_THEME.type.micro,
    flex: 1,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: APP_THEME.color.brandBright,
  },
  title: {
    ...APP_THEME.type.titleLg,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: TEACHER_TITLE,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
    marginTop: 2,
  },
  countNum: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: TEACHER_TITLE,
  },
  countLabel: {
    ...APP_THEME.type.caption,
    color: TEACHER_MUTED,
  },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: APP_THEME.color.accentSoft,
    overflow: 'hidden',
    marginTop: 2,
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  metaText: {
    fontSize: 13,
    letterSpacing: -0.1,
    color: TEACHER_MUTED_SOFT,
  },
  emptyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 16,
  },
  emptyCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  emptyTitle: {
    ...APP_THEME.type.title,
    color: TEACHER_TITLE,
  },
  emptySub: {
    fontSize: 13,
    letterSpacing: -0.1,
    color: TEACHER_MUTED,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: APP_THEME.color.elevated,
    borderTopLeftRadius: APP_THEME.radius.sheet,
    borderTopRightRadius: APP_THEME.radius.sheet,
    padding: 22,
    paddingBottom: 34,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: TEACHER_TITLE,
  },
  input: {
    backgroundColor: APP_THEME.color.bg,
    borderRadius: APP_THEME.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    letterSpacing: -0.3,
    color: TEACHER_TITLE,
  },
  sheetLabel: {
    ...APP_THEME.type.micro,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: TEACHER_MUTED_SOFT,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: APP_THEME.color.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  chipActive: {
    backgroundColor: APP_THEME.color.brandSoft,
    borderColor: APP_THEME.color.brandBorder,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.15,
    color: TEACHER_MUTED,
  },
  chipTextActive: {
    color: APP_THEME.color.brandBright,
  },
  saveBtn: {
    marginTop: 4,
    height: 52,
    borderRadius: APP_THEME.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: APP_THEME.color.brand,
  },
  saveBtnOff: {
    backgroundColor: APP_THEME.color.accentSoft,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
  saveTextOff: {
    color: TEACHER_MUTED_SOFT,
  },
});
