/** Оценка позиции курсора маркера на доске (px в write-зоне). */
export function estimateBoardInkCursor(
  text: string,
  cursor: number,
  contentWidth: number,
  lineHeight: number,
  fontSize = 28,
) {
  const charW = fontSize * 0.42;
  const maxChars = Math.max(1, Math.floor(contentWidth / charW));
  const head = text.slice(0, Math.max(0, cursor));
  const parts = head.split('\n');

  let y = 0;
  let x = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? '';
    if (i < parts.length - 1) {
      const wraps = Math.max(1, Math.ceil(part.length / maxChars) || 1);
      y += wraps * lineHeight;
    } else {
      const wrapRow = part.length === 0 ? 0 : Math.floor((part.length - 1) / maxChars);
      y += wrapRow * lineHeight;
      const colOnRow = part.length % maxChars;
      x = (colOnRow === 0 && part.length > 0 ? maxChars : colOnRow) * charW;
    }
  }

  return { x, y, charW, lineHeight };
}

export function boardInkProgress(x: number, contentWidth: number) {
  if (contentWidth <= 0) return 0;
  return Math.min(1, Math.max(0, x / contentWidth));
}
