import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { APP_THEME } from '@/constants/theme';

import { TeacherLessonRow } from '@/components/teacher/teacher-lesson-row';

const ACTION_SIZE = 40;

type Props = {
  title: string;
  meta: string;
  accentColor: string;
  showSeparator: boolean;
  renameLabel: string;
  deleteLabel: string;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
};

export const TeacherLessonSwipeItem = memo(function TeacherLessonSwipeItem({
  title,
  meta,
  accentColor,
  showSeparator,
  renameLabel,
  deleteLabel,
  onOpen,
  onRename,
  onDelete,
}: Props) {
  const swipeRef = useRef<SwipeableMethods | null>(null);

  const renderRightActions = useCallback(
    () => (
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            swipeRef.current?.close();
            onRename();
          }}
          style={({ pressed }) => [styles.actionHit, pressed && styles.actionPressed]}
          accessibilityRole="button"
          accessibilityLabel={renameLabel}>
          <View style={[styles.actionOrb, styles.actionRename]}>
            <Ionicons name="pencil" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.actionLabel} numberOfLines={1}>
            {renameLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            swipeRef.current?.close();
            onDelete();
          }}
          style={({ pressed }) => [styles.actionHit, pressed && styles.actionPressed]}
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}>
          <View style={[styles.actionOrb, styles.actionDelete]}>
            <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.actionLabel} numberOfLines={1}>
            {deleteLabel}
          </Text>
        </Pressable>
      </View>
    ),
    [deleteLabel, onDelete, onRename, renameLabel],
  );

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      friction={1.65}
      rightThreshold={36}
      dragOffsetFromLeftEdge={16}
      dragOffsetFromRightEdge={16}
      renderRightActions={renderRightActions}
      containerStyle={styles.container}
      childrenContainerStyle={styles.child}>
      <TeacherLessonRow
        title={title}
        meta={meta}
        accentColor={accentColor}
        onPress={onOpen}
        showSeparator={showSeparator}
      />
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: APP_THEME.color.bg,
    overflow: 'hidden',
  },
  child: {
    backgroundColor: APP_THEME.color.bg,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingLeft: 8,
    paddingRight: 6,
    gap: 6,
  },
  actionHit: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  actionPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  actionOrb: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: ACTION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1430',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionRename: {
    backgroundColor: '#4C8DFF',
  },
  actionDelete: {
    backgroundColor: '#FF453A',
  },
  actionLabel: {
    maxWidth: 54,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: 'rgba(26,26,26,0.5)',
    textAlign: 'center',
  },
});
