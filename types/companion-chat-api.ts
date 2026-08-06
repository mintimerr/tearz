/**
 * Контракт HTTP `/api/chat` (собеседник).
 * Расширяйте при добавлении voice mode (например, поле audio/mime).
 */
export type CompanionChatApiLanguage = 'english' | 'chinese' | 'russian';

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
  /** Тема урока из приложения */
  lessonTopic?: string;
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
  | 'free_text';

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

export type TeacherExerciseSetRequestBody = {
  explanation: string;
  conversationHistory: CompanionChatHistoryItem[];
  language?: CompanionChatApiLanguage;
  lessonTopic?: string;
  /** Последний запрос пользователя перед ответом преподавателя */
  lastUserMessage?: string;
  /** Уникальный токен запуска — каждый раз новый набор заданий */
  generationSeed?: string;
  /** Номер запуска для этого объяснения (1 = первый, 2+ = обновление). */
  generationAttempt?: number;
  /** Тексты прошлых заданий — модель не должна их повторять. */
  avoidExerciseTexts?: string[];
};

export type TeacherExerciseSetSuccessBody = {
  exercises: TeacherExerciseItem[];
  nextTopic?: TeacherNextTopicRecommendation;
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
};

export type CompanionTranscribeSuccessBody = {
  text: string;
};

export type CompanionProfileSuccessBody = GeneratedCompanionProfile;
