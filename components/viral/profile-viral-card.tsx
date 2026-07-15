import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View, type View as RNView } from 'react-native';

import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import {
  PROGRESS_CARD_HEIGHT,
  PROGRESS_CARD_WIDTH,
  ProgressShareCard,
  type ProgressShareCardData,
} from '@/components/viral/progress-share-card';
import { APP_THEME } from '@/constants/theme';
import { shareProgressCardImage } from '@/utils/share-progress-card';
import { buildTearzInviteUrl } from '@/utils/tearz-invite';

type Props = {
  displayName: string;
  lessonCount: number;
  wordCount: number;
  accuracyPct: number | null;
  studyXp: number;
  level: number;
  avatarUri?: string | null;
  avatarLetter: string;
  avatarColor: string;
  shareProgressLabel: string;
  sectionTitle: string;
  sectionLead: string;
  userId: string | null;
  shareMessage: string;
  shareInviteLine: string;
  shareCardTagline: string;
  shareErrorTitle: string;
  shareErrorMessage: string;
  shareDialogTitle: string;
  cardLabels: {
    level: string;
    lessons: string;
    words: string;
    accuracy: string;
    xp: string;
    progressTitle: string;
    joinCta: string;
    inviteHint: string;
  };
};

export function ProfileViralCard({
  displayName,
  lessonCount,
  wordCount,
  accuracyPct,
  studyXp,
  level,
  avatarUri,
  avatarLetter,
  avatarColor,
  shareProgressLabel,
  sectionTitle,
  sectionLead,
  userId,
  shareMessage,
  shareInviteLine,
  shareCardTagline,
  shareErrorTitle,
  shareErrorMessage,
  shareDialogTitle,
  cardLabels,
}: Props) {
  const cardRef = useRef<RNView>(null);
  const [sharing, setSharing] = useState(false);

  const inviteUrl = useMemo(() => buildTearzInviteUrl(userId), [userId]);

  const cardData: ProgressShareCardData = useMemo(
    () => ({
      displayName,
      level,
      studyXp,
      lessonCount,
      wordCount,
      accuracyPct,
      inviteUrl,
      avatarUri,
      avatarLetter,
      avatarColor,
      shareCaption: {
        headline: shareMessage,
        inviteLine: shareInviteLine,
      },
      labels: {
        ...cardLabels,
        tagline: shareCardTagline,
      },
    }),
    [
      displayName,
      level,
      studyXp,
      lessonCount,
      wordCount,
      accuracyPct,
      inviteUrl,
      avatarUri,
      avatarLetter,
      avatarColor,
      cardLabels,
      shareMessage,
      shareInviteLine,
      shareCardTagline,
    ],
  );

  const onShareProgress = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      await shareProgressCardImage(cardRef, shareDialogTitle);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(shareErrorTitle, shareErrorMessage);
    } finally {
      setSharing(false);
    }
  }, [sharing, shareDialogTitle, shareErrorTitle, shareErrorMessage]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>{sectionTitle}</Text>
      <Text style={styles.sectionLead}>{sectionLead}</Text>

      <AuthPrimaryButton
        label={shareProgressLabel}
        onPress={() => void onShareProgress()}
        disabled={sharing}
        style={styles.shareBtn}
      />

      <View style={styles.captureHost} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ProgressShareCard ref={cardRef} data={cardData} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    marginBottom: 4,
  },
  sectionLabel: {
    marginTop: 28,
    ...APP_THEME.type.label,
    color: APP_THEME.color.mutedSoft,
  },
  sectionLead: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    color: APP_THEME.color.muted,
    maxWidth: 320,
  },
  shareBtn: {
    marginTop: 0,
  },
  captureHost: {
    position: 'absolute',
    left: -10_000,
    top: 0,
    width: PROGRESS_CARD_WIDTH,
    height: PROGRESS_CARD_HEIGHT,
    opacity: 1,
  },
});
