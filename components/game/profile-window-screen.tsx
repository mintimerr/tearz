import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Children, useCallback, useState, type ReactNode } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GuestSignupSheet } from '@/components/auth/guest-signup-sheet';
import { ProfileLevelCard } from '@/components/profile/profile-level-card';
import { ProfileMistakesSection } from '@/components/profile/profile-mistakes-section';
import { GameWindowShell } from '@/components/game/game-window-shell';
import { HubTearzShelf } from '@/components/game/hub-tearz-shelf';
import { TearzAvatar } from '@/components/game/tearz-avatar';
import { CoinAmount } from '@/components/game/tearz-drop';
import { TearzWardrobeSheet } from '@/components/game/tearz-wardrobe-sheet';
import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import { TearzFirstVisit } from '@/components/onboarding/tearz-first-visit';
import { ProfileViralCard } from '@/components/viral/profile-viral-card';
import { AnimatedCounter } from '@/components/ui';
import { GAME_THEME } from '@/constants/game-theme';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/constants/legal';
import { COIN_REWARDS } from '@/constants/reward-rules';
import { REF_USER_PROFILE } from '@/constants/user-profile-reference';
import { isGuestAccount, useAuth, type NativeLanguage } from '@/contexts/auth-context';
import { useEngagement } from '@/contexts/engagement-context';
import { usePlacement } from '@/contexts/placement-context';
import { useTranslation } from '@/contexts/locale-context';
import { useTeacherJourney } from '@/contexts/teacher-journey-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useVocabulary } from '@/contexts/vocabulary-context';
import { computeStudyXp } from '@/utils/profile-study-stats';
import { studyLevelFromXp } from '@/utils/study-level';

const SECTION_GAP = 16;
const MENU_ICON = 'rgba(26,26,26,0.38)';

