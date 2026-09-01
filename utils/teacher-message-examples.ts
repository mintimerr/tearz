import { extractPairsFromTeacherText } from '@/utils/learner-lexicon';
import {
  formatTeacherSectionLabel,
  getTeacherSectionIcon,
  isDialogueTitle,
  isPhraseTitle,
  isVocabularyTitle,
  parseTeacherBlockLines,
  parseTeacherMessageBlocks,
  type TeacherBodyLine,
  type TeacherSectionIcon,
} from '@/utils/teacher-message-sections';

export type TeacherExampleCategory = 'grammar' | 'vocabulary' | 'phrases' | 'dialogue' | 'examples';

export type TeacherExampleItem = {
  id: string;
  text: string;
  subtext?: string;
  kind: TeacherBodyLine['kind'];
};

export type TeacherExampleGroup = {
  category: TeacherExampleCategory;
  icon: TeacherSectionIcon;
  title: string;
  items: TeacherExampleItem[];
};

const PRACTICE_TITLE = /практика|practice|练习/i;
const SIMPLE_LANGUAGE_TITLE = /объясняю\s+простым\s+языком|простым\s+языком|in\s+plain\s+english|简单说明/i;
const EXAMPLES_TITLE = /пример|когда использу|употреблен|example/i;
const CORRECTION_TITLE = /исправ|как лучше|почему|ошибк|вариант|correct/i;
const THEORY_TITLE = /определ|правил|образован|структур|форм|rule|definition|граммат/i;

function categorizeBlockTitle(title: string): TeacherExampleCategory | null {
  const t = title.trim();
  if (PRACTICE_TITLE.test(t)) return null;
  if (THEORY_TITLE.test(t) || SIMPLE_LANGUAGE_TITLE.test(t) || CORRECTION_TITLE.test(t)) return 'grammar';
  if (isVocabularyTitle(t)) return 'vocabulary';
  if (isPhraseTitle(t)) return 'phrases';
  if (isDialogueTitle(t)) return 'dialogue';
  if (EXAMPLES_TITLE.test(t)) return 'examples';
  return 'examples';
}

function lineToItem(line: TeacherBodyLine, index: number, prefix: string): TeacherExampleItem | null {
  if (line.kind === 'dialogue') {
    return {
      id: `${prefix}-${index}`,
      text: line.text,
      subtext: line.speaker,
      kind: line.kind,
    };
  }
  const text = line.text.trim();
  if (!text) return null;
  return { id: `${prefix}-${index}`, text, kind: line.kind };
}

function itemsFromBody(title: string, body: string, prefix: string): TeacherExampleItem[] {
  const lines = parseTeacherBlockLines(body, {
    dialogue: isDialogueTitle(title),
    phrase: isPhraseTitle(title),
    vocabulary: isVocabularyTitle(title),
  });
  return lines
    .map((line, i) => lineToItem(line, i, prefix))
    .filter((item): item is TeacherExampleItem => item != null);
}

/** Собирает грамматику / лексику / фразы из структурированного ответа учителя. */
export function extractTeacherExamples(text: string, messageId: string): TeacherExampleGroup[] {
  const blocks = parseTeacherMessageBlocks(text);
  const groups: TeacherExampleGroup[] = [];

  if (blocks) {
    blocks.forEach((block, blockIndex) => {
      const category = categorizeBlockTitle(block.title);
      if (!category) return;
      const items = itemsFromBody(block.title, block.body, `${messageId}-${blockIndex}`);
      if (items.length === 0) return;
      groups.push({
        category,
        icon: getTeacherSectionIcon(block.title),
        title: formatTeacherSectionLabel(block.title),
        items,
      });
    });
  }

  if (groups.length === 0) {
    const pairs = extractPairsFromTeacherText(text);
    if (pairs.length > 0) {
      groups.push({
        category: 'vocabulary',
        icon: 'list',
        title: '',
        items: pairs.map((p, i) => ({
          id: `${messageId}-pair-${i}`,
          text: `${p.front} — ${p.back}`,
          kind: 'bullet' as const,
        })),
      });
    }
  }

  return groups;
}

export function countTeacherExamples(text: string, messageId: string): number {
  return extractTeacherExamples(text, messageId).reduce((sum, g) => sum + g.items.length, 0);
}

/** Оценка числа слов для бейджа «Примеры» до загрузки с сервера. */
export function estimateVocabWordCount(text: string): number {
  const blocks = parseTeacherMessageBlocks(text);
  if (blocks) {
    let count = 0;
    for (const block of blocks) {
      if (!isVocabularyTitle(block.title) && !isPhraseTitle(block.title)) continue;
      count += parseTeacherBlockLines(block.body, {
        vocabulary: isVocabularyTitle(block.title),
        phrase: isPhraseTitle(block.title),
      }).length;
    }
    if (count > 0) return Math.min(8, count);
  }
  return Math.min(8, extractPairsFromTeacherText(text).length);
}
