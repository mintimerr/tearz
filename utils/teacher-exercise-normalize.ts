import type {
  TeacherExerciseItem,
  TeacherExerciseKind,
  TeacherExerciseSegment,
  TeacherFormSlot,
  TeacherImageSlot,
  TeacherMatchPair,
  TeacherNumberedSentence,
  TeacherPartialGap,
} from '@/types/companion-chat-api';
import { DRILL_TASK_COUNT } from '@/constants/teacher-drill';
import {
  isChoiceExerciseKind,
  isDragBlankExerciseKind,
  isFormExerciseKind,
  isOrderExerciseKind,
} from '@/utils/teacher-exercise-kinds';

const BLANK_RE = /_{2,}|…{2,}|\.{3,}/g;

export function fillBlankInText(text: string, word: string): string {
  const trimmed = word.trim();
  if (!trimmed) return text.replace(BLANK_RE, '___');
  let used = false;
  return text.replace(BLANK_RE, () => {
    if (used) return '___';
    used = true;
    return trimmed;
  });
}

export function textToBlankSegments(text: string, blankId = 'b1'): TeacherExerciseSegment[] {
  const segments: TeacherExerciseSegment[] = [];
  let last = 0;
  let blankIdx = 0;
  const re = /_{2,}|…{2,}|\.{3,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', value: text.slice(last, m.index) });
    blankIdx += 1;
    segments.push({ type: 'blank', id: blankIdx === 1 ? blankId : `${blankId}-${blankIdx}` });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}

function coerceDragWordToBlankItem(item: TeacherExerciseItem): TeacherExerciseItem {
  if (!isDragBlankExerciseKind(item.kind)) return item;

  let segments = [...item.segments];
  let numberedSentences = item.numberedSentences;
  const checkText = item.checkText;

  const hasBlankSegment = segments.some((s) => s.type === 'blank');

  if (!hasBlankSegment && numberedSentences?.length) {
    const withBlank = numberedSentences.filter((s) => BLANK_RE.test(s.text));
    if (withBlank.length === 1) {
      segments = textToBlankSegments(withBlank[0].text, 'b1');
      numberedSentences = undefined;
    } else if (withBlank.length > 1) {
      numberedSentences = withBlank;
    }
  }

  if (!segments.some((s) => s.type === 'blank')) {
    const fromCheck = parseSegmentsFromCheckText(checkText);
    if (fromCheck.some((s) => s.type === 'blank')) segments = fromCheck;
  }

  if (!segments.some((s) => s.type === 'blank')) {
    const colonPart = checkText.match(/[:：]\s*([\s\S]+)$/);
    if (colonPart?.[1]) {
      const parsed = parseSegmentsFromCheckText(colonPart[1]);
      if (parsed.some((s) => s.type === 'blank')) segments = parsed;
    }
  }

  if (!segments.some((s) => s.type === 'blank')) {
    const lineWithBlank = checkText.split('\n').find((line) => BLANK_RE.test(line));
    if (lineWithBlank) {
      const parsed = parseSegmentsFromCheckText(lineWithBlank.replace(/^\d+\.\s*/, ''));
      if (parsed.some((s) => s.type === 'blank')) segments = parsed;
    }
  }

  return { ...item, segments, numberedSentences };
}

const ALL_KINDS: TeacherExerciseKind[] = [
  'drag_word_to_blank',
  'type_word_in_blank',
  'choose_word_form',
  'word_to_image',
  'sentence_order',
  'match_pairs',
  'voice_recording',
  'write_sentences',
  'read_and_select',
  'fill_partial_word',
  'identify_main_idea',
  'fill_blank',
  'multiple_choice',
  'free_text',
  'choose_translation',
  'choose_reply',
  'odd_one_out',
  'spot_error',
  'what_do_you_say',
  'build_from_meaning',
  'pick_similar',
  'complete_dialogue',
  'translate_sentence',
  'reverse_translation',
  'select_missing_word',
  'true_false',
  'type_translation',
  'collocation_choice',
];

export type MaskedSentencePart =
  | { type: 'text'; value: string }
  | { type: 'gap'; id: string };

/** Разбивает «The stud__ went…» на текст и пропуски букв. */
export function parseMaskedSentence(masked: string): MaskedSentencePart[] {
  const parts: MaskedSentencePart[] = [];
  let last = 0;
  let gapIdx = 0;
  const re = /_+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: masked.slice(last, m.index) });
    gapIdx += 1;
    parts.push({ type: 'gap', id: `g${gapIdx}` });
    last = m.index + m[0].length;
  }
  if (last < masked.length) parts.push({ type: 'text', value: masked.slice(last) });
  return parts.length > 0 ? parts : [{ type: 'text', value: masked }];
}