export function ProfileWindowScreen() {
  const insets = useSafeAreaInsets();
  const { entries } = useVocabulary();
  const { lessons } = useTeacherJourney();
  const { t, locale, setAppLocale } = useTranslation();
  const { user, signOut, updateNativeLanguage } = useAuth();
  const { dailyStreak, longestStreak, bonusXp, streakFreezeAvailable, ownedTearzIds, coins, tearzLoadout } =
    useEngagement();
  const { lifetimeStats, avatarUri, setAvatarUri } = useUserProfile();
  const { record: placementRecord } = usePlacement();
  const bottomPad = insets.bottom + 24;
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const guest = !user || isGuestAccount(user);

  const myWords = entries.length;

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
    <>
    <GameWindowShell title={t('profile.title')} titleDivider={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Pressable
            onPress={() => setWardrobeOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('profile.wardrobe')}
            style={styles.avatarPress}>
            <TearzAvatar loadout={tearzLoadout} size={120} />
          </Pressable>
          <Pressable
            onPress={() => setRewardsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('profile.rewardsTitle')}
            style={({ pressed }) => [styles.coinsRow, pressed && styles.rowPressed]}>
            <CoinAmount value={coins} textStyle={styles.coinsLabel} size={16} />
          </Pressable>
          {guest || !user ? (
            <Pressable
              onPress={() => setAuthOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('profile.guestAuthCta')}
              style={({ pressed }) => [styles.guestLink, pressed && styles.rowPressed]}>
              <Text style={styles.guestLinkText}>{t('profile.guestAuthCta')}</Text>
            </Pressable>
          ) : (
            <View style={styles.identity}>
              <Text style={styles.name}>{user.displayName}</Text>
              <Text style={styles.handle}>{user.email}</Text>
            </View>
          )}
        </View>

        <ProfileLevelCard
          xp={studyXp}
          level={studyLevel}
          levelWord={t('profile.levelRingLabel')}
          xpWord={t('profile.xpWord')}
          toNextLabel={(remaining) => t('profile.toNextLevel', { count: remaining })}
        />

        <View style={styles.statStrip}>
          <View style={styles.statCell}>
            <AnimatedCounter value={lessonCount} style={styles.statValue} />
            <Text style={styles.statHint}>{t('profile.lessons')}</Text>
          </View>
          <View style={styles.statCell}>
            <AnimatedCounter value={myWords} style={styles.statValue} />
            <Text style={styles.statHint}>{t('profile.words')}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{accuracyPct != null ? `${accuracyPct}%` : '—'}</Text>
            <Text style={styles.statHint}>{t('profile.accuracy')}</Text>
          </View>
        </View>
        {lifeTotal > 0 ? (
          <Text style={styles.practiceLine}>
            {lifeC} {t('profile.correct')} · {lifeW} {t('profile.wrong')}
          </Text>
        ) : null}

        <Group>
          {dailyStreak > 0 ? (
            <View style={styles.menuRow}>
              <Ionicons name="flame-outline" size={18} color={MENU_ICON} />
              <Text style={styles.menuLabel}>{t('engagement.streakDays', { count: dailyStreak })}</Text>
              {streakFreezeAvailable ? <Ionicons name="snow-outline" size={15} color={MENU_ICON} /> : null}
              {longestStreak > dailyStreak ? (
                <Text style={styles.menuValue}>{t('engagement.streakBest', { count: longestStreak })}</Text>
              ) : null}
            </View>
          ) : null}
          <ProfileMistakesSection asRow />
          <MenuRow icon="storefront-outline" label={t('profile.wardrobe')} onPress={() => setWardrobeOpen(true)} />
          <MenuRow
            icon="clipboard-outline"
            label={placementRecord ? t('placement.retakeEntrance') : t('placement.openEntrance')}
            value={
              placementRecord
                ? `${placementRecord.level}${placementRecord.hskLevel ? ` · ${placementRecord.hskLevel}` : ''}`
                : undefined
            }
            onPress={() => router.push('/onboarding/placement')}
          />
          <ProfileViralCard
            asRow
            displayName={!guest && user ? user.displayName : 'Tearz'}
            lessonCount={lessonCount}
            wordCount={myWords}
            accuracyPct={accuracyPct}
            studyXp={studyXp}
            level={studyLevel}
            avatarUri={avatarUri}
            avatarLetter={!guest && user ? user.displayName.trim().charAt(0).toUpperCase() || 'T' : 'T'}
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
        </Group>

        <View style={styles.langLine}>
          {langOptions.map((lang) => {
            const on = locale === lang.id;
            return (
              <Pressable
                key={lang.id}
                hitSlop={8}
                onPress={() => {
                  void (async () => {
                    if (user) await updateNativeLanguage(lang.id);
                    await setAppLocale(lang.id);
                  })();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}>
                <Text style={[styles.langWord, on && styles.langWordOn]}>{t(lang.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Group>
          <MenuRow
            icon="easel-outline"
            label={t('profile.instructor')}
            locked
            onPress={() => Alert.alert(t('profile.instructor'), t('profile.instructorSoon'))}
          />
        </Group>

        <View style={styles.shelfWrap}>
          <HubTearzShelf ownedIds={ownedTearzIds} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLinks}>
            <Text onPress={() => void Linking.openURL(getTermsOfServiceUrl())} style={styles.footerLink}>
              {t('profile.terms')}
            </Text>
            <Text style={styles.footerDot}>  ·  </Text>
            <Text onPress={() => void Linking.openURL(getPrivacyPolicyUrl())} style={styles.footerLink}>
              {t('profile.privacy')}
            </Text>
          </Text>
          <Text style={styles.footerVersion}>{appVersion}</Text>
          {!guest ? (
            <Pressable
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
              }}
              hitSlop={8}>
              <Text style={styles.footerSignOut}>{t('profile.signOut')}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </GameWindowShell>
    <TearzWardrobeSheet visible={wardrobeOpen} onClose={() => setWardrobeOpen(false)} />
    <RewardsSheet visible={rewardsOpen} onClose={() => setRewardsOpen(false)} />
    <GuestSignupSheet visible={authOpen} variant="profile" onClose={() => setAuthOpen(false)} />
    <TearzFirstVisit
      tipId="profile"
      pose={TEARZ_MARIO.idle}
      lines={[t('onboarding.profileLine1'), t('onboarding.profileLine2')]}
      ctaLabel={t('onboarding.gotIt')}
    />
    </>
  );
}

function Group({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter((child) => child != null && child !== false);
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      {items.map((child, index) => (
        <View key={index}>
          {index > 0 ? <View style={styles.groupSep} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

function MenuRow({
  icon,
  label,
  value,
  locked,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  locked?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.menuRow, pressed && styles.rowPressed]}>
      <Ionicons name={icon} size={18} color={MENU_ICON} />
      <Text style={styles.menuLabel} numberOfLines={1}>
        {label}
      </Text>
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      <Ionicons
        name={locked ? 'lock-closed-outline' : 'chevron-forward'}
        size={16}
        color="rgba(26,26,26,0.28)"
      />
    </Pressable>
  );
}

function RewardsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const rows: { label: string; value: number; note?: string }[] = [
    { label: t('profile.rewardStart'), value: COIN_REWARDS.starter },
    {
      label: t('profile.rewardLesson'),
      value: COIN_REWARDS.message,
      note: t('profile.rewardLessonCap', { count: COIN_REWARDS.messageMaxPerDay }),
    },
    { label: t('profile.rewardCards'), value: COIN_REWARDS.vocabSession },
    { label: t('profile.rewardAnswer'), value: COIN_REWARDS.drillPerCorrect },
    { label: t('profile.rewardGoal'), value: COIN_REWARDS.dailyGoal },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.rewardsRoot, { paddingTop: Math.max(insets.top, 12), paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.rewardsTop}>
          <Text style={styles.rewardsSheetTitle}>{t('profile.rewardsTitle')}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.rewardsClose} accessibilityLabel="Закрыть">
            <Ionicons name="close" size={22} color={GAME_THEME.color.ink} />
          </Pressable>
        </View>
        <Text style={styles.rewardsLead}>{t('profile.rewardsLead')}</Text>
        <View style={styles.gamePanel}>
          {rows.map((row, index) => (
            <View key={row.label}>
              {index > 0 ? <View style={styles.rowSeparator} /> : null}
              <View style={styles.rewardRow}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{row.label}</Text>
                  {row.note ? <Text style={styles.rowValue}>{row.note}</Text> : null}
                </View>
                <CoinAmount value={row.value} textStyle={styles.rewardValue} size={16} />
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.rewardsFoot}>{t('profile.rewardStreak')}</Text>
      </View>
    </Modal>
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
  rewardsRoot: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
    paddingHorizontal: 16,
  },
  rewardsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardsSheetTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  rewardsClose: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardsLead: {
    marginBottom: 16,
    fontSize: GAME_THEME.type.body,
    fontWeight: '600',
    lineHeight: 20,
    color: 'rgba(26,26,26,0.55)',
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rewardValue: {
    fontSize: 16,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  rewardsFoot: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    color: 'rgba(26,26,26,0.55)',
  },
  hero: {
    marginBottom: 8,
    alignItems: 'center',
    paddingTop: 4,
  },
  avatarPress: {
    marginBottom: 16,
    position: 'relative',
  },
  tearzAvatarRing: {
    width: 120,
    height: 120,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(26,26,26,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  coinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  coinsLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  coinsHint: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.45)',
  },
  identity: {
    alignItems: 'center',
    marginTop: 6,
  },
  guestLink: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  guestLinkText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: GAME_THEME.color.ink,
  },
  statStrip: {
    flexDirection: 'row',
    marginBottom: 22,
  },
  practiceLine: {
    marginTop: -14,
    marginBottom: 22,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.45)',
  },
  group: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26,26,26,0.12)',
    overflow: 'hidden',
  },
  groupSep: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
    backgroundColor: 'rgba(26,26,26,0.1)',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: GAME_THEME.color.ink,
  },
  menuValue: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.4)',
  },
  langLine: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
    marginTop: 22,
    marginBottom: 8,
  },
  langWord: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.32)',
  },
  langWordOn: {
    color: GAME_THEME.color.ink,
    fontWeight: '700',
  },
  shelfWrap: {
    marginTop: 28,
  },
  footer: {
    alignItems: 'center',
    gap: 10,
    marginTop: 28,
  },
  footerLinks: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.45)',
  },
  footerLink: {
    color: 'rgba(26,26,26,0.45)',
  },
  footerDot: {
    color: 'rgba(26,26,26,0.28)',
  },
  footerVersion: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.32)',
  },
  footerSignOut: {
    fontSize: 14,
    fontWeight: '600',
    color: GAME_THEME.color.danger,
  },
  wardrobeCta: {
    marginTop: 12,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
  },
  wardrobeCtaText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
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
  guestAuthBtn: {
    alignSelf: 'stretch',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
  },
  placementRow: {
    alignSelf: 'stretch',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
  },
  guestAuthLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
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
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
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
    fontSize: 22,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.4,
  },
  statHint: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.4)',
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
