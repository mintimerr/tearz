import { VOCAB_LANG_PAIRS, type VocabLangPair } from '@/constants/vocab-reference-decks';
import type { VocabCard, VocabCustomFolder, VocabularyEntry } from '@/contexts/vocabulary-context';
import { entryScriptLang } from '@/utils/detect-word-lang';

export const BUILTIN_FOLDER_EN = 'builtin-en-ru';
export const BUILTIN_FOLDER_ZH = 'builtin-zh-ru';

export type VocabFolderView = {
  id: string;
  name: string;
  subtitle: string;
  isBuiltin: boolean;
  langPairId?: string;
  color: string;
  cardCount: number;
};

const FOLDER_COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF453A', '#64D2FF'];

function folderColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FOLDER_COLORS[h % FOLDER_COLORS.length];
}

export function cardCountLabel(count: number, t: (k: string) => string): string {
  if (count === 1) return `1 ${t('vocabulary.cardOne')}`;
  if (count >= 2 && count <= 4) return `${count} ${t('vocabulary.cardFew')}`;
  return `${count} ${t('vocabulary.cardMany')}`;
}

export function buildFolderViews(
  customFolders: VocabCustomFolder[],
  entries: VocabularyEntry[],
  fallbackTranslation: string,
  t: (k: string) => string,
): VocabFolderView[] {
  const builtins: VocabFolderView[] = VOCAB_LANG_PAIRS.map((pair) => {
    const cards = resolveBuiltinFolderCards(pair.id, entries, fallbackTranslation);
    return {
      id: pair.id === 'zh-ru' ? BUILTIN_FOLDER_ZH : BUILTIN_FOLDER_EN,
      name: pair.chipLabel,
      subtitle: pair.subtitle,
      isBuiltin: true,
      langPairId: pair.id,
      color: pair.id === 'zh-ru' ? '#FF453A' : '#0A84FF',
      cardCount: cards.length,
    };
  });

  const custom: VocabFolderView[] = customFolders.map((f) => ({
    id: f.id,
    name: f.name,
    subtitle: cardCountLabel(f.cards.length, t),
    isBuiltin: false,
    color: folderColor(f.id),
    cardCount: f.cards.length,
  }));

  return [...builtins, ...custom];
}

export function resolveFolderMeta(folderId: string, customFolders: VocabCustomFolder[]): {
  isBuiltin: boolean;
  langPair?: VocabLangPair;
  customFolder?: VocabCustomFolder;
} {
  if (folderId === BUILTIN_FOLDER_EN || folderId === 'en-ru') {
    return { isBuiltin: true, langPair: VOCAB_LANG_PAIRS.find((p) => p.id === 'en-ru') };
  }
  if (folderId === BUILTIN_FOLDER_ZH || folderId === 'zh-ru') {
    return { isBuiltin: true, langPair: VOCAB_LANG_PAIRS.find((p) => p.id === 'zh-ru') };
  }
  const customFolder = customFolders.find((f) => f.id === folderId);
  return { isBuiltin: false, customFolder };
}

export function resolveBuiltinFolderCards(
  langPairId: string,
  entries: VocabularyEntry[],
  fallbackTranslation: string,
): VocabCard[] {
  const pair = VOCAB_LANG_PAIRS.find((p) => p.id === langPairId) ?? VOCAB_LANG_PAIRS[0];
  const user: VocabCard[] = entries
    .filter((e) => {
      const script = entryScriptLang(e);
      return langPairId === 'zh-ru' ? script === 'zh' : script !== 'zh';
    })
    .map((e) => ({
      id: e.id,
      front: e.word,
      back: e.translation?.trim() || fallbackTranslation,
      pinyin: e.pinyin,
      isUser: true,
      addedAt: e.addedAt,
    }));
  const ref: VocabCard[] = pair.cards.map((c) => ({
    id: c.id,
    front: c.front,
    back: c.back,
    pinyin: c.pinyin,
    isUser: false,
    addedAt: 0,
  }));
  return [...user, ...ref];
}

export function resolveFolderCards(
  folderId: string,
  customFolders: VocabCustomFolder[],
  entries: VocabularyEntry[],
  fallbackTranslation: string,
): VocabCard[] {
  const meta = resolveFolderMeta(folderId, customFolders);
  if (meta.isBuiltin && meta.langPair) {
    return resolveBuiltinFolderCards(meta.langPair.id, entries, fallbackTranslation);
  }
  return meta.customFolder?.cards ?? [];
}

export function langPairIdFromBuiltinFolderId(folderId: string): string | null {
  if (folderId === BUILTIN_FOLDER_EN || folderId === 'en-ru') return 'en-ru';
  if (folderId === BUILTIN_FOLDER_ZH || folderId === 'zh-ru') return 'zh-ru';
  return null;
}