function normalizePartialGaps(raw: unknown, masked: string): TeacherPartialGap[] | undefined {
  const gapCount = (masked.match(/_+/g) || []).length;
  if (gapCount === 0) return undefined;

  if (Array.isArray(raw)) {
    const out: TeacherPartialGap[] = [];
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      if (!item || typeof item !== 'object') continue;
      const answer = asString((item as { answer?: unknown }).answer, 32);
      if (!answer) continue;
      const id = asString((item as { id?: unknown }).id, 16) || `g${i + 1}`;
      out.push({ id, answer });
    }
    if (out.length > 0) {
      while (out.length < gapCount) {
        out.push({ id: `g${out.length + 1}`, answer: '' });
      }
      return out.slice(0, gapCount);
    }
  }

  return Array.from({ length: gapCount }, (_, i) => ({ id: `g${i + 1}`, answer: '' }));
}

function asString(x: unknown, max: number): string {
  if (typeof x !== 'string') return '';
  return x.trim().slice(0, max);
}

function asStringArray(raw: unknown, maxItems: number, maxLen: number): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.map((x) => asString(x, maxLen)).filter(Boolean).slice(0, maxItems);
  return out.length > 0 ? out : undefined;
}

function parseSegmentsFromCheckText(checkText: string): TeacherExerciseSegment[] {
  const segments: TeacherExerciseSegment[] = [];
  let last = 0;
  let blankIdx = 0;
  const re = /_{2,}|…{2,}|\.{3,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(checkText)) !== null) {
    if (m.index > last) {
      segments.push({ type: 'text', value: checkText.slice(last, m.index) });
    }
    blankIdx += 1;
    segments.push({ type: 'blank', id: `b${blankIdx}` });
    last = m.index + m[0].length;
  }
  if (last < checkText.length) {
    segments.push({ type: 'text', value: checkText.slice(last) });
  }
  if (segments.length === 0) {
    segments.push({ type: 'text', value: checkText });
  }
  return segments;
}

function normalizeSegments(raw: unknown, checkText: string): TeacherExerciseSegment[] {
  if (!Array.isArray(raw)) {
    return parseSegmentsFromCheckText(checkText);
  }
  const out: TeacherExerciseSegment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const type = (item as { type?: unknown }).type;
    if (type === 'text') {
      const value = asString((item as { value?: unknown }).value, 800);
      if (value) out.push({ type: 'text', value });
    } else if (type === 'blank') {
      const id = asString((item as { id?: unknown }).id, 16) || `b${out.filter((s) => s.type === 'blank').length + 1}`;
      const answer = asString((item as { answer?: unknown }).answer, 48) || undefined;
      out.push(answer ? { type: 'blank', id, answer } : { type: 'blank', id });
    }
  }
  if (out.some((s) => s.type === 'blank')) return out;
  if (BLANK_RE.test(checkText)) return parseSegmentsFromCheckText(checkText);
  return out.length > 0 ? out : [{ type: 'text', value: checkText }];
}

function normalizeNumberedSentences(raw: unknown): TeacherNumberedSentence[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TeacherNumberedSentence[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const text = asString((item as { text?: unknown }).text, 400);
    if (!text) continue;
    const id = asString((item as { id?: unknown }).id, 16) || `s${i + 1}`;
    const label = asString((item as { label?: unknown }).label, 8) || `${i + 1}.`;
    const correctWord = asString((item as { correctWord?: unknown }).correctWord, 48) || undefined;
    out.push({ id, label, text, ...(correctWord ? { correctWord } : {}) });
  }
  return out.length > 0 ? out.slice(0, 6) : undefined;
}

