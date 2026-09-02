import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartoonStudyFlagsRow } from '@/components/profile/cartoon-study-flags';
import { ProfileLevelCard } from '@/components/profile/profile-level-card';
import { ProfileMistakesSection } from '@/components/profile/profile-mistakes-section';
import { GameWindowShell } from '@/components/game/game-window-shell';
import { HubTearzShelf } from '@/components/game/hub-tearz-shelf';
import { StreakChip } from '@/components/engagement/streak-chip';
import { ProfileViralCard } from '@/components/viral/profile-viral-card';
import { AnimatedCounter, PremiumChip } from '@/components/ui';
import { DEMO_SKIP_AUTH } from '@/constants/demo';
import { GAME_THEME } from '@/constants/game-theme';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/constants/legal';
import { COIN_REWARDS } from '@/constants/reward-rules';
import { REF_USER_PROFILE } from '@/constants/user-profile-reference';
import { useAuth, type NativeLanguage } from '@/contexts/auth-context';
import { useEngagement } from '@/contexts/engagement-context';
import { usePlacement } from '@/contexts/placement-context';
import { useTranslation } from '@/contexts/locale-context';
import { useTeacherJourney } from '@/contexts/teacher-journey-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useVocabulary } from '@/contexts/vocabulary-context';
import { entryScriptLang, type WordScriptLang } from '@/utils/detect-word-lang';
import { computeStudyXp, formatProfileStatNumber } from '@/utils/profile-study-stats';
import { studyLevelFromXp } from '@/utils/study-level';

const SECTION_GAP = 16;

