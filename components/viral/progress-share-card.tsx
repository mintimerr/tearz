import { Image } from 'expo-image';
import { forwardRef } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { APP_THEME } from '@/constants/theme';
import { formatProfileStatNumber } from '@/utils/profile-study-stats';

/** 4:5 — формат Stories / ленты; с запасом под нижнюю полосу со ссылкой */
export const PROGRESS_CARD_WIDTH = 540;
export const PROGRESS_CARD_HEIGHT = 720;

export type ProgressShareCardData = {
  displayName: string;
  level: number;
  studyXp: number;
  lessonCount: number;
  wordCount: number;
  accuracyPct: number | null;
  inviteUrl: string;
  avatarUri?: string | null;
  avatarLetter: string;
  avatarColor: string;
  shareCaption: {
    headline: string;
    inviteLine: string;
  };
  labels: {
    level: string;
    lessons: string;
    words: string;
    accuracy: string;
    xp: string;
    tagline: string;
    progressTitle: string;
    joinCta: string;
    inviteHint: string;
  };
};

type Props = ViewProps & {
  data: ProgressShareCardData;
};

const AVATAR = 84;
const RING_STROKE = 3;
const RING_SIZE = AVATAR + 12;

function levelProgress(xp: number) {
  const inLevel = xp % 400;
  return Math.max(0.06, Math.min(1, inLevel / 400));
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AvatarRing({ progress }: { progress: number }) {
  const r = (RING_SIZE - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * progress;

  return (
    <Svg width={RING_SIZE} height={RING_SIZE} style={styles.avatarRingSvg}>
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={r}
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={RING_STROKE}
        fill="none"
      />
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={r}
        stroke="#FFFFFF"
        strokeWidth={RING_STROKE}
        fill="none"
        strokeDasharray={`${dash} ${c - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
    </Svg>
  );
}

function ShareCardBackdrop() {
  return (
    <Svg width={PROGRESS_CARD_WIDTH} height={PROGRESS_CARD_HEIGHT} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="glowTop" cx="72%" cy="0%" rx="55%" ry="42%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.1} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="glowBottom" cx="18%" cy="100%" rx="48%" ry="38%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.05} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={PROGRESS_CARD_WIDTH * 0.82} cy={-40} r={200} fill="url(#glowTop)" />
      <Circle cx={PROGRESS_CARD_WIDTH * 0.12} cy={PROGRESS_CARD_HEIGHT + 30} r={170} fill="url(#glowBottom)" />
    </Svg>
  );
}

export const ProgressShareCard = forwardRef<View, Props>(function ProgressShareCard(
  { data, style, ...rest },
  ref,
) {
  const xpPct = levelProgress(data.studyXp);
  const accText = data.accuracyPct != null ? `${data.accuracyPct}%` : '—';

  return (
    <View ref={ref} collapsable={false} style={[styles.root, style]} {...rest}>
      <ShareCardBackdrop />
      <View style={styles.frame} pointerEvents="none" />

      <View style={styles.body}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.brand}>tearz</Text>
            <View style={styles.progressPill}>
              <Text style={styles.progressPillText}>{data.labels.progressTitle}</Text>
            </View>
          </View>

          <View style={styles.identityCard}>
            <View style={styles.avatarShell}>
              <AvatarRing progress={xpPct} />
              {data.avatarUri ? (
                <Image source={{ uri: data.avatarUri }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: data.avatarColor }]}>
                  <Text style={styles.avatarLetter}>{data.avatarLetter}</Text>
                </View>
              )}
            </View>

            <View style={styles.identityCopy}>
              <Text style={styles.displayName} numberOfLines={1}>
                {data.displayName}
              </Text>
              <Text style={styles.tagline} numberOfLines={2}>
                {data.labels.tagline}
              </Text>
              <View style={styles.levelRow}>
                <Text style={styles.levelLabel}>{data.labels.level}</Text>
                <Text style={styles.levelValue}>{data.level}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsCard}>
            <StatTile value={String(data.lessonCount)} label={data.labels.lessons} />
            <View style={styles.statDivider} />
            <StatTile value={String(data.wordCount)} label={data.labels.words} />
            <View style={styles.statDivider} />
            <StatTile value={accText} label={data.labels.accuracy} />
          </View>

          <View style={styles.xpCard}>
            <View style={styles.xpHeader}>
              <Text style={styles.xpTitle}>{data.labels.xp}</Text>
              <Text style={styles.xpValue}>{formatProfileStatNumber(data.studyXp)}</Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${xpPct * 100}%` }]} />
            </View>
          </View>

          <View style={styles.messageBlock}>
            <Text style={styles.footerHeadline}>{data.shareCaption.headline}</Text>
            <Text style={styles.footerInvite}>{data.shareCaption.inviteLine}</Text>
          </View>
        </View>

        <View style={styles.linkFooter}>
          <Text style={styles.linkFooterEyebrow}>{data.labels.joinCta}</Text>
          <Text style={styles.linkFooterUrl} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>
            {data.inviteUrl}
          </Text>
          <Text style={styles.linkFooterHint}>{data.labels.inviteHint}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    width: PROGRESS_CARD_WIDTH,
    height: PROGRESS_CARD_HEIGHT,
    borderRadius: APP_THEME.radius.sheet,
    overflow: 'hidden',
    backgroundColor: APP_THEME.color.bg,
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: APP_THEME.radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.borderStrong,
  },
  body: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 36,
    paddingTop: 40,
    paddingBottom: 20,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'lowercase',
    color: APP_THEME.color.text,
  },
  progressPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: APP_THEME.color.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  progressPillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: APP_THEME.color.textSoft,
    textTransform: 'uppercase',
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    padding: 18,
    borderRadius: APP_THEME.radius.xl,
    backgroundColor: APP_THEME.color.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  avatarShell: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingSvg: {
    position: 'absolute',
  },
  avatarImage: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  avatarFallback: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  identityCopy: {
    flex: 1,
    gap: 4,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.45,
    color: APP_THEME.color.text,
  },
  tagline: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: APP_THEME.color.muted,
    letterSpacing: -0.08,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 6,
  },
  levelLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: APP_THEME.color.mutedSoft,
  },
  levelValue: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: APP_THEME.color.text,
    fontVariant: ['tabular-nums'],
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 20,
    paddingHorizontal: 8,
    borderRadius: APP_THEME.radius.xl,
    backgroundColor: APP_THEME.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: APP_THEME.color.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.15,
    color: APP_THEME.color.mutedSoft,
    textAlign: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: APP_THEME.color.border,
    marginVertical: 4,
  },
  xpCard: {
    gap: 10,
    paddingHorizontal: 4,
  },
  xpHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  xpTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: APP_THEME.color.mutedSoft,
  },
  xpValue: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: APP_THEME.color.textSoft,
    fontVariant: ['tabular-nums'],
  },
  xpTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: APP_THEME.color.text,
  },
  messageBlock: {
    gap: 6,
  },
  footerHeadline: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: APP_THEME.color.text,
  },
  footerInvite: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: APP_THEME.color.muted,
  },
  linkFooter: {
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: APP_THEME.color.borderStrong,
    backgroundColor: APP_THEME.color.elevated,
    gap: 6,
  },
  linkFooterEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: APP_THEME.color.mutedSoft,
  },
  linkFooterUrl: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: APP_THEME.color.text,
  },
  linkFooterHint: {
    fontSize: 12,
    lineHeight: 16,
    color: APP_THEME.color.mutedSoft,
  },
});