function cleanFormPrompt(prompt: string): string {
  return prompt
    .replace(/\s*\([^)]{1,48}\)\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeFormInstruction(raw?: string): string | undefined {
  if (!raw) return undefined;
  if (/скобк|в скобк|указанн|форм[аыу].*\(|глагол.*скоб|\(.*\).*форм/i.test(raw)) {
    return undefined;
  }
  return raw;
}

function normalizeFormSlots(raw: unknown): TeacherFormSlot[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TeacherFormSlot[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const promptRaw = asString((item as { prompt?: unknown }).prompt, 400);
    const prompt = cleanFormPrompt(promptRaw);
    const options = asStringArray((item as { options?: unknown }).options, 4, 80);
    if (!prompt || !options || options.length < 2) continue;
    const id = asString((item as { id?: unknown }).id, 16) || `f${i + 1}`;
    const correct = asString((item as { correct?: unknown }).correct, 80) || undefined;
    out.push({ id, prompt, options, ...(correct ? { correct } : {}) });
  }
  return out.length > 0 ? out.slice(0, 4) : undefined;
}

function normalizeImageSlots(raw: unknown): TeacherImageSlot[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TeacherImageSlot[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const correctWord = asString((item as { correctWord?: unknown }).correctWord, 48);
    if (!correctWord) continue;
    const id = asString((item as { id?: unknown }).id, 16) || `img${i + 1}`;
    const label = asString((item as { label?: unknown }).label, 80) || undefined;
    const imageUrl = asString((item as { imageUrl?: unknown }).imageUrl, 1_800_000) || undefined;
    out.push({ id, correctWord, ...(label ? { label } : {}), ...(imageUrl ? { imageUrl } : {}) });
  }
  return out.length > 0 ? out.slice(0, 4) : undefined;
}

function normalizePairs(raw: unknown): TeacherMatchPair[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TeacherMatchPair[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const left = asString((item as { left?: unknown }).left, 120);
    const right = asString((item as { right?: unknown }).right, 120);
    if (!left || !right) continue;
    const id = asString((item as { id?: unknown }).id, 16) || `p${i + 1}`;
    out.push({ id, left, right });
  }
  return out.length >= 3 ? out.slice(0, 6) : undefined;
}

function normalizeKind(raw: unknown, item: Partial<TeacherExerciseItem>): TeacherExerciseKind {
  const k = asString(raw, 32);
  if (ALL_KINDS.includes(k as TeacherExerciseKind)) return k as TeacherExerciseKind;
  if (item.selectWord) return 'read_and_select';
  if (item.maskedSentence && /_+/.test(item.maskedSentence)) return 'fill_partial_word';
  if (item.passage && item.choices && item.choices.length >= 2) return 'identify_main_idea';
  if (item.pairs?.length) return 'match_pairs';
  if (item.formSlots?.length) return 'choose_word_form';
  if (item.imageSlots?.length) return 'word_to_image';
  if (item.shuffledWords?.length && item.correctOrder?.length) return 'sentence_order';
  if (item.numberedSentences?.length && item.wordBank?.length) return 'drag_word_to_blank';
  if (item.segments?.some((s) => s.type === 'blank')) {
    return item.wordBank?.length ? 'drag_word_to_blank' : 'type_word_in_blank';
  }
  if (item.choices && item.choices.length >= 2) return 'multiple_choice';
  if (item.minSentences && item.minSentences >= 3) return 'write_sentences';
  return 'free_text';
}

export type ExerciseAnswerState = {
  blanks: Record<string, string>;
  selectedChoice: string | null;
  freeText: string;
  voiceCapture?: { uri: string; durationMs: number } | null;
  formChoices: Record<string, string>;
  imageAssignments: Record<string, string>;
  numberedAssignments: Record<string, string>;
  matchPairs: Record<string, string>;
  sentenceOrder: string[];
  readSelectChoice: 'real' | 'fake' | null;
  partialGapInputs: Record<string, string>;
};

export function emptyExerciseAnswerState(): ExerciseAnswerState {
  return {
    blanks: {},
    selectedChoice: null,
    freeText: '',
    formChoices: {},
    imageAssignments: {},
    numberedAssignments: {},
    matchPairs: {},
    sentenceOrder: [],
    readSelectChoice: null,
    partialGapInputs: {},
  };
}

export function normalizeTeacherExerciseItem(raw: unknown, index: number): TeacherExerciseItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const checkText = asString(obj.checkText, 1200) || asString(obj.prompt, 1200) || asString(obj.text, 1200);
  const selectWord = asString(obj.selectWord ?? obj.word, 48) || undefined;
  const selectIsReal =
    typeof obj.selectIsReal === 'boolean'
      ? obj.selectIsReal
      : typeof obj.isReal === 'boolean'
        ? obj.isReal
        : undefined;
  const maskedSentence = asString(obj.maskedSentence ?? obj.masked, 600) || undefined;
  const passage = asString(obj.passage, 1200) || undefined;
  const correctChoice = asString(obj.correctChoice ?? obj.correct, 200) || undefined;
  if (
    !checkText &&
    !obj.pairs &&
    !obj.shuffledWords &&
    !selectWord &&
    !maskedSentence &&
    !passage
  ) {
    return null;
  }

  const choices = asStringArray(obj.choices ?? obj.options, 6, 200);
  const segments = normalizeSegments(obj.segments, checkText || ' ');
  const wordBank = asStringArray(obj.wordBank ?? obj.bank, 12, 48);
  const numberedSentences = normalizeNumberedSentences(obj.numberedSentences);
  const formSlots = normalizeFormSlots(obj.formSlots);
  const imageSlots = normalizeImageSlots(obj.imageSlots);
  const pairs = normalizePairs(obj.pairs);
  const shuffledWords = asStringArray(obj.shuffledWords, 16, 48);
  const correctOrder = asStringArray(obj.correctOrder, 16, 48);
  const minSentencesRaw = typeof obj.minSentences === 'number' ? obj.minSentences : undefined;
  const minSentences = minSentencesRaw && minSentencesRaw >= 3 ? Math.min(8, Math.floor(minSentencesRaw)) : undefined;
  const voicePrompt = asString(obj.voicePrompt, 600) || undefined;
  const instruction = asString(obj.instruction, 160) || undefined;
  const partialGaps = maskedSentence ? normalizePartialGaps(obj.partialGaps, maskedSentence) : undefined;

  const draft: Partial<TeacherExerciseItem> = {
    segments,
    choices,
    wordBank,
    numberedSentences,
    formSlots,
    imageSlots,
    pairs,
    shuffledWords,
    correctOrder,
    minSentences,
    selectWord,
    maskedSentence,
    partialGaps,
    passage,
    correctChoice,
  };
  const kind = normalizeKind(obj.kind ?? obj.type, draft);
  const resolvedCheckText =
    checkText ||
    (kind === 'read_and_select' && selectWord ? selectWord : '') ||
    (kind === 'fill_partial_word' && maskedSentence ? maskedSentence : '') ||
    (kind === 'identify_main_idea' && passage ? 'Определи главную мысль' : '') ||
    (kind === 'match_pairs' ? 'Сопоставь слова и переводы' : '') ||
    (isOrderExerciseKind(kind) ? 'Составь предложение из слов' : '') ||
    (isChoiceExerciseKind(kind) ? 'Выбери правильный вариант' : '') ||
    segmentsToPromptText(segments);

  return coerceDragWordToBlankItem({
    id: asString(obj.id, 32) || `ex-${index + 1}`,
    kind,
    instruction: isFormExerciseKind(kind) ? normalizeFormInstruction(instruction) : instruction,
    segments,
    choices:
      isChoiceExerciseKind(kind) || kind === 'identify_main_idea' ? choices : undefined,
    wordBank:
      isDragBlankExerciseKind(kind) || kind === 'word_to_image' ? wordBank : undefined,
    numberedSentences: isDragBlankExerciseKind(kind) ? numberedSentences : undefined,
    formSlots: isFormExerciseKind(kind) ? formSlots : undefined,
    imageSlots: kind === 'word_to_image' ? imageSlots : undefined,
    pairs: kind === 'match_pairs' ? pairs : undefined,
    shuffledWords: isOrderExerciseKind(kind) ? shuffledWords : undefined,
    correctOrder: isOrderExerciseKind(kind) ? correctOrder : undefined,
    minSentences: kind === 'write_sentences' ? minSentences ?? 5 : undefined,
    voicePrompt: kind === 'voice_recording' ? voicePrompt : undefined,
    selectWord: kind === 'read_and_select' ? selectWord : undefined,
    selectIsReal: kind === 'read_and_select' ? selectIsReal : undefined,
    maskedSentence: kind === 'fill_partial_word' ? maskedSentence : undefined,
    partialGaps: kind === 'fill_partial_word' ? partialGaps : undefined,
    passage: kind === 'identify_main_idea' ? passage : undefined,
    correctChoice:
      isChoiceExerciseKind(kind) || kind === 'identify_main_idea' ? correctChoice : undefined,
    checkText: resolvedCheckText,
  });
}

export function normalizeTeacherExerciseSet(raw: unknown): TeacherExerciseItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const list = Array.isArray(obj.exercises) ? obj.exercises : Array.isArray(raw) ? raw : [];
  const out: TeacherExerciseItem[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = normalizeTeacherExerciseItem(list[i], i);
    if (item) out.push(item);
  }
  return out.slice(0, DRILL_TASK_COUNT);
}