export function ProfileWindowScreen() {
  const insets = useSafeAreaInsets();
  const { entries } = useVocabulary();
  const { lessons } = useTeacherJourney();
  const { t, locale, setAppLocale } = useTranslation();
  const { user, signOut, updateNativeLanguage } = useAuth();
  const { dailyStreak, longestStreak, bonusXp, streakFreezeAvailable, ownedTearzIds } =
    useEngagement();
  const { lifetimeStats, avatarUri, setAvatarUri, activityScriptLangs } = useUserProfile();
  const { record: placementRecord } = usePlacement();
  const bottomPad = insets.bottom + 24;

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
    <GameWindowShell title={t('profile.title')}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>{t('profile.lead')}</Text>

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

        {placementRecord ? (
          <View style={styles.placementBadge}>
            <Ionicons name="ribbon-outline" size={18} color={GAME_THEME.color.ink} />
            <Text style={styles.placementBadgeText}>
              {t('placement.profileLevel', { level: placementRecord.level })}
              {placementRecord.hskLevel ? ` · ${placementRecord.hskLevel}` : ''}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push('/onboarding/placement')}
          style={({ pressed }) => [styles.placementCta, pressed && styles.rowPressed]}>
          <Ionicons name="school-outline" size={20} color={GAME_THEME.color.ink} />
          <Text style={styles.placementCtaText}>
            {placementRecord ? t('placement.retake') : t('placement.openTest')}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(26,26,26,0.45)" />
        </Pressable>

        {dailyStreak > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{t('engagement.streakTitle')}</Text>
            <View style={[styles.gamePanel, styles.streakPanel]}>
              <View style={styles.streakRow}>
                <StreakChip />
                {longestStreak > dailyStreak ? (
                  <Text style={styles.streakBest}>{t('engagement.streakBest', { count: longestStreak })}</Text>
                ) : null}
              </View>
              <Text style={styles.streakLead}>{t('engagement.streakLead')}</Text>
              {streakFreezeAvailable ? (
                <View style={styles.freezeRow}>
                  <Ionicons name="snow-outline" size={16} color={GAME_THEME.color.sky} />
                  <Text style={styles.freezeText}>{t('engagement.streakFreeze')}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        <ProfileMistakesSection />

        <Text style={styles.sectionLabel}>{t('profile.appLanguage')}</Text>
        <View style={styles.langRow}>
          {langOptions.map((lang) => (
            <PremiumChip
              key={lang.id}
              label={t(lang.labelKey)}
              active={locale === lang.id}
              onPress={() => {
                void (async () => {
                  if (user) await updateNativeLanguage(lang.id);
                  await setAppLocale(lang.id);
                })();
              }}
              style={styles.langChip}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t('profile.stats')}</Text>
        <View style={[styles.gamePanel, styles.statPanel]}>
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
        </View>

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
        <View style={[styles.gamePanel, styles.statPanel]}>
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
        </View>

        <Text style={styles.sectionLabel}>{t('profile.collection')}</Text>
        <View style={[styles.gamePanel, styles.shelfPanel]}>
          <HubTearzShelf ownedIds={ownedTearzIds} />
        </View>

        <Text style={styles.sectionLabel}>{t('profile.rewards')}</Text>
        <View style={styles.gamePanel}>
          <View style={styles.rewardsBlock}>
            <Text style={styles.rewardsTitle}>{t('profile.rewardsTitle')}</Text>
            <Text style={styles.rewardsBody}>
              {t('profile.rewardsBody', {
                starter: COIN_REWARDS.starter,
                message: COIN_REWARDS.message,
                messageMax: COIN_REWARDS.messageMaxPerDay,
                vocab: COIN_REWARDS.vocabSession,
                drill: COIN_REWARDS.drillPerCorrect,
                dailyGoal: COIN_REWARDS.dailyGoal,
              })}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('profile.about')}</Text>
        <View style={styles.gamePanel}>
          <Row icon="information-circle-outline" title={t('profile.version')} value={appVersion} showSeparator />
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => void Linking.openURL(getTermsOfServiceUrl())}
            accessibilityRole="link">
            <Ionicons name="document-text-outline" size={22} color={GAME_THEME.color.ink} style={styles.rowIcon} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{t('profile.terms')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(26,26,26,0.35)" />
          </Pressable>
          <View style={styles.rowSeparator} />
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => void Linking.openURL(getPrivacyPolicyUrl())}
            accessibilityRole="link">
            <Ionicons name="shield-checkmark-outline" size={22} color={GAME_THEME.color.ink} style={styles.rowIcon} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{t('profile.privacy')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(26,26,26,0.35)" />
          </Pressable>
          {!DEMO_SKIP_AUTH ? (
            <>
              <View style={styles.rowSeparator} />
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
                <Ionicons name="log-out-outline" size={22} color={GAME_THEME.color.danger} style={styles.rowIcon} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{t('profile.account')}</Text>
                  <Text style={[styles.rowValue, styles.signOutValue]}>{t('profile.signOut')}</Text>
                </View>
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>
    </GameWindowShell>
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
      <Ionicons name={icon} size={22} color="rgba(26,26,26,0.45)" style={styles.rowIcon} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
      {chevron ? <Ionicons name="chevron-forward" size={18} color="rgba(26,26,26,0.35)" /> : null}
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
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 0 },
  lead: {
    marginBottom: 12,
    fontSize: GAME_THEME.type.body,
    fontWeight: '600',
    lineHeight: 20,
    color: 'rgba(26,26,26,0.55)',
  },
  gamePanel: {
    backgroundColor: GAME_THEME.color.panelFill,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
    borderRadius: GAME_THEME.radius.panel,
    overflow: 'hidden',
    marginBottom: SECTION_GAP,
  },
  shelfPanel: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  rewardsBlock: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  rewardsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  rewardsBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.62)',
  },
  hero: {
    marginBottom: 24,
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
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
  },
  avatarLetter: {
    fontSize: 36,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
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
    backgroundColor: GAME_THEME.color.gold,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  name: {
    fontSize: 24,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.2,
  },
  handle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
  },
  meta: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
  },
  metaDim: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.45)',
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SECTION_GAP,
  },
  langChip: {
    flexGrow: 1,
    flexBasis: '28%',
    minWidth: 88,
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: GAME_THEME.type.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.55)',
  },
  sectionSub: {
    marginTop: -6,
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
  },
  statPanel: {
    marginBottom: SECTION_GAP,
  },
  streakPanel: {
    padding: 16,
    gap: 10,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  streakBest: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.45)',
  },
  streakLead: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
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
    fontWeight: '700',
    color: GAME_THEME.color.goldLip,
  },
  statRow: {
    flexDirection: 'row',
  },
  statCell: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  statCellWide: {
    flex: 1,
  },
  statRuleV: {
    width: GAME_THEME.border.thin,
    backgroundColor: GAME_THEME.color.ink,
    opacity: 0.12,
  },
  statRuleH: {
    height: GAME_THEME.border.thin,
    backgroundColor: GAME_THEME.color.ink,
    opacity: 0.12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.4,
  },
  statHint: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.55)',
  },
  statSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.45)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: GAME_THEME.color.panelFill,
    position: 'relative',
  },
  rowSeparator: {
    position: 'absolute',
    left: 16,
    right: 0,
    bottom: 0,
    height: GAME_THEME.border.thin,
    backgroundColor: GAME_THEME.color.ink,
    opacity: 0.12,
  },
  rowPressed: {
    backgroundColor: GAME_THEME.color.panelMuted,
  },
  rowIcon: {
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: GAME_THEME.type.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.45)',
  },
  rowValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
  },
  signOutValue: {
    color: GAME_THEME.color.danger,
  },
  placementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: -4,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  placementBadgeText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: GAME_THEME.color.ink,
  },
  placementCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 5,
  },
  placementCtaText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
});
