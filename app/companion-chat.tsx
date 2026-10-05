import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/utils/safe-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  InteractionManager,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type AppStateStatus,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Reanimated, {
  Easing as ReEasing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { CompanionAttachmentSheet } from '@/components/companion/companion-attachment-sheet';
import { CompanionIncomingBubble } from '@/components/companion/companion-incoming-bubble';
import { CompanionCallScreen } from '@/components/companion/companion-call-screen';
import { companionMessageStyles as msgStyles } from '@/components/chat/chat-message-styles';
import { GameBackButton } from '@/components/game/game-back-button';
import { GAME_THEME } from '@/constants/game-theme';
import { CompanionVoiceComposer } from '@/components/companion/companion-voice-record-control';
import { TeacherMessageBody } from '@/components/teacher/teacher-message-body';
import { TeacherExerciseActions } from '@/components/teacher/teacher-exercise-actions';
import { useTeacherDrillSession, TeacherDrillSessionOverlay } from '@/components/teacher/teacher-drill-session';
import {
  TeacherFullWorkoutPaywall,
  type TearzPlusFeature,
} from '@/components/teacher/teacher-full-workout-paywall';
import { TeacherChatComposer } from '@/components/teacher/teacher-chat-composer';
import { teacherChatStyles as tStyles } from '@/components/teacher/teacher-chat-styles';
import type { TeacherComposerAttachment } from '@/components/teacher/teacher-home-composer';
import { FileMessageBubble } from '@/components/companion/file-message-bubble';
import { ImageMessageBubble } from '@/components/companion/image-message-bubble';
import { VoiceMessageBubble } from '@/components/companion/voice-message-bubble';
import { LongPressWordText } from '@/components/long-press-word-text';
import { WordAddSheetHost, useWordAddSheet } from '@/components/word-add-sheet';
import { useAuth } from '@/contexts/auth-context';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import { useTranslation } from '@/contexts/locale-context';
import { useTeacherJourney } from '@/contexts/teacher-journey-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useEngagement } from '@/contexts/engagement-context';
import { useLexicon } from '@/contexts/lexicon-context';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { useCompanionCall } from '@/hooks/use-companion-call';
import { useLearnerModel } from '@/hooks/use-learner-model';
import {
  postCompanionChatReply,
  postTeacherChatReply,
  postTeacherExerciseCheck,
  postTeacherExerciseSet,
} from '@/services/companion-chat-ai';
import { postCompanionVoiceTranscribe } from '@/services/companion-voice-transcribe';
import { buildFallbackExercises } from '@/utils/teacher-exercise-fallback';
import type {
  CompanionChatApiLanguage,
  TeacherDrillFollowUp,
  TeacherExerciseItem,
  TeacherNextTopicRecommendation,
} from '@/types/companion-chat-api';
import {
  isFileMsg,
  isImageMsg,
  isVoiceMsg,
  type CompanionMsg,
  type CompanionReadState,
} from '@/types/companion-message';
import { persistCompanionAttachment } from '@/utils/companion-attachment-storage';
import { prepareCompanionImageForApi } from '@/utils/companion-image-base64';
import { messagesToCompanionApiHistory } from '@/utils/companion-chat-history';
import { normalizeTeacherExerciseSet } from '@/utils/teacher-exercise-normalize';
import { resolveDrillTargetLanguage } from '@/utils/teacher-lesson-language';
import {
  teacherPhotoFallbackMessage,
  teacherUiLanguageFromLocale,
} from '@/utils/teacher-ui-language';
import {
  evaluateMiniDrillAccess,
  getPriorExerciseTexts,
  loadMiniDrillUsage,
  recordMiniDrillGeneration,
  saveMiniDrillUsage,
  type MiniDrillUsage,
} from '@/utils/teacher-mini-drill-usage';
import {
  getMistakeSummariesForApi,
  loadDrillMistakes,
  recordDrillMistakes,
  saveDrillMistakes,
  type TeacherDrillMistakeRecord,
} from '@/utils/teacher-drill-mistakes';
import { buildFollowUpChatMessage } from '@/utils/teacher-drill-followup';
import { takeTeacherLessonBootstrap } from '@/utils/teacher-lesson-bootstrap';
import { persistCompanionVoice } from '@/utils/companion-voice-storage';
import { pickCompanionPhoto } from '@/utils/pick-companion-photo';

const CHAT_SOFT_EASING = ReEasing.bezier(0.22, 1, 0.36, 1);
const CHAT_SOFT_MS = 520;
const SOFT_MSG_ENTER = FadeInDown.duration(340)
  .easing(CHAT_SOFT_EASING)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });
const SOFT_TYPING_ENTER = FadeIn.duration(280).easing(CHAT_SOFT_EASING);
const SOFT_TYPING_EXIT = FadeOut.duration(180).easing(ReEasing.out(ReEasing.quad));

function useChatSoftEnter(resetKey: string) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      32,
      withTiming(1, { duration: CHAT_SOFT_MS, easing: CHAT_SOFT_EASING }),
    );
  }, [progress, resetKey]);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.42], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 0.55], [-6, 0], Extrapolation.CLAMP) },
    ],
  }));

  const midStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.1, 0.7], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0.1, 0.8], [10, 0], Extrapolation.CLAMP) },
    ],
  }));

  const footStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.22, 0.92], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0.22, 1], [14, 0], Extrapolation.CLAMP) },
    ],
  }));

  return { headerStyle, midStyle, footStyle };
}

/** Первый кадр ленты — без анимации; новые id после этого — мягкий FadeInDown. */
function useSoftMessageIds(messages: CompanionMsg[]) {
  const knownRef = useRef<Set<string> | null>(null);
  if (knownRef.current === null) {
    knownRef.current = new Set(messages.map((m) => m.id));
  }
  return useCallback((id: string) => {
    const known = knownRef.current!;
    if (known.has(id)) return false;
    known.add(id);
    return true;
  }, []);
}

function SoftBubble({ animate, children }: { animate: boolean; children: ReactNode }) {
  const once = useRef(animate);
  if (animate) once.current = true;
  if (!once.current) return <>{children}</>;
  return <Reanimated.View entering={SOFT_MSG_ENTER}>{children}</Reanimated.View>;
}

function formatChatTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function lastUserTextBefore(messages: CompanionMsg[], teacherMsgId: string): string {
  const idx = messages.findIndex((m) => m.id === teacherMsgId);
  if (idx <= 0) return '';
  for (let i = idx - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.from === 'me' && typeof msg.text === 'string' && msg.text.trim()) {
      return msg.text.trim();
    }
  }
  return '';
}

function buildNextTopicChatMessage(topic: TeacherNextTopicRecommendation): string {
  const title = topic.title.trim();
  if (topic.connection?.trim()) {
    return `Расскажи про тему «${title}». ${topic.connection.trim()}`;
  }
  if (topic.reason?.trim()) {
    return `Расскажи про тему «${title}». ${topic.reason.trim()}`;
  }
  return `Расскажи про тему «${title}»`;
}

const DEFAULT_THREAD: CompanionMsg[] = [
  {
    id: 'm0',
    from: 'them',
    text: 'Привет! Готов продолжить, когда будешь готов.',
    time: '16:24',
  },
  {
    id: 'm1',
    from: 'me',
    text: 'Привет! Давай немного порепетируем разговорную речь.',
    time: '16:25',
    read: 'read',
  },
  {
    id: 'm2',
    from: 'them',
    text: 'Отлично. С чего начнём — повседневные темы или что-то более конкретное?',
    time: '16:26',
  },
];