export function segmentsToPromptText(segments: TeacherExerciseSegment[]): string {
  return segments
    .map((seg) => (seg.type === 'text' ? seg.value : '______'))
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function countSentences(text: string): number {
  return text
    .split('\n')
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line.length > 3)
    .length;
}

export function buildExerciseCheckPayload(
  item: TeacherExerciseItem,
  state: ExerciseAnswerState,
  voiceTranscript = '',
): {
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
} {
  const {
    blanks,
    selectedChoice,
    freeText,
    formChoices,
    imageAssignments,
    numberedAssignments,
    matchPairs,
    sentenceOrder,
    readSelectChoice,
    partialGapInputs,
  } = state;

  const learnerAnswers = {
    blanks,
    selectedChoice,
    freeText,
    formChoices,
    imageAssignments,
    numberedAssignments,
    matchPairs,
    sentenceOrder,
    readSelectChoice,
    partialGapInputs,
  };

  const wrap = (exercise: string, answer: string) => ({
    exercise,
    answer,
    item,
    learnerAnswers,
  });

  if (item.kind === 'read_and_select' && item.selectWord) {
    return wrap(
      `Настоящее ли слово «${item.selectWord}»?`,
      readSelectChoice === 'real' ? 'настоящее' : readSelectChoice === 'fake' ? 'выдуманное' : '',
    );
  }

  if (item.kind === 'fill_partial_word' && item.maskedSentence) {
    const gapAnswers =
      item.partialGaps?.map((g) => partialGapInputs[g.id] ?? '').join(', ') ??
      Object.values(partialGapInputs).join(', ');
    return wrap(`${item.maskedSentence}\nПолное предложение: ${item.checkText}`.trim(), gapAnswers);
  }

  if (item.kind === 'identify_main_idea' && item.passage) {
    return wrap(`${item.passage}\n${item.checkText}`.trim(), (selectedChoice ?? '').trim());
  }

  if (item.kind === 'voice_recording') {
    return wrap((item.voicePrompt || item.checkText).trim(), voiceTranscript.trim());
  }

  if (item.kind === 'write_sentences' || item.kind === 'free_text') {
    return wrap(item.checkText.trim(), freeText.trim());
  }

  if (item.kind === 'multiple_choice' || isChoiceExerciseKind(item.kind)) {
    const prompt =
      segmentsToPromptText(item.segments) ||
      item.segments
        .filter((s) => s.type === 'text')
        .map((s) => s.value)
        .join('') ||
      item.checkText;
    return wrap(prompt.trim(), (selectedChoice ?? '').trim());
  }

  if (isFormExerciseKind(item.kind) && item.formSlots?.length) {
    const lines = item.formSlots.map((s) => s.prompt).join('\n');
    const answer = item.formSlots.map((s) => `${s.id}: ${formChoices[s.id] ?? ''}`).join('; ');
    return wrap(`${item.checkText}\n${lines}`.trim(), answer);
  }
  if (isFormExerciseKind(item.kind)) {
    return wrap(item.checkText.trim(), freeText.trim());
  }

  if (item.kind === 'word_to_image' && item.imageSlots?.length) {
    const answer = item.imageSlots.map((s) => `${s.id}: ${imageAssignments[s.id] ?? ''}`).join('; ');
    return wrap(item.checkText.trim(), answer);
  }
  if (item.kind === 'word_to_image') {
    return wrap(item.checkText.trim(), freeText.trim());
  }

  if (item.kind === 'match_pairs' && item.pairs?.length) {
    const answer = item.pairs.map((p) => `${p.left} → ${matchPairs[p.id] ?? ''}`).join('\n');
    return wrap(item.checkText.trim(), answer);
  }
  if (item.kind === 'match_pairs') {
    return wrap(item.checkText.trim(), freeText.trim());
  }

  if (isOrderExerciseKind(item.kind)) {
    const target = item.shuffledWords?.length ?? item.correctOrder?.length ?? 0;
    if (target > 0) {
      return wrap(item.checkText.trim(), sentenceOrder.join(' '));
    }
    return wrap(item.checkText.trim(), freeText.trim());
  }

  if (item.numberedSentences?.length) {
    const answer = item.numberedSentences
      .map((s) => `${s.label} ${fillBlankInText(s.text, numberedAssignments[s.id] ?? '')}`)
      .join('; ');
    return wrap(item.checkText.trim(), answer);
  }

  const sentence = segmentsToPromptText(item.segments);
  const blankAnswers = item.segments
    .filter((s): s is Extract<TeacherExerciseSegment, { type: 'blank' }> => s.type === 'blank')
    .map((s) => (blanks[s.id] ?? '').trim())
    .filter(Boolean);

  if (blankAnswers.length === 0 && freeText.trim()) {
    return wrap(item.checkText.trim(), freeText.trim());
  }

  const exerciseParts = [item.instruction, sentence || item.checkText].filter(Boolean);
  return wrap(exerciseParts.join('\n').trim(), blankAnswers.join(', '));
}

