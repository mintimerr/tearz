import { stripPlacementPromptDecorations } from '@/utils/placement-seen';

export type PlacementPromptParts = {
  /** Reading / scenario material, if separable from the ask. */
  passage: string | null;
  /** The actual question or cloze stem shown to the learner. */
  ask: string;
};

/**
 * Split placement stems into passage + ask when the bank packs both in one string
 * (reading cards, functional prompts). Cloze blanks stay as a single ask block.
 */
export function splitPlacementPromptForDisplay(raw: string): PlacementPromptParts {
  const prompt = stripPlacementPromptDecorations(raw).trim();
  if (!prompt) return { passage: null, ask: '' };

  // Grammar / vocab blanks — keep one visual block.
  if (/_{2,}|＿{2,}/.test(prompt)) {
    return { passage: null, ask: prompt };
  }

  const quoteSplit =
    prompt.match(/^(.*?[「『].+[」』])\s*(.+[?？])\s*$/s) ??
    prompt.match(/^(.*?(?:"[^"]+"|'[^']+'|“[^”]+”))\s*(.+[?？])\s*$/s) ??
    prompt.match(/^(.*?(?:Brief|Sign|Card|Note|Memo|Email|告示|站牌|卡片|便条)\s*[:：].+)\s*(.+[?？])\s*$/is);

  if (quoteSplit) {
    const passage = quoteSplit[1].trim();
    const ask = quoteSplit[2].trim();
    if (passage.length >= 8 && ask.length >= 2 && ask.length <= 72) {
      return { passage, ask };
    }
  }

  // Scenario sentences + short trailing ask ("你说？" / "What do you say?").
  const trailingAsk = prompt.match(/^(.+[.。!！…])\s*([^.。!！?\n]{1,40}[?？])\s*$/s);
  if (trailingAsk) {
    const passage = trailingAsk[1].trim();
    const ask = trailingAsk[2].trim();
    if (passage.length >= 12 && ask.length >= 2) {
      return { passage, ask };
    }
  }

  return { passage: null, ask: prompt };
}

/** Split cloze stem into text / blank runs for highlighted underline chips. */
export function splitClozeRuns(ask: string): Array<{ type: 'text' | 'blank'; value: string }> {
  const runs: Array<{ type: 'text' | 'blank'; value: string }> = [];
  const re = /(_{2,}|＿{2,})/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ask)) !== null) {
    if (m.index > last) {
      runs.push({ type: 'text', value: ask.slice(last, m.index) });
    }
    runs.push({ type: 'blank', value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < ask.length) runs.push({ type: 'text', value: ask.slice(last) });
  if (runs.length === 0) runs.push({ type: 'text', value: ask });
  return runs;
}
