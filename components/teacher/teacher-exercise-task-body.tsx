import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';
import { TEACHER_TITLE } from '@/components/teacher/teacher-tokens';
import { drillTaskStyles as styles } from '@/components/teacher/teacher-drill-styles';
import { DrillDropZone, DraggableWordBank, useWordDragAssign } from '@/components/teacher/teacher-word-drag';
import type { TeacherExerciseItem, TeacherExerciseSegment } from '@/types/companion-chat-api';
import { hashSeed } from '@/utils/teacher-exercise-bank';
import type { ExerciseAnswerState } from '@/utils/teacher-exercise-normalize';
import {
  parseMaskedSentence,
  textToBlankSegments,
} from '@/utils/teacher-exercise-normalize';
import {
  normalizeNumberedSentenceInput,
  NUMBERED_SENTENCE_START,
} from '@/utils/numbered-sentence-input';

type VoiceCapture = { uri: string; durationMs: number };

type Props = {
  exercise: TeacherExerciseItem;
  disabled: boolean;
  state: ExerciseAnswerState;
  onStateChange: (patch: Partial<ExerciseAnswerState>) => void;
  blankRefs: MutableRefObject<Record<string, TextInput | null>>;
  onFocusBlank: (id: string) => void;
  activeBlankId: string | null;
  VoiceBlock: React.ComponentType<{
    disabled: boolean;
    capture: VoiceCapture | null;
    onCapture: (next: VoiceCapture | null) => void;
  }>;
  voiceCapture: VoiceCapture | null;
  onVoiceCapture: (next: VoiceCapture | null) => void;
};

