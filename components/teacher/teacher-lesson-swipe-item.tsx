import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { APP_THEME } from '@/constants/theme';

import { TeacherLessonRow } from '@/components/teacher/teacher-lesson-row';

const SWIPE_BTN_WIDTH = 72;

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
      <View style={styles.swipeActions}>
        <TouchableOpacity
          style={[styles.swipeBtn, styles.swipeRename]}
          activeOpacity={0.85}
          onPress={() => {
            swipeRef.current?.close();
            onRename();
          }}
          accessibilityLabel={renameLabel}>
          <Ionicons name="pencil-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeBtn, styles.swipeDel]}
          activeOpacity={0.85}
          onPress={() => {
            swipeRef.current?.close();
            onDelete();
          }}
          accessibilityLabel={deleteLabel}>
          <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    ),
    [deleteLabel, onDelete, onRename, renameLabel],
  );

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      friction={1.5}
      rightThreshold={40}
      dragOffsetFromLeftEdge={16}
      dragOffsetFromRightEdge={16}
      renderRightActions={renderRightActions}
      containerStyle={styles.swipeContainer}
      childrenContainerStyle={styles.swipeChild}>
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
  swipeContainer: {
    backgroundColor: APP_THEME.color.bg,
  },
  swipeChild: {
    backgroundColor: APP_THEME.color.bg,
  },
  swipeActions: {
    flexDirection: 'row',
  },
  swipeBtn: {
    width: SWIPE_BTN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeRename: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  swipeDel: {
    backgroundColor: APP_THEME.color.danger,
  },
});
