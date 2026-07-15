export type TeacherMessageBlock = {
  title: string;
  body: string;
};

export type TeacherBodyLine =
  | { kind: 'para'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'phrase'; text: string }
  | { kind: 'dialogue'; speaker: string; text: string };

const BULLET_RE = /^[-–—•*·]\s+/;
const DIALOGUE_RE = /^([\p{L}\p{M}]{1,16})\s*[:：]\s*(.+)$/u;

/** Убирает markdown-артефакты, которые модель иногда добавляет вопреки инструкции. */
export function cleanTeacherInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .trim();
}

/**
 * Разбивает тело блока на смысловые строки для премиального рендера:
 * фразы-примеры по одной в строку, диалоги как скрипт, списки и абзацы.
 */
export function parseTeacherBlockLines(
  body: string,
  opts: { dialogue?: boolean; phrase?: boolean } = {},
): TeacherBodyLine[] {
  const out: TeacherBodyLine[] = [];
  const rawLines = body.split('\n');

  for (const raw of rawLines) {
    const line = cleanTeacherInline(raw);
    if (!line) continue;

    const bulletMatch = line.match(BULLET_RE);
    const unbulleted = bulletMatch ? line.replace(BULLET_RE, '').trim() : line;

    if (opts.dialogue) {
      const d = unbulleted.match(DIALOGUE_RE);
      if (d && d[2].trim()) {
        out.push({ kind: 'dialogue', speaker: d[1].trim(), text: d[2].trim() });
        continue;
      }
    }

    // Модель разделяет несколько фраз через « / » — показываем каждую отдельной строкой.
    if (unbulleted.includes(' / ')) {
      const parts = unbulleted
        .split(' / ')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        for (const p of parts) out.push({ kind: 'phrase', text: p });
        continue;
      }
    }

    if (bulletMatch) {
      out.push({ kind: 'bullet', text: unbulleted });
      continue;
    }

    if (opts.phrase) {
      out.push({ kind: 'phrase', text: unbulleted });
      continue;
    }

    out.push({ kind: 'para', text: unbulleted });
  }

  return out;
}

const SIMPLE_LANGUAGE_TITLE = /объясняю простым языком/i;
const DIALOGUE_TITLE = /диалог|dialogue|对话/i;
const PHRASE_TITLE = /фраз|phrase|短语|例句/i;

const TITLE_LINE = /^([^\n:]{2,48}):\s*(.*)$/;

function isValidSectionTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < 2 || t.length > 48) return false;
  if (t.split(/\s+/).length > 6) return false;
  if (/[.!?]$/.test(t)) return false;
  return true;
}

function isSimpleLanguageTitle(title: string): boolean {
  return SIMPLE_LANGUAGE_TITLE.test(title);
}

function pushBlock(blocks: TeacherMessageBlock[], title: string, bodyLines: string[]) {
  const body = bodyLines.join('\n').trim();
  if (!isValidSectionTitle(title) || !body) return false;
  blocks.push({ title: title.trim(), body });
  return true;
}

function parseStrictBlocks(trimmed: string): TeacherMessageBlock[] | null {
  const chunks = trimmed.split(/\n\n+/);
  const blocks: TeacherMessageBlock[] = [];

  for (const chunk of chunks) {
    const normalized = chunk.trim();
    if (!normalized) continue;

    const sameLine = normalized.match(TITLE_LINE);
    if (sameLine && sameLine[2].trim()) {
      if (!pushBlock(blocks, sameLine[1], [sameLine[2]])) return null;
      continue;
    }

    const multiLine = normalized.match(/^([^\n:]{2,48}):\s*\n([\s\S]+)$/);
    if (!multiLine) return null;

    if (!pushBlock(blocks, multiLine[1], multiLine[2].split('\n'))) return null;
  }

  return blocks.length > 0 ? blocks : null;
}

/** Fallback when the model skips blank lines between sections or adds an extra line after titles. */
function parseLenientBlocks(trimmed: string): TeacherMessageBlock[] | null {
  const lines = trimmed.split('\n');
  const blocks: TeacherMessageBlock[] = [];
  let title: string | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    if (!title) return;
    pushBlock(blocks, title, bodyLines);
    title = null;
    bodyLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const titleMatch = line.match(TITLE_LINE);

    if (titleMatch && isValidSectionTitle(titleMatch[1].trim())) {
      flush();
      title = titleMatch[1].trim();
      const inline = titleMatch[2].trim();
      bodyLines = inline ? [inline] : [];
      continue;
    }

    if (title) {
      if (line.trim() === '' && bodyLines.length === 0) continue;
      bodyLines.push(rawLine);
    }
  }

  flush();
  return blocks.length > 0 ? blocks : null;
}

export function formatTeacherSectionLabel(title: string): string {
  if (isSimpleLanguageTitle(title)) return 'Простым языком';
  const t = title.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function isDialogueTitle(title: string): boolean {
  return DIALOGUE_TITLE.test(title.trim());
}

export function isPhraseTitle(title: string): boolean {
  return PHRASE_TITLE.test(title.trim());
}

const PRACTICE_TITLE = /практика|practice|练习/i;
const EXAMPLES_TITLE = /пример|когда использу|употреблен|example/i;
const CORRECTION_TITLE = /исправ|как лучше|почему|ошибк|вариант|correct/i;
const THEORY_TITLE = /определ|правил|образован|структур|форм|rule|definition/i;

export type TeacherSectionIcon =
  | 'bulb'
  | 'language'
  | 'people'
  | 'barbell'
  | 'list'
  | 'checkmark-done'
  | 'book'
  | 'sparkles';

/** Иконка секции (один фирменный акцент — без «радуги»). */
export function getTeacherSectionIcon(title: string): TeacherSectionIcon {
  const t = title.trim();
  if (SIMPLE_LANGUAGE_TITLE.test(t)) return 'bulb';
  if (PHRASE_TITLE.test(t)) return 'language';
  if (DIALOGUE_TITLE.test(t)) return 'people';
  if (PRACTICE_TITLE.test(t)) return 'barbell';
  if (CORRECTION_TITLE.test(t)) return 'checkmark-done';
  if (THEORY_TITLE.test(t)) return 'book';
  if (EXAMPLES_TITLE.test(t)) return 'list';
  return 'sparkles';
}

/**
 * Parses teacher replies split into titled blocks.
 * Returns null if the text is unstructured — caller shows plain text.
 */
export function parseTeacherMessageBlocks(text: string): TeacherMessageBlock[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const strict = parseStrictBlocks(trimmed);
  if (strict) return strict;

  return parseLenientBlocks(trimmed);
}
