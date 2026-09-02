/**
 * Контракт HTTP `/api/chat` (собеседник).
 * Расширяйте при добавлении voice mode (например, поле audio/mime).
 */
export type CompanionChatApiLanguage = 'english' | 'chinese' | 'russian' | 'german' | 'french';

export type CompanionChatHistoryRole = 'user' | 'assistant';

export type CompanionChatHistoryItem = {
  role: CompanionChatHistoryRole;
  content: string;
};

export type CompanionChatRequestBody = {
  message: string;
  conversationHistory: CompanionChatHistoryItem[];
  language: CompanionChatApiLanguage;
  /** Сгенерированная личность — дополняет system prompt на сервере */
  companionPersona?: string;
  /** Имя в шапке чата — якорь для «кто ты», без повторных представлений */
  companionDisplayName?: string;
  /** JPEG/PNG base64 — если пользователь отправил фото */
  imageBase64?: string;
  imageMimeType?: string;
};

/** POST /api/companion-profile */
export type CompanionProfileRequestBody = {
  language: CompanionChatApiLanguage;
};

export type GeneratedCompanionProfile = {
  name: string;
  age: number;
  city: string;
  bio: string;
  letter: string;
  color: string;
  persona: string;
  openingLine: string;
};

export type CompanionChatSuccessBody = {
  reply: string;
};

/** POST /api/teacher-chat — AI преподаватель (gpt-4.1-mini на сервере) */
export type TeacherChatRequestBody = {
  message: string;
  conversationHistory: CompanionChatHistoryItem[];
  language?: CompanionChatApiLanguage;
  /** Язык UI приложения / объяснений: ru | en | zh */
  uiLanguage?: 'ru' | 'en' | 'zh';
  /** Тема урока из приложения */
  lessonTopic?: string;
  /** CEFR из placement test (A1–C2) — сервер использует как prior */
  learnerLevel?: string;
  imageBase64?: string;
  imageMimeType?: string;
};

export type TeacherChatSuccessBody = {
  reply: string;
};

/** POST /api/teacher-exercise — короткое задание по конкретному ответу преподавателя */
export type TeacherExerciseRequestBody = {
  explanation: string;
  conversationHistory: CompanionChatHistoryItem[];
  language?: CompanionChatApiLanguage;
  uiLanguage?: 'ru' | 'en' | 'zh';
  lessonTopic?: string;
};

export type TeacherExerciseSuccessBody = {
  exercise: string;
};

export type TeacherExerciseSegment =
  | { type: 'text'; value: string }
  | { type: 'blank'; id: string; answer?: string };

export type TeacherExerciseKind =
  | 'drag_word_to_blank'
  | 'type_word_in_blank'
  | 'choose_word_form'
  | 'word_to_image'
  | 'sentence_order'
  | 'match_pairs'
  | 'voice_recording'
  | 'write_sentences'
  | 'read_and_select'
  | 'fill_partial_word'
  | 'identify_main_idea'
  | 'fill_blank'
  | 'multiple_choice'
  | 'free_text'
  /** HelloChinese-style: L2 слово/фраза → выбрать перевод */
  | 'choose_translation'
  /** HelloChinese-style: реплика в диалоге → выбрать ответ */
  | 'choose_reply'
  /** HelloChinese-style: лишнее слово в наборе */
  | 'odd_one_out'
  /** HelloChinese-style: найти ошибку среди вариантов */
  | 'spot_error'
  /** HelloChinese-style: ситуация → что сказать */
  | 'what_do_you_say'
  /** HelloChinese-style: смысл на UI-языке → собрать L2 предложение */
  | 'build_from_meaning'
  /** HelloChinese-style: выбрать среди похожих форм/написаний */
  | 'pick_similar'
  /** HelloChinese-style: дописать реплику в коротком диалоге */
  | 'complete_dialogue'
  /** Duolingo: UI sentence → pick L2 translation */
  | 'translate_sentence'
  /** Memrise/Anki: L2 → pick UI meaning */
  | 'reverse_translation'
  /** Duolingo/Babbel cloze: L2 sentence with gap → pick word */
  | 'select_missing_word'
  /** Busuu: statement or rule → True/False */
  | 'true_false'
  /** Babbel: UI phrase → type L2 translation */
  | 'type_translation'
  /** Babbel: pick natural collocation / word partner */
  | 'collocation_choice';

export type TeacherPartialGap = {
  id: string;
  answer: string;
};

export type TeacherNumberedSentence = {
  id: string;
  label: string;
  text: string;
  /** Правильное слово для пропуска — только для проверки */
  correctWord?: string;
};

export type TeacherFormSlot = {
  id: string;
  /** Предложение с пропуском или выделенным словом */
  prompt: string;
  options: string[];
  correct?: string;
};

export type TeacherImageSlot = {
  id: string;
  label?: string;
  imageUrl?: string;
  correctWord: string;
};

export type TeacherMatchPair = {
  id: string;
  left: string;
  right: string;
};

