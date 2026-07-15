/** Аспект HQ-спрайта Tearz у доски (782×1040 @2×). */
export const BOARD_SPRITE_ASPECT = 782 / 1040;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Tearz у рамы доски — крупно, полный рост, ноги у низа кадра.
 */
export function boardTearzAtBoard(
  imgLeft: number,
  imgTop: number,
  imgW: number,
  imgH: number,
  lineProgress: number,
) {
  const h = Math.round(imgH * 0.9);
  const w = Math.round(h * BOARD_SPRITE_ASPECT);
  const left = Math.round(imgLeft + imgW - w + Math.round(w * 0.02));
  const baseTop = imgTop + imgH - h + Math.round(imgH * 0.01);
  const lift = Math.round(lineProgress * imgH * 0.08);
  const top = clamp(Math.round(baseTop - lift), imgTop, baseTop);

  return { left, top, w, h };
}

/** @deprecated */
export const WRITE_CLIP_ASPECT = BOARD_SPRITE_ASPECT;
export const WRITE_CLIP_PLAY_MS = 210;
