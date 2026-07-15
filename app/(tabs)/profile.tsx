import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartoonStudyFlagsRow } from '@/components/profile/cartoon-study-flags';
import { ProfileLevelCard } from '@/components/profile/profile-level-card';
import { StreakChip } from '@/components/engagement/streak-chip';
import { ProfileViralCard } from '@/components/viral/profile-viral-card';
import { AnimatedCounter, PremiumChip, PremiumGroupedSection, PremiumScreenShell, PremiumSurface, ScreenHeader } from '@/components/ui';
import { APP_THEME } from '@/constants/theme';
import { REF_USER_PROFILE } from '@/constants/user-profile-reference';
import { useAuth, type NativeLanguage } from '@/contexts/auth-context';
import { useEngagement } from '@/contexts/engagement-context';
import { useTranslation } from '@/contexts/locale-context';
import { useTeacherJourney } from '@/contexts/teacher-journey-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useVocabulary } from '@/contexts/vocabulary-context';
import { entryScriptLang, type WordScriptLang } from '@/utils/detect-word-lang';
import { computeStudyXp, formatProfileStatNumber } from '@/utils/profile-study-stats';
import { studyLevelFromXp } from '@/utils/study-level';

const TAB_BAR_CORE = APP_THEME.tabBar.core;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { entries } = useVocabulary();
  const { lessons } = useTeacherJourney();
  const { t } = useTranslation();
  const { user, signOut, updateNativeLanguage } = useAuth();
  const { dailyStreak, longestStreak, bonusXp, streakFreezeAvailable, requestNotifications } = useEngagement();
  const { lifetimeStats, avatarUri, setAvatarUri, activityScriptLangs } = useUserProfile();
  const bottomPad = TAB_BAR_CORE + insets.bottom + 24;

  const myWords = entries.length;
  const myZh = entries.filter((e) => entryScriptLang(e) === 'zh').length;
  const myEn = entries.filter((e) => entryScriptLang(e) !== 'zh').length;

  const studyingLangs = useMemo(() => {
    const set = new Set<WordScriptLang>();
    for (const e of entries) set.add(entryScriptLang(e));
    for (const l of activityScriptLangs) set.add(l);
    return (['en', 'zh', 'ru'] as const).filter((l) => set.has(l));
  }, [entries, activityScriptLangs]);

  const { correct: lifeC, wrong: lifeW } = lifetimeStats;
  const lifeTotal = lifeC + lifeW;
  const accuracyPct =
    lifeTotal === 0 ? null : Math.min(100, Math.round((lifeC / lifeTotal) * 1000) / 10);
  const lessonCount = lessons.length;
  const studyXp = computeStudyXp(lessonCount, lifeC, myWords, bonusXp);
  const studyLevel = studyLevelFromXp(studyXp);

  const appVersion =
    Constants.expoConfig?.version != null
      ? `${t('profile.appName')} · v${Constants.expoConfig.version}`
      : t('profile.appName');

  const langOptions: { id: NativeLanguage; labelKey: 'auth.langRu' | 'auth.langZh' | 'auth.langEn' }[] = [
    { id: 'ru', labelKey: 'auth.langRu' },
    { id: 'zh', labelKey: 'auth.langZh' },
    { id: 'en', labelKey: 'auth.langEn' },
  ];

  const pickAvatar = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert(t('profile.webPhoto'), t('profile.webPhotoMessage'));
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('profile.noPhotoAccess'), t('profile.noPhotoAccessMessage'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  }, [setAvatarUri, t]);

  const openAvatarSheet = useCallback(() => {
    Alert.alert(t('profile.avatar'), t('profile.avatarMessage'), [
      { text: t('profile.pickPhoto'), onPress: () => void pickAvatar() },
      ...(avatarUri
        ? ([
            {
              text: t('profile.removePhoto'),
              style: 'destructive' as const,
              onPress: () => setAvatarUri(null),
            },
          ] as const)
        : []),
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }, [avatarUri, pickAvatar, setAvatarUri, t]);

  return (
    <PremiumScreenShell topOffset={8} style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('profile.title')} subtitle={t('profile.lead')} />

        <View style={styles.hero}>
          <Pressable
            onPress={openAvatarSheet}
            accessibilityRole="button"
            accessibilityLabel={t('profile.changeAvatar')}
            style={styles.avatarPress}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: REF_USER_PROFILE.avatarColor }]}>
                <Text style={styles.avatarLetter}>{REF_USER_PROFILE.letter}</Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={15} color="rgba(12,12,20,0.92)" />
            </View>
          </Pressable>
          <Text style={styles.name}>{user?.displayName ?? REF_USER_PROFILE.displayName}</Text>
          <Text style={styles.handle}>{user?.email ?? REF_USER_PROFILE.handle}</Text>
          <Text style={styles.meta}>{REF_USER_PROFILE.city}</Text>
          <Text style={styles.metaDim}>{REF_USER_PROFILE.joinedLabel}</Text>
          <CartoonStudyFlagsRow langs={studyingLangs} />
        </View>

        <ProfileLevelCard
          xp={studyXp}
          level={studyLevel}
          levelWord={t('profile.levelRingLabel')}
          xpWord={t('profile.xpWord')}
          toNextLabel={(remaining) => t('profile.toNextLevel', { count: remaining })}
        />

        {dailyStreak > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{t('engagement.streakTitle')}</Text>
            <PremiumSurface variant="elevated" style={styles.streakPanel}>
              <View style={styles.streakRow}>
                <StreakChip />
                {longestStreak > dailyStreak ? (
                  <Text style={styles.streakBest}>{t('engagement.streakBest', { count: longestStreak })}</Text>
                ) : null}
              </View>
              <Text style={styles.streakLead}>{t('engagement.streakLead')}</Text>
              {streakFreezeAvailable ? (
                <View style={styles.freezeRow}>
                  <Ionicons name="snow-outline" size={16} color={APP_THEME.color.link} />
                  <Text style={styles.freezeText}>{t('engagement.streakFreeze')}</Text>
                </View>
              ) : null}
            </PremiumSurface>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>{t('engagement.notifications')}</Text>
        <PremiumGroupedSection>
          <Pressable
            onPress={() => void requestNotifications()}
            style={({ pressed }) => [styles.notifRow, pressed && styles.notifRowPressed]}
            accessibilityRole="button">
            <View style={styles.notifCopy}>
              <Text style={styles.notifTitle}>{t('engagement.enableNotifications')}</Text>
              <Text style={styles.notifLead}>{t('engagement.notificationsLead')}</Text>
            </View>
            <Ionicons name="notifications-outline" size={22} color={APP_THEME.color.muted} />
          </Pressable>
        </PremiumGroupedSection>

        <Text style={styles.sectionLabel}>{t('profile.appLanguage')}</Text>
        <View style={styles.langRow}>
          {langOptions.map((lang) => (
            <PremiumChip
              key={lang.id}
              label={t(lang.labelKey)}
              active={user?.nativeLanguage === lang.id}
              onPress={() => void updateNativeLanguage(lang.id)}
              style={styles.langChip}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t('profile.stats')}</Text>
        <PremiumSurface variant="elevated" style={styles.statPanel}>
          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <AnimatedCounter value={lessonCount} style={styles.statValue} />
              <Text style={styles.statHint}>{t('profile.lessons')}</Text>
              <Text style={styles.statSub}>{t('profile.lessonsSub')}</Text>
            </View>
            <View style={styles.statRuleV} />
            <View style={styles.statCell}>
              <AnimatedCounter value={myWords} style={styles.statValue} />
              <Text style={styles.statHint}>{t('profile.words')}</Text>
              <Text style={styles.statSub}>
                EN {myEn} · 中文 {myZh}
              </Text>
            </View>
          </View>
          <View style={styles.statRuleH} />
          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{accuracyPct != null ? `${accuracyPct}%` : '—'}</Text>
              <Text style={styles.statHint}>{t('profile.accuracy')}</Text>
              <Text style={styles.statSub}>
                {lifeTotal ? t('profile.accuracyTraining') : t('profile.accuracyNoData')}
              </Text>
            </View>
            <View style={styles.statRuleV} />
            <View style={styles.statCell}>
              <AnimatedCounter
                value={studyXp}
                style={styles.statValue}
                format={formatProfileStatNumber}
              />
              <Text style={styles.statHint}>{t('profile.xp')}</Text>
              <Text style={styles.statSub}>{t('profile.xpSub')}</Text>
            </View>
          </View>
        </PremiumSurface>

        <ProfileViralCard
          displayName={user?.displayName ?? REF_USER_PROFILE.displayName}
          lessonCount={lessonCount}
          wordCount={myWords}
          accuracyPct={accuracyPct}
          studyXp={studyXp}
          level={studyLevel}
          avatarUri={avatarUri}
          avatarLetter={(user?.displayName ?? REF_USER_PROFILE.displayName).trim().charAt(0).toUpperCase() || REF_USER_PROFILE.letter}
          avatarColor={REF_USER_PROFILE.avatarColor}
          sectionTitle={t('viral.shareSection')}
          sectionLead={t('viral.shareSectionLead')}
          shareProgressLabel={t('viral.shareProgress')}
          userId={user?.id ?? null}
          shareMessage={t('viral.shareMessage')}
          shareInviteLine={t('viral.shareInviteLine')}
          shareCardTagline={t('viral.shareCardTagline')}
          shareErrorTitle={t('viral.shareErrorTitle')}
          shareErrorMessage={t('viral.shareErrorMessage')}
          shareDialogTitle={t('viral.shareModalTitle')}
          cardLabels={{
            level: t('viral.level'),
            lessons: t('profile.lessons'),
            words: t('profile.words'),
            accuracy: t('profile.accuracy'),
            xp: t('profile.xp'),
            progressTitle: t('viral.shareModalTitle'),
            joinCta: t('viral.shareCardJoinCta'),
            inviteHint: t('viral.shareCardInviteHint'),
          }}
        />

        <Text style={styles.sectionLabel}>{t('profile.training')}</Text>
        <Text style={styles.sectionSub}>{t('profile.trainingLead')}</Text>
        <PremiumSurface variant="elevated" style={styles.statPanel}>
          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <AnimatedCounter value={lifeC} style={styles.statValue} />
              <Text style={styles.statHint}>{t('profile.correct')}</Text>
              <Text style={styles.statSub}>{t('profile.correctSub')}</Text>
            </View>
            <View style={styles.statRuleV} />
            <View style={styles.statCell}>
              <AnimatedCounter value={lifeW} style={styles.statValue} />
              <Text style={styles.statHint}>{t('profile.wrong')}</Text>
              <Text style={styles.statSub}>{t('profile.wrongSub')}</Text>
            </View>
          </View>
          <View style={styles.statRuleH} />
          <View style={styles.statRow}>
            <View style={[styles.statCell, styles.statCellWide]}>
              <AnimatedCounter value={lifeTotal} style={styles.statValue} />
              <Text style={styles.statHint}>{t('profile.total')}</Text>
              <Text style={styles.statSub}>{t('profile.totalSub')}</Text>
            </View>
          </View>
        </PremiumSurface>

        <PremiumGroupedSection title={t('profile.about')}>
          <Row icon="information-circle-outline" title={t('profile.version')} value={appVersion} showSeparator />
          <Row icon="document-text-outline" title={t('profile.terms')} value={t('common.soon')} chevron showSeparator />
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => {
              Alert.alert(t('profile.signOutTitle'), t('profile.signOutMessage'), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('profile.signOutAction'),
                  style: 'destructive',
                  onPress: () => {
                    void signOut().then(() => router.replace('/(auth)/welcome'));
                  },
                },
              ]);
            }}>
            <Ionicons name="log-out-outline" size={22} color={APP_THEME.color.danger} style={styles.rowIcon} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{t('profile.account')}</Text>
              <Text style={[styles.rowValue, styles.signOutValue]}>{t('profile.signOut')}</Text>
            </View>
          </Pressable>
        </PremiumGroupedSection>
      </ScrollView>
    </PremiumScreenShell>
  );
}