const TEACHER_ENTRY_TEXT =
  'Продолжим с того места, где остановились. Углубим прошлую тему или переключимся — что сейчас важнее?';

function initialMessagesFromParams(params: {
  mode?: string;
  seed?: string;
  openingLine?: string;
}): CompanionMsg[] {
  const isTeacher = params.mode === 'teacher';
  const rawOpen = typeof params.openingLine === 'string' ? params.openingLine : undefined;
  const opening = rawOpen ? safeDecode(rawOpen) : undefined;
  if (!isTeacher && opening) {
    return [
      {
        id: 'm-open',
        from: 'them',
        text: opening,
        time: formatChatTime(),
      },
    ];
  }
  const raw = typeof params.seed === 'string' ? params.seed : undefined;
  const seed = raw ? safeDecode(raw) : undefined;
  if (isTeacher && seed) {
    return [
      {
        id: 'seed',
        from: 'me',
        text: seed,
        time: formatChatTime(),
        read: 'read',
      },
    ];
  }
  if (isTeacher) {
    return [
      {
        id: 't0',
        from: 'them',
        text: TEACHER_ENTRY_TEXT,
        time: formatChatTime(),
      },
    ];
  }
  return DEFAULT_THREAD;
}

function GameChatHeader({
  name,
  subtitle,
  statusText,
  online,
  avatarLetter,
  avatarColor,
  leadingIcon,
  onBack,
  backLabel,
  onCallPress,
  callAccessibilityLabel,
}: {
  name: string;
  subtitle?: ReactNode;
  statusText?: string;
  online?: boolean;
  avatarLetter?: string;
  avatarColor?: string;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  onBack?: () => void;
  backLabel?: string;
  onCallPress?: () => void;
  callAccessibilityLabel?: string;
}) {
  return (
    <View style={gameHeaderStyles.bar}>
      <View style={gameHeaderStyles.side}>
        {onBack ? (
          <GameBackButton
            onPress={onBack}
            variant="inline"
            label={backLabel ?? 'Назад'}
            style={gameHeaderStyles.backInline}
          />
        ) : leadingIcon ? (
          <View style={gameHeaderStyles.iconBadge}>
            <Ionicons name={leadingIcon} size={17} color={GAME_THEME.color.ink} />
          </View>
        ) : avatarLetter && avatarColor ? (
          <View style={[gameHeaderStyles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={gameHeaderStyles.avatarLetter}>{avatarLetter}</Text>
          </View>
        ) : (
          <View style={gameHeaderStyles.sideSpacer} />
        )}
      </View>

      <View style={gameHeaderStyles.center}>
        <View style={gameHeaderStyles.titleRow}>
          {onBack && avatarLetter && avatarColor ? (
            <View style={[gameHeaderStyles.avatarSm, { backgroundColor: avatarColor }]}>
              <Text style={gameHeaderStyles.avatarLetterSm}>{avatarLetter}</Text>
            </View>
          ) : onBack && leadingIcon ? (
            <View style={gameHeaderStyles.iconBadgeSm}>
              <Ionicons name={leadingIcon} size={14} color={GAME_THEME.color.ink} />
            </View>
          ) : null}
          <Text style={gameHeaderStyles.name} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Text style={gameHeaderStyles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : statusText ? (
          <View style={gameHeaderStyles.statusRow}>
            {online !== undefined ? (
              <View style={[gameHeaderStyles.statusDot, online && gameHeaderStyles.statusDotOn]} />
            ) : null}
            <Text style={gameHeaderStyles.subtitle} numberOfLines={1}>
              {statusText}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[gameHeaderStyles.side, gameHeaderStyles.sideRight]}>
        {onCallPress ? (
          <Pressable
            onPress={onCallPress}
            hitSlop={10}
            style={({ pressed }) => [gameHeaderStyles.callBtn, pressed && gameHeaderStyles.callBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={callAccessibilityLabel}>
            <Ionicons name="call-outline" size={18} color={GAME_THEME.color.ink} />
          </Pressable>
        ) : (
          <View style={gameHeaderStyles.sideSpacer} />
        )}
      </View>
      <View pointerEvents="none" style={gameHeaderStyles.goldLip} />
    </View>
  );
}

type RenderMessageBody = (m: CompanionMsg, textStyle: object) => ReactNode;

/** Лента отдельно от композера — набор текста не гоняет все пузыри. */
const TeacherDialogMessages = memo(function TeacherDialogMessages({
  messages,
  typing,
  lastCoachId,
  scrollRef,
  onDismiss,
  renderBody,
  exerciseLoadingId,
  miniDrillUsage,
  language,
  uiLanguage,
  lessonTopic,
  onPrepare,
  onPress,
  onBlocked,
}: {
  messages: CompanionMsg[];
  typing: boolean;
  lastCoachId: string | null;
  scrollRef: RefObject<ScrollView | null>;
  onDismiss: () => void;
  renderBody: RenderMessageBody;
  exerciseLoadingId: string | null;
  miniDrillUsage: MiniDrillUsage;
  language: CompanionChatApiLanguage;
  uiLanguage: 'ru' | 'en' | 'zh';
  lessonTopic?: string;
  onPrepare: (message: CompanionMsg) => boolean;
  onPress: (message: CompanionMsg) => void;
  onBlocked: (reason: string) => void;
}) {
  const claimNew = useSoftMessageIds(messages);

  return (
    <ScrollView
      ref={scrollRef}
      style={tStyles.thread}
      contentContainerStyle={tStyles.threadContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      removeClippedSubviews={false}
      onScrollBeginDrag={onDismiss}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
      <Pressable onPress={onDismiss} style={tStyles.threadTapDismiss}>
        <View style={tStyles.dateWrap}>
          <View style={tStyles.dateChip}>
            <Text style={tStyles.dateChipText}>Сегодня · урок</Text>
          </View>
        </View>

        {messages.map((m, msgIdx) => {
          const animate = claimNew(m.id);
          const row =
            m.from === 'them' ? (
              <View style={tStyles.teacherBlock}>
                <View style={tStyles.teacherAvatar}>
                  <Ionicons name="sparkles" size={16} color={GAME_THEME.color.sky} />
                </View>
                <View style={tStyles.teacherColumn}>
                  <View style={tStyles.teacherCard}>
                    <View style={tStyles.teacherCardTopEdge} pointerEvents="none" />
                    {renderBody(m, tStyles.teacherText)}
                  </View>
                  {m.id === lastCoachId ? (
                    <>
                      <View style={tStyles.teacherActionsGap} collapsable={false} />
                      <View style={tStyles.teacherActions}>
                        <TeacherExerciseActions
                          messageId={m.id}
                          message={m}
                          exerciseLoadingId={exerciseLoadingId}
                          typing={typing}
                          miniAccess={evaluateMiniDrillAccess(miniDrillUsage, m.id)}
                          language={language}
                          uiLanguage={uiLanguage}
                          lessonTopic={lessonTopic}
                          lastUserMessage={(() => {
                            for (let i = msgIdx - 1; i >= 0; i -= 1) {
                              if (messages[i]?.from === 'me') return messages[i].text;
                            }
                            return undefined;
                          })()}
                          onPrepare={onPrepare}
                          onPress={onPress}
                          onBlocked={onBlocked}
                          coach
                        />
                      </View>
                    </>
                  ) : null}
                  <Text style={tStyles.teacherTime}>{m.time}</Text>
                </View>
              </View>
            ) : (
              <View style={tStyles.studentWrap}>
                {isImageMsg(m) && m.imageUri ? (
                  <>
                    {renderBody(m, tStyles.studentText)}
                    <Text style={tStyles.studentTime}>{m.time}</Text>
                  </>
                ) : (
                  <View style={tStyles.studentCard}>
                    {renderBody(m, tStyles.studentText)}
                    <Text style={tStyles.studentTime}>{m.time}</Text>
                  </View>
                )}
              </View>
            );
          return (
            <SoftBubble key={m.id} animate={animate}>
              {row}
            </SoftBubble>
          );
        })}

        {typing ? (
          <Reanimated.View
            entering={SOFT_TYPING_ENTER}
            exiting={SOFT_TYPING_EXIT}
            style={tStyles.teacherBlock}>
            <View style={tStyles.teacherAvatar}>
              <Ionicons name="sparkles" size={16} color={GAME_THEME.color.sky} />
            </View>
            <View style={tStyles.teacherColumn}>
              <View style={tStyles.teacherCard}>
                <View style={tStyles.teacherCardTopEdge} pointerEvents="none" />
                <TypingDots dotStyle={tStyles.typingDot} />
                <Text style={tStyles.typingCaption}>Готовит объяснение…</Text>
              </View>
            </View>
          </Reanimated.View>
        ) : null}
      </Pressable>
    </ScrollView>
  );
});

const CompanionDialogMessages = memo(function CompanionDialogMessages({
  messages,
  typing,
  scrollRef,
  onDismiss,
  renderBody,
  attachOpen,
  readGlyph,
}: {
  messages: CompanionMsg[];
  typing: boolean;
  scrollRef: RefObject<ScrollView | null>;
  onDismiss: () => void;
  renderBody: RenderMessageBody;
  attachOpen: boolean;
  readGlyph: (r?: CompanionReadState) => string | null;
}) {
  const claimNew = useSoftMessageIds(messages);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.thread}
      contentContainerStyle={msgStyles.threadContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
      pointerEvents={attachOpen ? 'none' : 'auto'}
      onScrollBeginDrag={onDismiss}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
      <Pressable onPress={onDismiss} style={msgStyles.threadTapDismiss}>
        <View style={msgStyles.dateWrap}>
          <View style={msgStyles.dateChip}>
            <Text style={msgStyles.dateChipText}>Сегодня</Text>
          </View>
        </View>

        {messages.map((m) => {
          const animate = claimNew(m.id);
          const row =
            m.from === 'them' ? (
              <View style={msgStyles.incomingWrap}>
                {isImageMsg(m) && m.imageUri ? (
                  <>
                    {renderBody(m, msgStyles.incomingText)}
                    <Text style={msgStyles.bubbleTimeIn}>{m.time}</Text>
                  </>
                ) : (
                  <CompanionIncomingBubble>
                    {renderBody(m, msgStyles.incomingText)}
                    <Text style={msgStyles.bubbleTimeIn}>{m.time}</Text>
                  </CompanionIncomingBubble>
                )}
              </View>
            ) : (
              <View style={msgStyles.outgoingWrap}>
                {isImageMsg(m) && m.imageUri ? (
                  <>
                    {renderBody(m, msgStyles.outgoingText)}
                    <View style={msgStyles.outMeta}>
                      <Text style={msgStyles.bubbleTimeOut}>{m.time}</Text>
                      <Text style={[msgStyles.readMark, m.read === 'read' && msgStyles.readMarkRead]}>
                        {readGlyph(m.read)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={msgStyles.outgoingBubble}>
                    {renderBody(m, msgStyles.outgoingText)}
                    <View style={msgStyles.outMeta}>
                      <Text style={msgStyles.bubbleTimeOut}>{m.time}</Text>
                      <Text style={[msgStyles.readMark, m.read === 'read' && msgStyles.readMarkRead]}>
                        {readGlyph(m.read)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          return (
            <SoftBubble key={m.id} animate={animate}>
              {row}
            </SoftBubble>
          );
        })}
        {typing ? (
          <Reanimated.View
            entering={SOFT_TYPING_ENTER}
            exiting={SOFT_TYPING_EXIT}
            style={msgStyles.incomingWrap}>
            <CompanionIncomingBubble compact>
              <TypingDots dotStyle={msgStyles.typingDot} />
              <Text style={msgStyles.typingCaption}>печатает…</Text>
            </CompanionIncomingBubble>
          </Reanimated.View>
        ) : null}
      </Pressable>
    </ScrollView>
  );
});

function TypingDots({ dotStyle }: { dotStyle?: object }) {
  const a1 = useRef(new Animated.Value(0.35)).current;
  const a2 = useRef(new Animated.Value(0.35)).current;
  const a3 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.35,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
    const x1 = mk(a1, 0);
    const x2 = mk(a2, 120);
    const x3 = mk(a3, 240);
    x1.start();
    x2.start();
    x3.start();
    return () => {
      x1.stop();
      x2.stop();
      x3.stop();
    };
  }, [a1, a2, a3]);

  return (
    <View style={msgStyles.typingRow}>
      {[a1, a2, a3].map((v, i) => (
        <Animated.View
          key={i}
          style={[
            msgStyles.typingDot,
            dotStyle,
            {
              opacity: v,
              transform: [
                {
                  translateY: v.interpolate({
                    inputRange: [0.35, 1],
                    outputRange: [0, -3],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function CompanionChatScreen() {
  return <CompanionChatScreenInner />;
}

function CompanionChatScreenInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useTranslation();
  const uiLanguage = teacherUiLanguageFromLocale(locale);
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    online?: string;
    letter?: string;
    color?: string;
    mode?: string;
    seed?: string;
    companionLang?: string;
    openingLine?: string;
    profileMetaLine?: string;
    lessonTopic?: string;
  }>();

  const name = typeof params.name === 'string' ? params.name : 'Emma';
  const online = params.online !== '0';
  const letter = typeof params.letter === 'string' ? params.letter : 'E';
  const color = typeof params.color === 'string' ? params.color : '#3D3654';
  const isTeacher = params.mode === 'teacher';
  const teacherSeed =
    typeof params.seed === 'string' && params.seed.length > 0 ? safeDecode(params.seed) : undefined;

  const { user } = useAuth();
  const { learnerModel, learnerContext } = useLearnerModel();
  const miniDrillUserId = user?.id ?? '';
  const { chats, companionChatsHydrated, getCompanionThread, saveCompanionThread } = useCompanionChats();
  const { addLessonSpentSeconds } = useTeacherJourney();
  const getThreadRef = useRef(getCompanionThread);
  getThreadRef.current = getCompanionThread;
  const { registerUserStudyText, recordStudySwipe } = useUserProfile();
  const { recordActivity, hasPlusAccess } = useEngagement();
  const { ingestTeacherText } = useLexicon();
  const drillSession = useTeacherDrillSession();
  const chatRow = useMemo(
    () => (typeof params.id === 'string' ? chats.find((c) => c.id === params.id) : undefined),
    [chats, params.id],
  );
  const profileLineDefault = '28 · London · UX/UI designer';
  const profileMetaFromParams =
    typeof params.profileMetaLine === 'string' ? safeDecode(params.profileMetaLine) : undefined;
  const lessonTopicParam =
    typeof params.lessonTopic === 'string' ? safeDecode(params.lessonTopic) : undefined;

  const trackUserMessage = useCallback(
    (preview: string) => {
      recordActivity({
        kind: 'message',
        messagePreview: preview.slice(0, 120),
        chatName: name,
        ...(isTeacher && lessonTopicParam ? { lessonTopic: lessonTopicParam } : {}),
      });
    },
    [isTeacher, lessonTopicParam, name, recordActivity],
  );
  const profileLine = isTeacher
    ? lessonTopicParam ?? 'Грамматика, стиль и разбор ваших ответов'
    : chatRow?.profileMetaLine ?? profileMetaFromParams ?? profileLineDefault;

  /** Язык практики для POST /api/chat — приходит из списка чатов или поиска собеседника. */
  const companionSessionLang = useMemo((): CompanionChatApiLanguage => {
    if (params.companionLang === 'chinese') return 'chinese';
    if (params.companionLang === 'russian') return 'russian';
    return 'english';
  }, [params.companionLang]);

  /** Язык урока для AI-преподавателя (по умолчанию русский). */
  const teacherSessionLang = useMemo((): CompanionChatApiLanguage => {
    if (params.companionLang === 'chinese') return 'chinese';
    if (params.companionLang === 'english') return 'english';
    return 'russian';
  }, [params.companionLang]);

  const companionPersona = chatRow?.companionPersona;
  const chatId = typeof params.id === 'string' ? params.id : undefined;

  const [input, setInput] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [drillMistakes, setDrillMistakes] = useState<TeacherDrillMistakeRecord[]>([]);
  const drillSourceMessageRef = useRef<CompanionMsg | null>(null);
  const drillExplanationRef = useRef('');
  const drillGenerationTokenRef = useRef(0);
  const drillLanguageRef = useRef<CompanionChatApiLanguage>('english');
  const [plusPaywallFeature, setPlusPaywallFeature] = useState<TearzPlusFeature | null>(null);
  const [miniDrillUsage, setMiniDrillUsage] = useState<MiniDrillUsage>({ perMessage: {}, priorSets: {} });
  const [messages, setMessages] = useState<CompanionMsg[]>(() => initialMessagesFromParams(params));
  const threadKey = `${isTeacher ? 'teacher' : 'companion'}:${chatId ?? 'new'}:${params.mode ?? ''}`;
  const [loadedThreadKey, setLoadedThreadKey] = useState<string | null>(null);
  const recordingLock = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useLayoutEffect(() => {
    if (!companionChatsHydrated) return;
    if (isTeacher) {
      if (!chatId) {
        setMessages(initialMessagesFromParams(params));
        setLoadedThreadKey(threadKey);
        return;
      }
      const boot = chatId ? takeTeacherLessonBootstrap(chatId) : null;
      if (boot && boot.length > 0) {
        setMessages(boot);
        setLoadedThreadKey(threadKey);
        return;
      }
      const saved = getThreadRef.current(chatId);
      if (saved && saved.length > 0) {
        setMessages(saved as CompanionMsg[]);
      } else {
        setMessages(initialMessagesFromParams(params));
      }
      setLoadedThreadKey(threadKey);
      return;
    }
    if (!chatId) {
      setMessages(initialMessagesFromParams(params));
      setLoadedThreadKey(threadKey);
      return;
    }
    const saved = getThreadRef.current(chatId);
    if (saved && saved.length > 0) {
      setMessages(saved as CompanionMsg[]);
    } else {
      setMessages(initialMessagesFromParams(params));
    }
    setLoadedThreadKey(threadKey);
  }, [companionChatsHydrated, chatId, isTeacher, params.mode, params.openingLine, params.seed, threadKey]);

  useEffect(() => {
    if (!companionChatsHydrated || !chatId || loadedThreadKey !== threadKey) return;
    saveCompanionThread(chatId, messages);
  }, [messages, chatId, saveCompanionThread, companionChatsHydrated, loadedThreadKey, threadKey]);

  useEffect(() => {
    if (!companionChatsHydrated || !chatId || loadedThreadKey !== threadKey) return;
    return () => {
      saveCompanionThread(chatId, messagesRef.current);
    };
  }, [chatId, saveCompanionThread, companionChatsHydrated, loadedThreadKey, threadKey]);

  const scrollRef = useRef<ScrollView>(null);
  const { clearWordSelections } = useWordAddSheet();
  const restComposerPad = Math.max(insets.bottom, 10) + 8;
  const { animatedStyle: composerInsetStyle, isOpen: keyboardOpen } = useKeyboardInset(restComposerPad);
  const companionCall = useCompanionCall();

  const callLabels = useMemo(
    () => ({
      connecting: t('companion.callConnecting'),
      ready: t('companion.callReady'),
      listening: t('companion.callListening'),
      thinking: t('companion.callThinking'),
      speaking: t('companion.callSpeaking'),
      ended: t('companion.callEnded'),
      error: t('companion.callError'),
      endCall: t('companion.callEnd'),
    }),
    [t],
  );

  const handleStartCall = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (hasPlusAccess) {
      companionCall.startCall({
        language: companionSessionLang,
        companionDisplayName: name,
        ...(companionPersona ? { companionPersona } : {}),
      });
      return;
    }
    setPlusPaywallFeature('companionCall');
  }, [companionCall, companionPersona, companionSessionLang, hasPlusAccess, name]);

  const handleEndCall = useCallback(() => {
    companionCall.endCall();
  }, [companionCall]);

  useEffect(() => {
    if (!isTeacher || !miniDrillUserId) {
      setMiniDrillUsage({ perMessage: {}, priorSets: {} });
      setDrillMistakes([]);
      return;
    }
    void loadMiniDrillUsage(miniDrillUserId).then(setMiniDrillUsage);
    void loadDrillMistakes(miniDrillUserId).then(setDrillMistakes);
  }, [isTeacher, miniDrillUserId]);

  useFocusEffect(
    useCallback(() => {
      if (!isTeacher || !chatId) return;

      let accumulatedMs = 0;
      let segmentStart: number | null = Date.now();

      const endSegment = () => {
        if (segmentStart === null) return;
        accumulatedMs += Date.now() - segmentStart;
        segmentStart = null;
      };

      const onAppState = (next: AppStateStatus) => {
        if (next === 'active') {
          if (segmentStart === null) segmentStart = Date.now();
        } else {
          endSegment();
        }
      };

      const sub = AppState.addEventListener('change', onAppState);

      return () => {
        sub.remove();
        if (segmentStart !== null) {
          accumulatedMs += Date.now() - segmentStart;
        }
        const secs = Math.floor(accumulatedMs / 1000);
        if (secs >= 2) {
          void addLessonSpentSeconds(chatId, secs);
        }
      };
    }, [isTeacher, chatId, addLessonSpentSeconds]),
  );

  useEffect(() => {
    if (!keyboardOpen) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [keyboardOpen]);

  useEffect(() => {
    if (!teacherSeed) return;
    registerUserStudyText(teacherSeed);
  }, [teacherSeed, registerUserStudyText]);

  const requestTeacherReply = useCallback(
    async (
      userText: string,
      userMsgId: string,
      historyBefore: CompanionMsg[],
      image?: { base64: string; mimeType: string },
    ) => {
      const historyPayload = messagesToCompanionApiHistory(historyBefore);
      try {
        const reply = await postTeacherChatReply({
          message: userText.trim() || (image ? teacherPhotoFallbackMessage(uiLanguage) : ''),
          conversationHistory: historyPayload,
          language: teacherSessionLang,
          uiLanguage,
          lessonTopic: lessonTopicParam,
          ...(learnerModel?.overallLevel ? { learnerLevel: learnerModel.overallLevel } : {}),
          ...(learnerContext ? { learnerContext } : {}),
          ...(image?.base64 ? { imageBase64: image.base64, imageMimeType: image.mimeType } : {}),
        });
        ingestTeacherText(reply);
        const replyTime = formatChatTime();
        setMessages((m) => {
          const next =
            userMsgId === 'seed'
              ? m
              : m.map((x) => (x.id === userMsgId ? { ...x, read: 'read' as CompanionReadState } : x));
          return [...next, { id: `a-${Date.now()}`, from: 'them', text: reply, time: replyTime }];
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ошибка сети';
        const replyTime = formatChatTime();
        setMessages((m) => {
          const next =
            userMsgId === 'seed'
              ? m
              : m.map((x) => (x.id === userMsgId ? { ...x, read: 'read' as CompanionReadState } : x));
          return [
            ...next,
            {
              id: `a-${Date.now()}`,
              from: 'them',
              text: `Не удалось получить ответ преподавателя.\n\n${msg}`,
              time: replyTime,
            },
          ];
        });
      } finally {
        setTyping(false);
      }
    },
    [ingestTeacherText, learnerContext, learnerModel, lessonTopicParam, teacherSessionLang, uiLanguage],
  );

  const teacherSeedRepliedRef = useRef(false);

  useEffect(() => {
    if (!isTeacher || !teacherSeed || teacherSeedRepliedRef.current) return;
    if (messagesRef.current.some((m) => m.from === 'them')) {
      teacherSeedRepliedRef.current = true;
      return;
    }
    teacherSeedRepliedRef.current = true;
    setTyping(true);
    void requestTeacherReply(teacherSeed, 'seed', []);
  }, [isTeacher, teacherSeed, requestTeacherReply]);

  const sendRef = useRef<(overrideText?: string) => void>(() => {});

  const send = (overrideText?: string) => {
    const raw = typeof overrideText === 'string' ? overrideText : input;
    const t = String(raw ?? '').trim();
    if (!t || typing) return;
    registerUserStudyText(t);
    const now = new Date();
    const time = formatChatTime(now);
    const id = `u-${Date.now()}`;

    setMessages((m) => [...m, { id, from: 'me', text: t, time, read: 'sent', sentAt: now.getTime() }]);
    trackUserMessage(t);
    if (!overrideText) setInput('');
    setTyping(true);

    const historyBefore = messagesRef.current.filter((m) => m.id !== id);
    if (isTeacher) {
      void requestTeacherReply(t, id, historyBefore);
      return;
    }

    void requestCompanionReply(t, id, historyBefore);
  };
  sendRef.current = send;

  const handleDrillNextTopic = useCallback((topic: TeacherNextTopicRecommendation) => {
    const text = buildNextTopicChatMessage(topic);
    setTimeout(() => {
      sendRef.current(text);
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, []);

  const requestCompanionReply = useCallback(
    async (
      userText: string,
      userMsgId: string,
      historyBefore: CompanionMsg[],
      image?: { base64: string; mimeType: string },
    ) => {
      const historyPayload = messagesToCompanionApiHistory(historyBefore);
      try {
        const reply = await postCompanionChatReply({
          message: userText.trim() || (image ? 'The user shared a photo.' : ''),
          conversationHistory: historyPayload,
          language: companionSessionLang,
          companionDisplayName: name,
          ...(companionPersona ? { companionPersona } : {}),
          ...(image?.base64 ? { imageBase64: image.base64, imageMimeType: image.mimeType } : {}),
        });
        const replyTime = formatChatTime();
        setMessages((m) => {
          const next = m.map((x) => (x.id === userMsgId ? { ...x, read: 'read' as CompanionReadState } : x));
          return [...next, { id: `a-${Date.now()}`, from: 'them', text: reply, time: replyTime }];
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ошибка сети';
        const replyTime = formatChatTime();
        setMessages((m) => {
          const next = m.map((x) => (x.id === userMsgId ? { ...x, read: 'read' as CompanionReadState } : x));
          return [
            ...next,
            {
              id: `a-${Date.now()}`,
              from: 'them',
              text: `Не удалось получить ответ.\n\n${msg}`,
              time: replyTime,
            },
          ];
        });
      } finally {
        setTyping(false);
      }
    },
    [companionPersona, companionSessionLang, name],
  );

  const handleVoiceCaptured = useCallback(
    async (captured: { uri: string; durationMs: number }) => {
      if (recordingLock.current || isTeacher) return;
      recordingLock.current = true;
      const msgId = `v-${Date.now()}`;
      const time = formatChatTime();
      let audioUri: string;
      try {
        audioUri = await persistCompanionVoice(captured.uri, msgId);
      } catch {
        audioUri = captured.uri;
      }

      const optimistic: CompanionMsg = {
        id: msgId,
        from: 'me',
        kind: 'voice',
        text: '',
        audioUri,
        durationMs: captured.durationMs,
        time,
        read: 'sent',
        voicePending: true,
      };

      const historyBefore = messagesRef.current;
      setMessages((m) => [...m, optimistic]);
      setTyping(true);

      try {
        let transcript: string;
        try {
          transcript = await postCompanionVoiceTranscribe(audioUri, companionSessionLang, uiLanguage);
        } catch (e) {
          const err = e instanceof Error ? e.message : 'Не удалось распознать речь';
          setMessages((m) =>
            m.map((x) =>
              x.id === msgId
                ? { ...x, voicePending: false, text: `⚠ ${err}` }
                : x,
            ),
          );
          setTyping(false);
          return;
        }

        registerUserStudyText(transcript);
        trackUserMessage(transcript);
        setMessages((m) =>
          m.map((x) => (x.id === msgId ? { ...x, text: transcript, voicePending: false } : x)),
        );
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await requestCompanionReply(transcript, msgId, historyBefore);
      } finally {
        recordingLock.current = false;
      }
    },
    [companionSessionLang, isTeacher, registerUserStudyText, requestCompanionReply, trackUserMessage],
  );

  const readGlyph = useCallback((r?: CompanionReadState) => {
    if (!r) return null;
    if (r === 'read') return '✓✓';
    return '✓';
  }, []);

  const renderMessageBody = useCallback(
    (m: CompanionMsg, textStyle: object) => {
      if (isVoiceMsg(m) && m.audioUri) {
        return (
          <VoiceMessageBubble
            uri={m.audioUri}
            durationMs={m.durationMs ?? 0}
            outgoing={m.from === 'me'}
            pending={m.voicePending}
          />
        );
      }
      if (isImageMsg(m) && m.imageUri) {
        const captionRaw = m.text.trim();
        const caption = !captionRaw || captionRaw === '📷 Фото' ? null : captionRaw;
        const captionBubbleStyle =
          m.from === 'me'
            ? isTeacher
              ? tStyles.imageCaptionOut
              : msgStyles.imageCaptionOut
            : isTeacher
              ? tStyles.imageCaptionIn
              : msgStyles.imageCaptionIn;
        return (
          <View style={isTeacher ? tStyles.imageMsgBody : msgStyles.imageMsgBody}>
            <ImageMessageBubble uri={m.imageUri} outgoing={m.from === 'me'} />
            {caption ? (
              <View style={captionBubbleStyle}>
                <LongPressWordText text={caption} style={textStyle} animKey={`${m.id}-cap`} />
              </View>
            ) : null}
          </View>
        );
      }
      if (isFileMsg(m) && m.fileUri) {
        const caption = m.text.trim();
        const label = m.fileName ?? 'Файл';
        const showCaption = caption.length > 0 && caption !== `📎 ${label}`;
        return (
          <View style={isTeacher ? tStyles.imageMsgBody : msgStyles.imageMsgBody}>
            <FileMessageBubble fileName={label} outgoing={m.from === 'me'} />
            {showCaption ? (
              <LongPressWordText text={caption} style={textStyle} animKey={`${m.id}-cap`} />
            ) : null}
          </View>
        );
      }
      if (isTeacher && m.from === 'them') {
        return <TeacherMessageBody text={m.text} messageId={m.id} textStyle={textStyle} />;
      }
      return <LongPressWordText text={m.text} style={textStyle} animKey={m.id} />;
    },
    [isTeacher],
  );

  const finishAttachmentReply = useCallback(
    async (msgId: string, apiText: string, image?: { base64: string; mimeType: string }) => {
      const historyBefore = messagesRef.current.filter((m) => m.id !== msgId);
      if (isTeacher) {
        await requestTeacherReply(apiText, msgId, historyBefore, image);
        return;
      }
      await requestCompanionReply(apiText, msgId, historyBefore, image);
    },
    [isTeacher, requestCompanionReply, requestTeacherReply],
  );

  const sendImageFromUri = useCallback(
    async (uri: string, pickedName?: string, captionOverride?: string) => {
      if (typing || recordingLock.current) return;

      const msgId = `img-${Date.now()}`;
      const time = formatChatTime();
      const caption = (captionOverride ?? input).trim();

      setAttachOpen(false);
      setMessages((m) => [
        ...m,
        {
          id: msgId,
          from: 'me',
          kind: 'image',
          imageUri: uri,
          text: caption || '📷 Фото',
          time,
          read: 'sent',
        },
      ]);
      if (caption) {
        setInput('');
        registerUserStudyText(caption);
        trackUserMessage(caption);
      } else {
        trackUserMessage('📷');
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setTyping(true);
      try {
        const storedUri = await persistCompanionAttachment(uri, msgId, pickedName);
        setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, imageUri: storedUri } : x)));

        const image = await prepareCompanionImageForApi(storedUri);
        await finishAttachmentReply(msgId, caption, image);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Не удалось сохранить фото';
        setMessages((m) =>
          m.map((x) =>
            x.id === msgId
              ? { ...x, read: 'read' as CompanionReadState, text: `📷 ${msg}` }
              : x,
          ),
        );
        setTyping(false);
      }
    },
    [finishAttachmentReply, input, registerUserStudyText, trackUserMessage, typing],
  );

  const sendFileFromUri = useCallback(
    async (uri: string, fileName: string, mimeType?: string | null, captionOverride?: string) => {
      if (typing || recordingLock.current) return;

      const msgId = `file-${Date.now()}`;
      const time = formatChatTime();
      const caption = (captionOverride ?? input).trim();
      const label = fileName.trim() || 'Файл';

      setAttachOpen(false);
      setMessages((m) => [
        ...m,
        {
          id: msgId,
          from: 'me',
          kind: 'file',
          fileUri: uri,
          fileName: label,
          mimeType: mimeType ?? undefined,
          text: caption || `📎 ${label}`,
          time,
          read: 'sent',
        },
      ]);
      if (caption) {
        setInput('');
        registerUserStudyText(caption);
        trackUserMessage(caption);
      } else {
        trackUserMessage(`📎 ${label}`);
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setTyping(true);
      try {
        const storedUri = await persistCompanionAttachment(uri, msgId, label);
        setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, fileUri: storedUri } : x)));

        const apiText = caption
          ? `Пользователь отправил файл «${label}» с подписью: «${caption}». Ответь по смыслу подписи и беседы.`
          : `Пользователь отправил файл «${label}» (${mimeType ?? 'тип неизвестен'}). Ответь уместно в контексте беседы.`;
        await finishAttachmentReply(msgId, apiText);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Не удалось сохранить файл';
        setMessages((m) =>
          m.map((x) =>
            x.id === msgId
              ? { ...x, read: 'read' as CompanionReadState, text: `📎 ${msg}` }
              : x,
          ),
        );
        setTyping(false);
      }
    },
    [finishAttachmentReply, input, registerUserStudyText, trackUserMessage, typing],
  );

  const handleTeacherSubmit = useCallback(
    (text: string, attachment?: TeacherComposerAttachment | null) => {
      if (typing || recordingLock.current) return;
      const trimmed = text.trim();
      if (attachment?.kind === 'image') {
        void sendImageFromUri(attachment.uri, attachment.name, trimmed || undefined);
        if (trimmed) setInput('');
        return;
      }
      if (attachment?.kind === 'file') {
        void sendFileFromUri(attachment.uri, attachment.fileName, attachment.mimeType, trimmed || undefined);
        if (trimmed) setInput('');
        return;
      }
      if (trimmed) send(trimmed);
    },
    [send, sendFileFromUri, sendImageFromUri, typing],
  );

  const handleAttachToggle = useCallback(() => {
    if (typing || recordingLock.current) return;
    setAttachOpen((open) => !open);
  }, [typing]);

  const handleBrowseFiles = useCallback(async () => {
    setAttachOpen(false);
    if (Platform.OS === 'web') {
      const picked = await pickCompanionPhoto();
      if (picked) await sendImageFromUri(picked.uri, picked.name);
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      const { uri, name, mimeType } = asset;
      const isImage =
        mimeType?.startsWith('image/') === true ||
        /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(name ?? '');

      if (isImage) {
        await sendImageFromUri(uri, name);
      } else {
        await sendFileFromUri(uri, name ?? 'Файл', mimeType);
      }
    } catch {
      Alert.alert('Файлы', 'Не удалось открыть приложение «Файлы».');
    }
  }, [sendFileFromUri, sendImageFromUri]);

  const checkDrillExercise = useCallback(
    async (payload: {
      exercise: string;
      answer: string;
      item: TeacherExerciseItem;
      learnerAnswers: {
        blanks: Record<string, string>;
        selectedChoice: string | null;
        freeText: string;
        formChoices: Record<string, string>;
        imageAssignments: Record<string, string>;
        numberedAssignments: Record<string, string>;
        matchPairs: Record<string, string>;
        sentenceOrder: string[];
        readSelectChoice: 'real' | 'fake' | null;
        partialGapInputs: Record<string, string>;
      };
    }) => {
      const result = await postTeacherExerciseCheck({
        exercise: payload.exercise,
        answer: payload.answer,
        item: payload.item,
        learnerAnswers: payload.learnerAnswers,
        conversationHistory: messagesToCompanionApiHistory(messagesRef.current),
        language: teacherSessionLang,
        uiLanguage,
        lessonTopic: lessonTopicParam,
      });
      recordStudySwipe(result.correct);
      return result;
    },
    [lessonTopicParam, recordStudySwipe, teacherSessionLang, uiLanguage],
  );

  const closeDrill = useCallback(
    (summary: { correct: number; total: number } | null) => {
      drillSession.endDrill();
      if (summary && summary.correct > 0) {
        recordActivity({
          kind: 'teacher_drill',
          drillCorrect: summary.correct,
          ...(lessonTopicParam ? { lessonTopic: lessonTopicParam } : {}),
        });
      }
    },
    [drillSession, lessonTopicParam, recordActivity],
  );

  const handleDrillMistakesRecorded = useCallback(
    (mistakes: Array<{
      kind: string;
      checkText: string;
      learnerAnswer: string;
      idealAnswer?: string;
      feedback?: string;
    }>) => {
      if (!miniDrillUserId || mistakes.length === 0) return;
      setDrillMistakes((prev) => {
        const next = recordDrillMistakes(prev, mistakes, {
          lessonTopic: lessonTopicParam,
          language: drillLanguageRef.current,
        });
        void saveDrillMistakes(miniDrillUserId, next);
        return next;
      });
    },
    [lessonTopicParam, miniDrillUserId],
  );

  const handleDrillFollowUpRef = useRef<(followUp: TeacherDrillFollowUp) => void>(() => {});

  const prepareDrillForMessage = useCallback(
    (source: CompanionMsg): boolean => {
      const explanation = source.text.trim();
      if (!explanation) {
        Alert.alert(t('teacher.drill.title'), t('teacher.drill.emptyExplanation'));
        return false;
      }
      if (typing) {
        Alert.alert(t('teacher.drill.title'), t('teacher.drill.waitForReply'));
        return false;
      }

      const access = evaluateMiniDrillAccess(miniDrillUsage, source.id);
      if (!access.allowed) {
        const reason =
          access.reasonKey === 'refreshLimit'
            ? t('teacher.drill.refreshLimit', { count: access.reasonCount ?? 0 })
            : access.reasonKey === 'lessonLimit'
              ? t('teacher.drill.lessonLimit', { count: access.reasonCount ?? 0 })
              : t('teacher.drill.limitFallback');
        Alert.alert(t('teacher.drill.title'), reason);
        return false;
      }

      const start = drillSession.beginGenerating(source.id);
      if (start.status === 'blocked') {
        Alert.alert(t('teacher.drill.title'), t('teacher.drill.generatingInProgress'));
        return false;
      }
      if (start.status === 'already') {
        return false;
      }
      drillGenerationTokenRef.current = start.token;

      Keyboard.dismiss();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return true;
    },
    [drillSession, miniDrillUsage, t, typing],
  );

  const generateExerciseForMessage = useCallback(
    async (source: CompanionMsg) => {
      const explanation = source.text.trim();
      if (!explanation) return;

      const generationToken = drillGenerationTokenRef.current;
      const access = evaluateMiniDrillAccess(miniDrillUsage, source.id);
      const generationSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const lastUser = lastUserTextBefore(messagesRef.current, source.id);
      const drillLanguage = resolveDrillTargetLanguage(teacherSessionLang, lastUser);
      drillSourceMessageRef.current = source;
      drillExplanationRef.current = explanation;
      drillLanguageRef.current = drillLanguage;
      try {
        let raw: TeacherExerciseItem[] | undefined;
        let nextTopic: TeacherNextTopicRecommendation | undefined;
        try {
          const generated = await postTeacherExerciseSet({
            explanation,
            lastUserMessage: lastUser,
            conversationHistory: messagesToCompanionApiHistory(messagesRef.current),
            language: drillLanguage,
            uiLanguage,
            lessonTopic: lessonTopicParam,
            generationSeed,
            generationAttempt: access.generationsUsed + 1,
            avoidExerciseTexts: getPriorExerciseTexts(miniDrillUsage, source.id),
            recentMistakes: getMistakeSummariesForApi(drillMistakes),
            ...(learnerModel?.overallLevel ? { learnerLevel: learnerModel.overallLevel } : {}),
            ...(learnerContext ? { learnerContext } : {}),
          });
          raw = generated.exercises;
          nextTopic = generated.nextTopic;
        } catch (genError) {
          const fallback = buildFallbackExercises(explanation);
          if (!fallback) throw genError;
          raw = fallback;
        }
        if (!raw?.length) throw new Error('Exercise set too short');
        if (!drillSession.isGenerationCurrent(generationToken)) return;
        const sessionKey = `drill-${generationSeed}`;
        const exercises = raw.map((ex, i) => ({
          ...ex,
          id: `${sessionKey}-${i}`,
        }));
        const nextUsage = recordMiniDrillGeneration(
          miniDrillUsage,
          source.id,
          exercises.map((ex) => ex.checkText),
        );
        setMiniDrillUsage(nextUsage);
        if (miniDrillUserId) {
          void saveMiniDrillUsage(miniDrillUserId, nextUsage);
        }
        drillSession.beginDrill({
          sessionKey,
          exercises,
          nextTopic: nextTopic ?? null,
          followUpContext: {
            explanation,
            lessonTopic: lessonTopicParam,
            language: drillLanguage,
            uiLanguage,
            recentMistakes: getMistakeSummariesForApi(drillMistakes),
          },
          transcribeLanguage: teacherSessionLang,
          onClose: closeDrill,
          onNextTopicPress: handleDrillNextTopic,
          onFollowUpPress: (followUp) => handleDrillFollowUpRef.current(followUp),
          onMistakesRecorded: handleDrillMistakesRecorded,
          onCheck: checkDrillExercise,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        if (!drillSession.isGenerationCurrent(generationToken)) return;
        const msg = e instanceof Error ? e.message : t('teacher.drill.networkError');
        drillSession.cancelGenerating();
        Alert.alert(
          t('teacher.drill.generateFailedTitle'),
          t('teacher.drill.generateFailedBody', { error: msg }),
        );
      }
    },
    [
      checkDrillExercise,
      closeDrill,
      drillMistakes,
      drillSession,
      handleDrillMistakesRecorded,
      handleDrillNextTopic,
      learnerContext,
      learnerModel,
      lessonTopicParam,
      miniDrillUsage,
      miniDrillUserId,
      t,
      teacherSessionLang,
      uiLanguage,
    ],
  );

  const handlePracticePress = useCallback(
    (message: CompanionMsg) => {
      void generateExerciseForMessage(message);
    },
    [generateExerciseForMessage],
  );

  const handleDrillFollowUp = useCallback(
    (followUp: TeacherDrillFollowUp) => {
      if (followUp.action === 'repeat_same' && drillSourceMessageRef.current) {
        setTimeout(() => {
          const msg = drillSourceMessageRef.current!;
          if (prepareDrillForMessage(msg)) void generateExerciseForMessage(msg);
        }, 120);
        return;
      }
      const text = buildFollowUpChatMessage(followUp, uiLanguage);
      setTimeout(() => {
        sendRef.current(text);
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 120);
    },
    [generateExerciseForMessage, prepareDrillForMessage],
  );

  handleDrillFollowUpRef.current = handleDrillFollowUp;

  const lastCoachId = useMemo(() => {
    if (typing) return null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (!m || m.from !== 'them' || m.id.startsWith('ex-')) continue;
      if (m.text.startsWith('Не удалось')) continue;
      return m.id;
    }
    return null;
  }, [messages, typing]);

  const onDrillBlocked = useCallback(
    (reason: string) => {
      Alert.alert(t('teacher.drill.title'), reason);
    },
    [t],
  );

  /** Не монтируем тяжёлую ленту в первом кадре перехода — иначе UITextView/карточки
   *  всплывают раньше хедера и композера (синяя «рамка со словами»). */
  const [threadReady, setThreadReady] = useState(false);
  const threadFade = useSharedValue(0);
  const softEnter = useChatSoftEnter(threadKey);
  const threadFadeStyle = useAnimatedStyle(() => ({ opacity: threadFade.value }));

  useLayoutEffect(() => {
    setThreadReady(false);
    threadFade.value = 0;
  }, [threadFade, threadKey]);
  useEffect(() => {
    let alive = true;
    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        if (!alive) return;
        setThreadReady(true);
        threadFade.value = withTiming(1, { duration: 420, easing: CHAT_SOFT_EASING });
      }, 100);
    });
    return () => {
      alive = false;
      task.cancel();
    };
  }, [threadFade, threadKey]);

  if (!companionChatsHydrated) {
    return (
      <View style={[styles.root, styles.hydrateRoot]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={GAME_THEME.color.ink} />
      </View>
    );
  }

  if (isTeacher) {
    return (
      <View style={tStyles.root}>
        <StatusBar style="dark" />
        <View style={[styles.statusFill, { height: insets.top }]} />
        <Reanimated.View style={softEnter.headerStyle}>
          <GameChatHeader
            name={name}
            leadingIcon="school-outline"
            subtitle="AI преподаватель · урок"
            onBack={() => router.back()}
            backLabel={t('companion.backToChats')}
          />
        </Reanimated.View>
        <Reanimated.View style={[tStyles.content, softEnter.midStyle]}>
          <View style={tStyles.lessonContext}>
            <View style={tStyles.lessonBanner}>
              <View style={tStyles.lessonBannerIcon}>
                <Ionicons name="book" size={17} color={GAME_THEME.color.ink} />
              </View>
              <View style={tStyles.lessonBannerCol}>
                <Text style={tStyles.lessonBannerEyebrow}>Тема урока</Text>
                {threadReady ? (
                  <LongPressWordText
                    text={profileLine}
                    style={tStyles.lessonContextText}
                    animKey="teacher-lesson-context"
                    numberOfLines={2}
                  />
                ) : (
                  <Text style={tStyles.lessonContextText} numberOfLines={2}>
                    {profileLine}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <Reanimated.View style={[tStyles.threadHost, threadFadeStyle]}>
            {threadReady ? (
              <TeacherDialogMessages
                messages={messages}
                typing={typing}
                lastCoachId={lastCoachId}
                scrollRef={scrollRef}
                onDismiss={clearWordSelections}
                renderBody={renderMessageBody}
                exerciseLoadingId={drillSession.messageIdLoading}
                miniDrillUsage={miniDrillUsage}
                language={teacherSessionLang}
                uiLanguage={uiLanguage}
                lessonTopic={lessonTopicParam}
                onPrepare={prepareDrillForMessage}
                onPress={handlePracticePress}
                onBlocked={onDrillBlocked}
              />
            ) : (
              <View style={tStyles.thread} />
            )}
          </Reanimated.View>
        </Reanimated.View>

        <WordAddSheetHost />

        <Reanimated.View style={[composerInsetStyle, softEnter.footStyle]}>
          <TeacherChatComposer
            input={input}
            onChangeText={setInput}
            onSubmit={handleTeacherSubmit}
            disabled={typing}
          />
        </Reanimated.View>

        <TeacherDrillSessionOverlay mode="embedded" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.statusFill, { height: insets.top }]} />

      <View style={styles.chatBody}>
        <Reanimated.View style={softEnter.headerStyle}>
          <GameChatHeader
            name={name}
            avatarLetter={letter}
            avatarColor={color}
            statusText={online ? t('companion.online') : t('companion.offline')}
            online={online}
            onBack={() => router.back()}
            backLabel={t('companion.backToChats')}
            onCallPress={handleStartCall}
            callAccessibilityLabel={t('companion.call')}
          />
        </Reanimated.View>

        <CompanionCallScreen
          visible={companionCall.visible}
          name={name}
          letter={letter}
          color={color}
          phase={companionCall.phase}
          error={companionCall.error}
          elapsedSec={companionCall.elapsedSec}
          onEnd={handleEndCall}
          labels={callLabels}
        />

        <TeacherFullWorkoutPaywall
          visible={plusPaywallFeature === 'companionCall'}
          feature="companionCall"
          onClose={() => setPlusPaywallFeature(null)}
          onUnlocked={() => {
            setPlusPaywallFeature(null);
            companionCall.startCall({
              language: companionSessionLang,
              companionDisplayName: name,
              ...(companionPersona ? { companionPersona } : {}),
            });
          }}
        />

        <Reanimated.View style={[styles.profileStrip, softEnter.midStyle]}>
          <Text style={styles.profileEyebrow}>Собеседник</Text>
          <LongPressWordText
            text={profileLine}
            style={styles.profileStripText}
            animKey="profile-strip"
            numberOfLines={2}
          />
        </Reanimated.View>

        <Reanimated.View style={[styles.threadHost, softEnter.midStyle, threadFadeStyle]}>
          {attachOpen ? (
            <Pressable
              style={styles.attachScrim}
              onPress={() => setAttachOpen(false)}
              accessibilityLabel="Закрыть вложения"
            />
          ) : null}

          {threadReady ? (
            <CompanionDialogMessages
              messages={messages}
              typing={typing}
              scrollRef={scrollRef}
              onDismiss={clearWordSelections}
              renderBody={renderMessageBody}
              attachOpen={attachOpen}
              readGlyph={readGlyph}
            />
          ) : (
            <View style={styles.thread} />
          )}
        </Reanimated.View>

        <WordAddSheetHost />

        <Reanimated.View style={[styles.composerWrap, composerInsetStyle, softEnter.footStyle]}>
          <CompanionAttachmentSheet
            visible={attachOpen}
            onPhotoSelected={(uri) => void sendImageFromUri(uri)}
            onBrowseFiles={() => void handleBrowseFiles()}
          />

          <CompanionVoiceComposer
            input={input}
            onChangeText={setInput}
            onSendText={() => void send()}
            onCaptured={handleVoiceCaptured}
            onAttachPress={handleAttachToggle}
            attachOpen={attachOpen}
            typing={typing}
          />
        </Reanimated.View>
      </View>
    </View>
  );
}

const gameHeaderStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 10,
    paddingBottom: 4,
    backgroundColor: GAME_THEME.color.gold,
  },
  goldLip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -6,
    height: 3,
    backgroundColor: GAME_THEME.color.sky,
  },
  side: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'center',
  },
  sideSpacer: {
    width: 36,
    height: 36,
  },
  backInline: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  name: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.62)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(26,26,26,0.25)',
    borderWidth: 1,
    borderColor: GAME_THEME.color.ink,
  },
  statusDotOn: {
    backgroundColor: GAME_THEME.color.phosphor,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  avatarSm: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: GAME_THEME.color.ink,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '800',
    color: GAME_THEME.color.cream,
  },
  avatarLetterSm: {
    fontSize: 11,
    fontWeight: '800',
    color: GAME_THEME.color.cream,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  iconBadgeSm: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 1.5,
    borderColor: GAME_THEME.color.ink,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 3,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  callBtnPressed: {
    opacity: 0.85,
    transform: [{ translateY: 1 }],
    borderBottomWidth: 2,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
  statusFill: {
    width: '100%',
    backgroundColor: GAME_THEME.color.gold,
  },
  chatBody: {
    flex: 1,
  },
  hydrateRoot: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileStrip: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26,26,26,0.1)',
    backgroundColor: GAME_THEME.color.cream,
  },
  profileEyebrow: {
    fontSize: GAME_THEME.type.micro,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.4)',
    textAlign: 'center',
    marginBottom: 4,
  },
  profileStripText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    color: 'rgba(26,26,26,0.72)',
    textAlign: 'center',
  },
  threadHost: {
    flex: 1,
    position: 'relative',
    backgroundColor: GAME_THEME.color.cream,
  },
  attachScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    backgroundColor: 'rgba(26,16,32,0.45)',
  },
  thread: {
    flex: 1,
    zIndex: 1,
  },
  composerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(26,26,26,0.12)',
    backgroundColor: GAME_THEME.color.cream,
    paddingTop: 10,
    paddingHorizontal: 12,
    position: 'relative',
  },
});