export type TeacherExerciseItem = {
  id: string;
  kind: TeacherExerciseKind;
  instruction?: string;
  segments: TeacherExerciseSegment[];
  choices?: string[];
  wordBank?: string[];
  /** Пронумерованные предложения — режим «слово к каждому» */
  numberedSentences?: TeacherNumberedSentence[];
  formSlots?: TeacherFormSlot[];
  imageSlots?: TeacherImageSlot[];
  pairs?: TeacherMatchPair[];
  /** Перемешанные слова для сборки предложения */
  shuffledWords?: string[];
  /** Правильный порядок слов */
  correctOrder?: string[];
  minSentences?: number;
  /** Текст для голосового ответа */
  voicePrompt?: string;
  /** read_and_select — слово на экране */
  selectWord?: string;
  /** read_and_select — настоящее ли слово */
  selectIsReal?: boolean;
  /** fill_partial_word — предложение с пропусками букв (stud__) */
  maskedSentence?: string;
  partialGaps?: TeacherPartialGap[];
  /** identify_main_idea — короткий текст */
  passage?: string;
  /** identify_main_idea / multiple_choice — правильный вариант */
  correctChoice?: string;
  checkText: string;
};

/** POST /api/teacher-exercise-set — набор из 5 заданий по объяснению */
export type TeacherNextTopicRecommendation = {
  title: string;
  reason: string;
  connection: string;
};

export type TeacherDrillMistakeSummary = {
  kind: string;
  checkText: string;
  learnerAnswer: string;
  idealAnswer?: string;
  feedback?: string;
  lessonTopic?: string;
};

export type TeacherDrillFollowUpAction = 'repeat_same' | 'review_gaps' | 'advance';

export type TeacherDrillFollowUp = {
  action: TeacherDrillFollowUpAction;
  title: string;
  reason: string;
  connection?: string;
  focusAreas?: string[];
  repeatPrompt?: string;
};

export type TeacherExerciseSetRequestBody = {
  explanation: string;
  conversationHistory: CompanionChatHistoryItem[];
  language?: CompanionChatApiLanguage;
  uiLanguage?: 'ru' | 'en' | 'zh';
  lessonTopic?: string;
  /** Последний запрос пользователя перед ответом преподавателя */
  lastUserMessage?: string;
  /** Уникальный токен запуска — каждый раз новый набор заданий */
  generationSeed?: string;
  /** Номер запуска для этого объяснения (1 = первый, 2+ = обновление). */
  generationAttempt?: number;
  /** Тексты прошлых заданий — модель не должна их повторять. */
  avoidExerciseTexts?: string[];
  /** Недавние ошибки ученика — приоритет при генерации заданий. */
  recentMistakes?: TeacherDrillMistakeSummary[];
};

export type TeacherDrillFollowUpRequestBody = {
  correct: number;
  total: number;
  sessionMistakes?: TeacherDrillMistakeSummary[];
  recentMistakes?: TeacherDrillMistakeSummary[];
  explanation?: string;
  lessonTopic?: string;
  language?: CompanionChatApiLanguage;
  uiLanguage?: 'ru' | 'en' | 'zh';
  nextTopic?: TeacherNextTopicRecommendation;
};

export type TeacherDrillFollowUpSuccessBody = {
  followUp: TeacherDrillFollowUp;
};

export type TeacherExerciseSetSuccessBody = {
  exercises: TeacherExerciseItem[];
  nextTopic?: TeacherNextTopicRecommendation;
};

export type TeacherVocabUsageSentence = {
  l2: string;
  pinyin?: string;
  translation: string;
  note?: string;
};

export type TeacherVocabWordCard = {
  word: string;
  pinyin?: string;
  gloss: string;
  sentences: TeacherVocabUsageSentence[];
};

export type TeacherVocabExamplesRequestBody = {
  explanation: string;
  language?: CompanionChatApiLanguage;
  uiLanguage?: 'ru' | 'en' | 'zh';
  lessonTopic?: string;
  lastUserMessage?: string;
};

export type TeacherVocabExamplesSuccessBody = {
  words: TeacherVocabWordCard[];
};

/** Structured learner answers for deterministic server grading */
export type TeacherExerciseLearnerAnswers = {
  blanks?: Record<string, string>;
  selectedChoice?: string | null;
  freeText?: string;
  formChoices?: Record<string, string>;
  imageAssignments?: Record<string, string>;
  numberedAssignments?: Record<string, string>;
  matchPairs?: Record<string, string>;
  sentenceOrder?: string[];
  readSelectChoice?: 'real' | 'fake' | null;
  partialGapInputs?: Record<string, string>;
};

/** POST /api/teacher-exercise-check — проверка ответа ученика */
export type TeacherExerciseCheckRequestBody = {
  exercise: string;
  answer: string;
  conversationHistory: CompanionChatHistoryItem[];
  language?: CompanionChatApiLanguage;
  uiLanguage?: 'ru' | 'en' | 'zh';
  lessonTopic?: string;
  /** Full item with answer keys — enables deterministic grading when keys exist */
  item?: TeacherExerciseItem;
  learnerAnswers?: TeacherExerciseLearnerAnswers;
};

export type TeacherExerciseCheckSuccessBody = {
  correct: boolean;
  title: string;
  feedback: string;
  idealAnswer?: string;
};

export type CompanionChatErrorBody = {
  error: string;
};

/** POST /api/transcribe — голос → текст (Whisper на сервере) */
export type CompanionTranscribeRequestBody = {
  audioBase64: string;
  mimeType?: string;
  language: CompanionChatApiLanguage;
  uiLanguage?: 'ru' | 'en' | 'zh';
};

export type CompanionTranscribeSuccessBody = {
  text: string;
};

export type CompanionProfileSuccessBody = GeneratedCompanionProfile;