function Row({
  icon,
  title,
  value,
  chevron,
  showSeparator,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  chevron?: boolean;
  showSeparator?: boolean;
}) {
  const inner = (
    <>
      <Ionicons name={icon} size={22} color={APP_THEME.color.muted} style={styles.rowIcon} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
      {chevron ? <Ionicons name="chevron-forward" size={18} color={APP_THEME.color.mutedFaint} /> : null}
      {showSeparator ? <View style={styles.rowSeparator} /> : null}
    </>
  );
  if (chevron) {
    return (
      <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => {}}>
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.row}>{inner}</View>;
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: APP_THEME.color.bg,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 0 },
  hero: {
    marginBottom: APP_THEME.space.xxxl,
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatarPress: {
    marginBottom: 16,
    position: 'relative',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 36,
    fontWeight: '600',
    color: APP_THEME.color.text,
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.elevatedSoft,
    borderWidth: 2,
    borderColor: APP_THEME.color.bg,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: APP_THEME.color.text,
    letterSpacing: -0.4,
  },
  handle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '400',
    color: APP_THEME.color.muted,
  },
  meta: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '400',
    color: APP_THEME.color.muted,
  },
  metaDim: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
    color: APP_THEME.color.mutedSoft,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: APP_THEME.space.xxl,
  },
  langChip: {
    flexGrow: 1,
    flexBasis: '28%',
    minWidth: 88,
  },
  sectionLabel: {
    marginTop: APP_THEME.space.sm,
    marginBottom: APP_THEME.space.sm,
    marginLeft: APP_THEME.space.lg,
    ...APP_THEME.type.label,
    color: APP_THEME.color.muted,
  },
  sectionSub: {
    marginTop: -6,
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18,
    color: APP_THEME.color.muted,
  },
  statPanel: {
    marginBottom: APP_THEME.space.xxl,
  },
  streakPanel: {
    marginBottom: APP_THEME.space.xxl,
    padding: APP_THEME.space.lg,
    gap: 10,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  streakBest: {
    ...APP_THEME.type.caption,
    color: APP_THEME.color.mutedSoft,
  },
  streakLead: {
    ...APP_THEME.type.caption,
    lineHeight: 20,
    color: APP_THEME.color.muted,
  },
  freezeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  freezeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: APP_THEME.color.link,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: APP_THEME.space.lg,
    backgroundColor: APP_THEME.color.elevated,
  },
  notifRowPressed: {
    opacity: 0.88,
  },
  notifCopy: {
    flex: 1,
    gap: 4,
  },
  notifTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_THEME.color.text,
    letterSpacing: -0.2,
  },
  notifLead: {
    fontSize: 13,
    lineHeight: 18,
    color: APP_THEME.color.muted,
  },
  statRow: {
    flexDirection: 'row',
  },
  statCell: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: APP_THEME.space.lg,
    alignItems: 'flex-start',
  },
  statCellWide: {
    flex: 1,
  },
  statRuleV: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: APP_THEME.color.separator,
  },
  statRuleH: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: APP_THEME.color.separator,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '600',
    color: APP_THEME.color.text,
    letterSpacing: -0.6,
  },
  statHint: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
    color: APP_THEME.color.muted,
  },
  statSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '400',
    color: APP_THEME.color.mutedSoft,
  },
  listCard: {
    borderRadius: APP_THEME.radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: APP_THEME.space.lg,
    backgroundColor: APP_THEME.color.elevated,
    position: 'relative',
  },
  rowSeparator: {
    position: 'absolute',
    left: APP_THEME.space.lg,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: APP_THEME.color.separator,
  },
  rowPressed: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  rowIcon: {
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...APP_THEME.type.label,
    color: APP_THEME.color.mutedSoft,
  },
  rowValue: {
    marginTop: 2,
    ...APP_THEME.type.caption,
    fontWeight: '500',
    color: APP_THEME.color.textSoft,
  },
  signOutValue: {
    color: APP_THEME.color.danger,
  },
});