export function exerciseHasCompleteAnswer(item: TeacherExerciseItem, state: ExerciseAnswerState): boolean {
  const {
    blanks,
    selectedChoice,
    freeText,
    voiceCapture,
    formChoices,
    imageAssignments,
    numberedAssignments,
    matchPairs,
    sentenceOrder,
    readSelectChoice,
    partialGapInputs,
  } = state;

  if (item.kind === 'read_and_select') {
    return readSelectChoice !== null;
  }

  if (item.kind === 'fill_partial_word' && item.partialGaps?.length) {
    return item.partialGaps.every((g) => (partialGapInputs[g.id] ?? '').trim().length > 0);
  }

  if (item.kind === 'identify_main_idea' || isChoiceExerciseKind(item.kind)) {
    return Boolean(selectedChoice?.trim());
  }

  if (item.kind === 'voice_recording') {
    return Boolean(voiceCapture && voiceCapture.durationMs >= 450);
  }

  if (item.kind === 'write_sentences') {
    const min = item.minSentences ?? 5;
    return countSentences(freeText) >= min || freeText.trim().length >= min * 12;
  }

  if (item.kind === 'free_text') {
    return freeText.trim().length > 0;
  }

  if (isFormExerciseKind(item.kind) && item.formSlots?.length) {
    return item.formSlots.every((s) => Boolean(formChoices[s.id]?.trim()));
  }
  if (isFormExerciseKind(item.kind)) {
    return freeText.trim().length > 0;
  }

  if (item.kind === 'word_to_image' && item.imageSlots?.length) {
    return item.imageSlots.every((s) => Boolean(imageAssignments[s.id]?.trim()));
  }
  if (item.kind === 'word_to_image') {
    return freeText.trim().length > 0;
  }

  if (item.kind === 'match_pairs' && item.pairs?.length) {
    return item.pairs.every((p) => Boolean(matchPairs[p.id]?.trim()));
  }
  if (item.kind === 'match_pairs') {
    return freeText.trim().length > 0;
  }

  if (isOrderExerciseKind(item.kind)) {
    const target = item.shuffledWords?.length ?? item.correctOrder?.length ?? 0;
    if (target > 0) return sentenceOrder.length === target;
    return freeText.trim().length > 0;
  }

  if (item.numberedSentences?.length) {
    return item.numberedSentences.every((s) => Boolean(numberedAssignments[s.id]?.trim()));
  }

  const blankIds = item.segments.filter((s) => s.type === 'blank').map((s) => s.id);
  if (
    blankIds.length === 0 &&
    (item.kind === 'type_word_in_blank' || isDragBlankExerciseKind(item.kind))
  ) {
    return freeText.trim().length > 0;
  }
  return blankIds.length > 0 && blankIds.every((id) => (blanks[id] ?? '').trim().length > 0);
}

/** Voice больше не добавляется автоматически — тип в банке. */
export function appendVoiceExerciseIfMissing(
  items: TeacherExerciseItem[],
  _lessonContext: string,
): TeacherExerciseItem[] {
  return items.slice(0, DRILL_TASK_COUNT);
}