function WordBank({
  words,
  usedIndices,
  selected,
  onSelect,
  disabled,
}: {
  words: string[];
  usedIndices: Set<number>;
  selected: string | null;
  onSelect: (word: string, index: number) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.bankRow}>
      {words.map((word, wi) => {
        const isUsed = usedIndices.has(wi);
        return (
          <Pressable
            key={`${word}-${wi}`}
            hitSlop={6}
            onPress={() => {
              if (disabled || isUsed) return;
              onSelect(word, wi);
              void Haptics.selectionAsync();
            }}
            style={({ pressed }) => [
              styles.bankChip,
              selected === word && styles.bankChipSelected,
              isUsed && styles.bankChipUsed,
              pressed && !disabled && !isUsed && styles.bankChipPressed,
            ]}>
            <Text style={[styles.bankChipText, isUsed && styles.bankChipTextUsed]}>{word}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function InlineDragBlankLine({
  segments,
  getBlankValue,
  activeBlankId,
  dropIdForBlank,
  onFocusBlank,
  onTapBlank,
  withDrag,
}: {
  segments: TeacherExerciseSegment[];
  getBlankValue: (blankId: string) => string;
  activeBlankId: string | null;
  dropIdForBlank: (blankId: string) => string;
  onFocusBlank: (blankId: string) => void;
  onTapBlank: (blankId: string) => void;
  withDrag: boolean;
}) {
  return (
    <View style={styles.inlineRow}>
      {segments.map((seg, segIdx) => {
        if (seg.type === 'text') {
          return (
            <Text key={`t-${segIdx}`} style={styles.promptText}>
              {seg.value}
            </Text>
          );
        }
        const value = getBlankValue(seg.id);
        const focused = activeBlankId === seg.id;
        const blankStyle = [
          styles.blankShell,
          focused && styles.blankShellFocused,
          value ? styles.blankShellFilled : null,
        ];
        if (withDrag) {
          return (
            <DrillDropZone
              key={seg.id}
              id={dropIdForBlank(seg.id)}
              onPress={() => onTapBlank(seg.id)}
              style={blankStyle}>
              <Text style={[styles.blankFilledText, !value && styles.blankPlaceholder]}>
                {value || '___'}
              </Text>
            </DrillDropZone>
          );
        }
        return (
          <Pressable
            key={seg.id}
            hitSlop={4}
            onPress={() => onFocusBlank(seg.id)}
            style={blankStyle}>
            <Text style={[styles.blankFilledText, !value && styles.blankPlaceholder]}>{value || '___'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NumberedSentenceInput({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (text: string) => void;
}) {
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || value) return;
    seeded.current = true;
    onChange(NUMBERED_SENTENCE_START);
  }, [onChange, value]);

  return (
    <TextInput
      value={value || NUMBERED_SENTENCE_START}
      onChangeText={(text) => onChange(normalizeNumberedSentenceInput(value || NUMBERED_SENTENCE_START, text))}
      placeholder="1. Первое предложение…"
      placeholderTextColor={APP_THEME.color.mutedFaint}
      multiline
      style={styles.freeInput}
      editable={!disabled}
      blurOnSubmit={false}
    />
  );
}

function FreeTextAnswer({
  exercise,
  disabled,
  value,
  onChange,
  label = 'Ваш ответ',
}: {
  exercise: TeacherExerciseItem;
  disabled: boolean;
  value: string;
  onChange: (text: string) => void;
  label?: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.promptSurface}>
        <Text style={styles.promptPlain}>{exercise.checkText}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Напишите ответ здесь…"
        placeholderTextColor={APP_THEME.color.mutedFaint}
        multiline
        style={styles.freeInput}
        editable={!disabled}
      />
    </View>
  );
}

export function TeacherExerciseTaskBody({
  exercise,
  disabled,
  state,
  onStateChange,
  blankRefs,
  onFocusBlank,
  activeBlankId,
  VoiceBlock,
  voiceCapture,
  onVoiceCapture,
}: Props) {
  const [selectedChip, setSelectedChip] = useState<{ word: string; index: number } | null>(null);
  const [activeLeftId, setActiveLeftId] = useState<string | null>(null);
  const [activeNumberedId, setActiveNumberedId] = useState<string | null>(null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [usedChipIndices, setUsedChipIndices] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setSelectedChip(null);
    setActiveLeftId(null);
    setActiveNumberedId(null);
    setActiveImageId(null);
    setUsedChipIndices(new Set());
  }, [exercise.id]);

  useEffect(() => {
    if (disabled) return;
    const ids = exercise.segments.filter((s) => s.type === 'blank').map((s) => s.id);
    if (ids.length > 0) {
      onFocusBlank(ids[0]);
      return;
    }
    if (exercise.numberedSentences?.length) {
      setActiveNumberedId(exercise.numberedSentences[0].id);
    }
  }, [disabled, exercise.id, exercise.numberedSentences, exercise.segments, onFocusBlank]);

  const shuffledPool = useMemo(() => {
    if (exercise.kind !== 'sentence_order') return [];
    const words = exercise.shuffledWords?.length ? exercise.shuffledWords : exercise.correctOrder ?? [];
    return words.filter((w) => !state.sentenceOrder.includes(w));
  }, [exercise, state.sentenceOrder]);

  const rightColumn = useMemo(() => {
    if (!exercise.pairs?.length) return [];
    const rights = exercise.pairs.map((p) => p.right);
    const out = [...rights];
    let s = hashSeed(exercise.id);
    for (let i = out.length - 1; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = Math.floor((s / 4294967296) * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }, [exercise.id, exercise.pairs]);

  const blankIds = useMemo(
    () => exercise.segments.filter((s) => s.type === 'blank').map((s) => s.id),
    [exercise.segments],
  );
  const hasWordBank = Boolean(exercise.wordBank?.length);
  const hasBlanks = blankIds.length > 0;

  const markChipUsed = (index: number) => {
    setUsedChipIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const assignWordToBlank = useCallback(
    (word: string, chipIndex: number, blankId: string) => {
      onStateChange({ blanks: { ...state.blanks, [blankId]: word } });
      markChipUsed(chipIndex);
      setSelectedChip(null);
      onFocusBlank(blankId);
      const nextBlank = blankIds.find((id) => id !== blankId && !(state.blanks[id] ?? '').trim());
      if (nextBlank) onFocusBlank(nextBlank);
    },
    [blankIds, onFocusBlank, onStateChange, state.blanks],
  );

  const assignWordToNumbered = useCallback(
    (word: string, chipIndex: number, sentenceId: string) => {
      onStateChange({
        numberedAssignments: { ...state.numberedAssignments, [sentenceId]: word },
      });
      markChipUsed(chipIndex);
      setActiveNumberedId(null);
      setSelectedChip(null);
    },
    [onStateChange, state.numberedAssignments],
  );

  const assignWordToTarget = useCallback(
    (targetId: string, word: string, chipIndex: number) => {
      if (targetId.startsWith('blank-')) {
        assignWordToBlank(word, chipIndex, targetId.slice('blank-'.length));
        return;
      }
      if (targetId.startsWith('numbered-')) {
        assignWordToNumbered(word, chipIndex, targetId.slice('numbered-'.length));
      }
    },
    [assignWordToBlank, assignWordToNumbered],
  );

  useWordDragAssign(assignWordToTarget);

  const handleBlankBankTap = useCallback(
    (word: string, chipIndex: number) => {
      void Haptics.selectionAsync();
      const target =
        activeBlankId && blankIds.includes(activeBlankId)
          ? activeBlankId
          : blankIds.find((id) => !(state.blanks[id] ?? '').trim()) ?? blankIds[0];
      if (!target) {
        setSelectedChip({ word, index: chipIndex });
        return;
      }
      assignWordToBlank(word, chipIndex, target);
    },
    [activeBlankId, assignWordToBlank, blankIds, state.blanks],
  );

  const handleNumberedBankTap = useCallback(
    (word: string, chipIndex: number) => {
      void Haptics.selectionAsync();
      const target =
        activeNumberedId ??
        exercise.numberedSentences?.find((s) => !state.numberedAssignments[s.id])?.id;
      if (!target) return;
      assignWordToNumbered(word, chipIndex, target);
    },
    [activeNumberedId, assignWordToNumbered, exercise.numberedSentences, state.numberedAssignments],
  );

  const renderBlanks = (withBank: boolean) => (
    <>
      <View style={styles.promptSurface}>
        {withBank ? (
          <InlineDragBlankLine
            segments={exercise.segments}
            getBlankValue={(blankId) => state.blanks[blankId] ?? ''}
            activeBlankId={activeBlankId}
            dropIdForBlank={(blankId) => `blank-${blankId}`}
            onFocusBlank={onFocusBlank}
            onTapBlank={(blankId) => {
              onFocusBlank(blankId);
              if (selectedChip) {
                assignWordToBlank(selectedChip.word, selectedChip.index, blankId);
              }
            }}
            withDrag
          />
        ) : (
          <View style={styles.inlineRow}>
            {exercise.segments.map((seg, segIdx) => {
              if (seg.type === 'text') {
                return (
                  <Text key={`t-${segIdx}`} style={styles.promptText}>
                    {seg.value}
                  </Text>
                );
              }
              const value = state.blanks[seg.id] ?? '';
              const focused = activeBlankId === seg.id;
              return (
                <Pressable
                  key={seg.id}
                  hitSlop={4}
                  onPress={() => onFocusBlank(seg.id)}
                  style={[
                    styles.blankShell,
                    focused && styles.blankShellFocused,
                    value ? styles.blankShellFilled : null,
                  ]}>
                  <TextInput
                    ref={(el) => {
                      blankRefs.current[seg.id] = el;
                    }}
                    value={value}
                    onChangeText={(text) => onStateChange({ blanks: { ...state.blanks, [seg.id]: text } })}
                    onFocus={() => onFocusBlank(seg.id)}
                    placeholder="…"
                    placeholderTextColor={APP_THEME.color.mutedFaint}
                    style={styles.blankInput}
                    editable={!disabled}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
      {withBank && exercise.wordBank?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Перетащи слово в пропуск</Text>
          <DraggableWordBank
            words={exercise.wordBank}
            usedIndices={usedChipIndices}
            selectedIndex={selectedChip?.index ?? null}
            disabled={disabled}
            onTap={handleBlankBankTap}
          />
        </View>
      ) : null}
    </>
  );

  switch (exercise.kind) {
    case 'drag_word_to_blank':
    case 'fill_blank':
      if (exercise.numberedSentences?.length) {
        return (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Перетащи слово в пропуск в каждом предложении</Text>
              {exercise.numberedSentences.map((s) => {
                const assignment = state.numberedAssignments[s.id] ?? '';
                const parts = textToBlankSegments(s.text, s.id);
                return (
                  <View
                    key={s.id}
                    style={[
                      styles.numberedRow,
                      activeNumberedId === s.id && styles.numberedRowActive,
                      assignment && styles.numberedRowFilled,
                    ]}>
                    <Text style={styles.numberedLabel}>{s.label}</Text>
                    <View style={styles.numberedSentenceBody}>
                      <InlineDragBlankLine
                      segments={parts}
                      getBlankValue={() => assignment}
                      activeBlankId={activeNumberedId === s.id ? s.id : null}
                      dropIdForBlank={() => `numbered-${s.id}`}
                      onFocusBlank={() => setActiveNumberedId(s.id)}
                      onTapBlank={() => {
                        setActiveNumberedId(s.id);
                        if (selectedChip) {
                          assignWordToNumbered(selectedChip.word, selectedChip.index, s.id);
                        }
                      }}
                      withDrag
                    />
                    </View>
                  </View>
                );
              })}
            </View>
            {exercise.wordBank?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Слова</Text>
                <DraggableWordBank
                  words={exercise.wordBank}
                  usedIndices={usedChipIndices}
                  selectedIndex={selectedChip?.index ?? null}
                  disabled={disabled}
                  onTap={handleNumberedBankTap}
                />
              </View>
            ) : null}
          </>
        );
      }

      if (!hasBlanks && !hasWordBank) {
        return (
          <FreeTextAnswer
            exercise={exercise}
            disabled={disabled}
            value={state.freeText}
            onChange={(text) => onStateChange({ freeText: text })}
          />
        );
      }

      if (hasWordBank && !hasBlanks) {
        return (
          <>
            <View style={styles.promptSurface}>
              <Text style={styles.promptPlain}>{exercise.checkText}</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Нажми слова — собери ответ</Text>
              <WordBank
                words={exercise.wordBank!}
                usedIndices={usedChipIndices}
                selected={selectedChip?.word ?? null}
                disabled={disabled}
                onSelect={(word, chipIndex) => {
                  const prev = state.freeText.trim();
                  onStateChange({ freeText: prev ? `${prev} ${word}` : word });
                  markChipUsed(chipIndex);
                }}
              />
            </View>
            <TextInput
              value={state.freeText}
              onChangeText={(text) => onStateChange({ freeText: text })}
              placeholder="Или напиши ответ вручную…"
              placeholderTextColor={APP_THEME.color.mutedFaint}
              multiline
              style={styles.freeInput}
              editable={!disabled}
            />
          </>
        );
      }

      return renderBlanks(hasWordBank);

    case 'type_word_in_blank':
      if (!hasBlanks) {
        return (
          <FreeTextAnswer
            exercise={exercise}
            disabled={disabled}
            value={state.freeText}
            onChange={(text) => onStateChange({ freeText: text })}
          />
        );
      }
      return renderBlanks(false);

    case 'choose_word_form':
      if (!exercise.formSlots?.length) {
        return (
          <FreeTextAnswer
            exercise={exercise}
            disabled={disabled}
            value={state.freeText}
            onChange={(text) => onStateChange({ freeText: text })}
          />
        );
      }
      return (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Выбери слово для пропуска</Text>
          {exercise.formSlots.map((slot) => {
            const chosen = state.formChoices[slot.id];
            const promptText = slot.prompt.replace('___', chosen || '___');
            return (
              <View key={slot.id} style={styles.formBlock}>
                <View style={styles.formPrompt}>
                  <Text style={styles.formPromptText}>{promptText}</Text>
                </View>
                <View style={styles.optionsCol}>
                  {slot.options.map((opt) => (
                    <Pressable
                      key={opt}
                      disabled={disabled}
                      onPress={() => {
                        onStateChange({ formChoices: { ...state.formChoices, [slot.id]: opt } });
                        void Haptics.selectionAsync();
                      }}
                      style={[styles.optionRow, chosen === opt && styles.optionRowSelected]}>
                      <Text style={[styles.optionText, chosen === opt && styles.optionTextSelected]}>{opt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      );

    case 'word_to_image':
      if (!exercise.imageSlots?.length) {
        return (
          <FreeTextAnswer
            exercise={exercise}
            disabled={disabled}
            value={state.freeText}
            onChange={(text) => onStateChange({ freeText: text })}
          />
        );
      }
      return (
        <>
          <View style={styles.imageGrid}>
            {exercise.imageSlots?.map((slot) => {
              const assigned = state.imageAssignments[slot.id];
              return (
                <Pressable
                  key={slot.id}
                  onPress={() => setActiveImageId(slot.id)}
                  style={[
                    styles.imageCard,
                    activeImageId === slot.id && styles.imageCardActive,
                    assigned && styles.imageCardFilled,
                  ]}>
                  {slot.imageUrl ? (
                    <Image source={{ uri: slot.imageUrl }} style={styles.imagePhoto} contentFit="cover" />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="image-outline" size={28} color={APP_THEME.color.mutedSoft} />
                    </View>
                  )}
                  <Text style={styles.imageWord}>{assigned || slot.label || '…'}</Text>
                </Pressable>
              );
            })}
          </View>
          {exercise.wordBank?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Слова — нажми слово, затем картинку</Text>
              <WordBank
                words={exercise.wordBank}
                usedIndices={usedChipIndices}
                selected={selectedChip?.word ?? null}
                disabled={disabled}
                onSelect={(word, chipIndex) => {
                  const target =
                    activeImageId ??
                    exercise.imageSlots?.find((s) => !state.imageAssignments[s.id])?.id;
                  if (!target) {
                    setSelectedChip({ word, index: chipIndex });
                    return;
                  }
                  onStateChange({
                    imageAssignments: { ...state.imageAssignments, [target]: word },
                  });
                  markChipUsed(chipIndex);
                  setActiveImageId(null);
                  setSelectedChip(null);
                }}
              />
            </View>
          ) : null}
        </>
      );

    case 'sentence_order':
      if (!exercise.shuffledWords?.length && !exercise.correctOrder?.length) {
        return (
          <FreeTextAnswer
            exercise={exercise}
            disabled={disabled}
            value={state.freeText}
            onChange={(text) => onStateChange({ freeText: text })}
          />
        );
      }
      return (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Собранное предложение</Text>
            <View style={styles.sentenceBuilt}>
              <Text style={styles.sentenceBuiltText}>
                {state.sentenceOrder.length > 0 ? state.sentenceOrder.join(' ') : 'Нажимай слова по порядку'}
              </Text>
              {state.sentenceOrder.length > 0 ? (
                <Pressable
                  onPress={() => onStateChange({ sentenceOrder: [] })}
                  style={styles.sentenceReset}>
                  <Ionicons name="refresh" size={14} color={APP_THEME.color.mutedSoft} />
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Слова</Text>
            <View style={styles.bankRow}>
              {shuffledPool.map((word, wi) => (
                <Pressable
                  key={`${word}-${wi}`}
                  onPress={() => {
                    onStateChange({ sentenceOrder: [...state.sentenceOrder, word] });
                    void Haptics.selectionAsync();
                  }}
                  disabled={disabled}
                  style={({ pressed }) => [styles.bankChip, pressed && styles.bankChipPressed]}>
                  <Text style={styles.bankChipText}>{word}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      );

    case 'match_pairs':
      if (!exercise.pairs?.length) {
        return (
          <FreeTextAnswer
            exercise={exercise}
            disabled={disabled}
            value={state.freeText}
            onChange={(text) => onStateChange({ freeText: text })}
          />
        );
      }
      return (
        <View style={styles.matchWrap}>
          <View style={styles.matchCol}>
            {exercise.pairs?.map((p) => {
              const matched = state.matchPairs[p.id];
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setActiveLeftId(p.id)}
                  style={[
                    styles.matchItem,
                    activeLeftId === p.id && styles.matchItemActive,
                    matched && styles.matchItemMatched,
                  ]}>
                  <Text style={styles.matchText}>{p.left}</Text>
                  {matched ? (
                    <View style={styles.matchLink}>
                      <Ionicons name="arrow-forward" size={12} color={APP_THEME.color.textSoft} />
                      <Text style={styles.matchLinkText}>{matched}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.matchCol}>
            {rightColumn.map((right, ri) => {
              const taken = Object.values(state.matchPairs).includes(right);
              return (
                <Pressable
                  key={`r-${ri}-${right}`}
                  disabled={disabled || taken || !activeLeftId}
                  onPress={() => {
                    if (!activeLeftId) return;
                    onStateChange({
                      matchPairs: { ...state.matchPairs, [activeLeftId]: right },
                    });
                    setActiveLeftId(null);
                    void Haptics.selectionAsync();
                  }}
                  style={[styles.matchItem, styles.matchItemRight, taken && styles.matchItemUsed]}>
                  <Text style={styles.matchText}>{right}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );

    case 'read_and_select':
      return (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Настоящее это слово?</Text>
          <View style={styles.readSelectCard}>
            <Text style={styles.readSelectWord}>{exercise.selectWord ?? exercise.checkText}</Text>
          </View>
          <View style={styles.readSelectRow}>
            <Pressable
              disabled={disabled}
              onPress={() => {
                onStateChange({ readSelectChoice: 'real' });
                void Haptics.selectionAsync();
              }}
              style={[
                styles.readSelectBtn,
                state.readSelectChoice === 'real' && styles.readSelectBtnActive,
              ]}>
              <Text
                style={[
                  styles.readSelectBtnText,
                  state.readSelectChoice === 'real' && styles.readSelectBtnTextActive,
                ]}>
                Настоящее
              </Text>
            </Pressable>
            <Pressable
              disabled={disabled}
              onPress={() => {
                onStateChange({ readSelectChoice: 'fake' });
                void Haptics.selectionAsync();
              }}
              style={[
                styles.readSelectBtn,
                state.readSelectChoice === 'fake' && styles.readSelectBtnActive,
              ]}>
              <Text
                style={[
                  styles.readSelectBtnText,
                  state.readSelectChoice === 'fake' && styles.readSelectBtnTextActive,
                ]}>
                Выдуманное
              </Text>
            </Pressable>
          </View>
        </View>
      );

    case 'fill_partial_word': {
      const masked = exercise.maskedSentence ?? exercise.checkText;
      const parts = parseMaskedSentence(masked);
      return (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Допиши пропущенные буквы</Text>
          <View style={styles.promptSurface}>
            <View style={styles.inlineRow}>
              {parts.map((part, i) => {
                if (part.type === 'text') {
                  return (
                    <Text key={`t-${i}`} style={styles.promptText}>
                      {part.value}
                    </Text>
                  );
                }
                const value = state.partialGapInputs[part.id] ?? '';
                return (
                  <TextInput
                    key={part.id}
                    value={value}
                    onChangeText={(text) =>
                      onStateChange({
                        partialGapInputs: { ...state.partialGapInputs, [part.id]: text },
                      })
                    }
                    placeholder="…"
                    placeholderTextColor={APP_THEME.color.mutedFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!disabled}
                    style={styles.partialGapInput}
                  />
                );
              })}
            </View>
          </View>
        </View>
      );
    }

    case 'identify_main_idea':
      return (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Главная мысль текста</Text>
          <View style={styles.promptSurface}>
            <Text style={styles.passageText}>{exercise.passage ?? exercise.checkText}</Text>
          </View>
          <View style={styles.optionsCol}>
            {(exercise.choices ?? []).map((opt) => (
              <Pressable
                key={opt}
                disabled={disabled}
                onPress={() => {
                  onStateChange({ selectedChoice: opt });
                  void Haptics.selectionAsync();
                }}
                style={[styles.optionRow, state.selectedChoice === opt && styles.optionRowSelected]}>
                <Text style={[styles.optionText, state.selectedChoice === opt && styles.optionTextSelected]}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      );

    case 'voice_recording':
      return (
        <>
          <View style={styles.promptSurface}>
            <Text style={styles.promptPlain}>{exercise.voicePrompt || exercise.checkText}</Text>
          </View>
          <VoiceBlock disabled={disabled} capture={voiceCapture} onCapture={onVoiceCapture} />
        </>
      );

    case 'write_sentences':
      return (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Напиши {exercise.minSentences ?? 5} предложений</Text>
          <View style={styles.promptSurface}>
            <Text style={styles.promptPlain}>{exercise.checkText}</Text>
          </View>
          <NumberedSentenceInput
            value={state.freeText}
            disabled={disabled}
            onChange={(text) => onStateChange({ freeText: text })}
          />
        </View>
      );

    case 'free_text':
      return (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ваш ответ</Text>
          <View style={styles.promptSurface}>
            <Text style={styles.promptPlain}>{exercise.checkText}</Text>
          </View>
          <TextInput
            value={state.freeText}
            onChangeText={(text) => onStateChange({ freeText: text })}
            placeholder="Напишите ответ здесь…"
            placeholderTextColor={APP_THEME.color.mutedFaint}
            multiline
            style={styles.freeInput}
            editable={!disabled}
          />
        </View>
      );

    case 'multiple_choice':
      return (
        <View style={styles.promptSurface}>
          <Text style={styles.promptPlain}>{exercise.checkText}</Text>
        </View>
      );

    default:
      return (
        <View style={styles.promptSurface}>
          <Text style={styles.promptPlain}>{exercise.checkText}</Text>
        </View>
      );
  }
}
