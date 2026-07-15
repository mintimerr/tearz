#!/usr/bin/env python3
"""Kling write-референс из нашего Tearz: спина, без доски, чёрный маркер."""
from __future__ import annotations

import os
import sys
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/board-concept/tearz-teacher-write-back-ref.png")
OUT = os.path.join(ROOT, "assets/board-concept/tearz-teacher-kling-write-ref-v2.png")

CANVAS_W = 1536
CANVAS_H = 2048
PAD = 24
MARKER_RGB = (21, 34, 56)
REF_CYAN = (4, 195, 215)


def is_core_cyan(r: int, g: int, b: int) -> bool:
    return g > 95 and b > 95 and g > r + 18 and b > r + 10 and r < 170


def is_orange_marker(r: int, g: int, b: int) -> bool:
    return r > 150 and g > 55 and g < 210 and b < 130 and r > g


def is_neutral_gray(r: int, g: int, b: int) -> bool:
    return abs(r - g) < 12 and abs(g - b) < 12 and 120 < r < 220


def is_white_bg(r: int, g: int, b: int) -> bool:
    return r > 215 and g > 215 and b > 215


def character_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            if is_core_cyan(r, g, b) or is_orange_marker(r, g, b):
                found = True
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if not found:
        raise SystemExit("Tearz not found in source")
    return (
        max(0, minx - PAD),
        max(0, miny - PAD),
        min(w - 1, maxx + PAD),
        min(h - 1, maxy + PAD),
    )


def fill_interior_holes(mask: list[list[bool]]) -> None:
    h = len(mask)
    w = len(mask[0])
    outside: set[tuple[int, int]] = set()
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        if not mask[0][x]:
            q.append((x, 0))
        if not mask[h - 1][x]:
            q.append((x, h - 1))
    for y in range(h):
        if not mask[y][0]:
            q.append((0, y))
        if not mask[y][w - 1]:
            q.append((w - 1, y))

    while q:
        x, y = q.popleft()
        if (x, y) in outside or mask[y][x]:
            continue
        outside.add((x, y))
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not mask[ny][nx]:
                q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if not mask[y][x] and (x, y) not in outside:
                mask[y][x] = True


def dilate(mask: list[list[bool]], r: int = 1) -> list[list[bool]]:
    h = len(mask)
    w = len(mask[0])
    out = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if not mask[y][x]:
                continue
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w:
                        out[ny][nx] = True
    return out


def keep_largest_component(mask: list[list[bool]]) -> list[list[bool]]:
    h = len(mask)
    w = len(mask[0])
    seen = [[False] * w for _ in range(h)]
    best: list[tuple[int, int]] = []

    for sy in range(h):
        for sx in range(w):
            if not mask[sy][sx] or seen[sy][sx]:
                continue
            q: deque[tuple[int, int]] = deque([(sx, sy)])
            seen[sy][sx] = True
            comp: list[tuple[int, int]] = []
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            if len(comp) > len(best):
                best = comp

    out = [[False] * w for _ in range(h)]
    for x, y in best:
        out[y][x] = True
    return out


def nearest_cyan(spx, w: int, h: int, sx: int, sy: int, max_r: int = 12) -> tuple[int, int, int]:
    for rad in range(1, max_r + 1):
        for dy in range(-rad, rad + 1):
            for dx in range(-rad, rad + 1):
                if abs(dx) != rad and abs(dy) != rad:
                    continue
                nx, ny = sx + dx, sy + dy
                if 0 <= nx < w and 0 <= ny < h:
                    r, g, b = spx[nx, ny]
                    if is_core_cyan(r, g, b):
                        return r, g, b
    return REF_CYAN


def cut_character(im: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    x0, y0, x1, y1 = box
    cropped = im.crop((x0, y0, x1 + 1, y1 + 1)).convert("RGB")
    w, h = cropped.size
    spx = cropped.load()

    core = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b = spx[x, y]
            core[y][x] = is_core_cyan(r, g, b) or is_orange_marker(r, g, b)

    fill_interior_holes(core)
    mask = dilate(core, 2)
    mask = keep_largest_component(mask)

    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            if not mask[y][x]:
                continue
            r, g, b = spx[x, y]
            if is_orange_marker(r, g, b):
                opx[x, y] = (*MARKER_RGB, 255)
            elif is_white_bg(r, g, b) or is_neutral_gray(r, g, b):
                nr, ng, nb = nearest_cyan(spx, w, h, x, y)
                opx[x, y] = (nr, ng, nb, 255)
            elif not core[y][x]:
                # залитая «дырка» — цвет от соседнего cyan
                nr, ng, nb = nearest_cyan(spx, w, h, x, y)
                opx[x, y] = (nr, ng, nb, 255)
            else:
                opx[x, y] = (r, g, b, 255)

    return out


def compose(cut: Image.Image) -> Image.Image:
    cw, ch = cut.size
    target_h = int(CANVAS_H * 0.78)
    scale = target_h / ch
    target_w = max(1, round(cw * scale))
    resized = cut.resize((target_w, target_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), (255, 255, 255))
    x = (CANVAS_W - target_w) // 2
    y = CANVAS_H - target_h - int(CANVAS_H * 0.04)
    canvas.paste(resized, (x, y), resized)
    return canvas


def main() -> None:
    src = sys.argv[1] if len(sys.argv) > 1 else SRC
    out = sys.argv[2] if len(sys.argv) > 2 else OUT
    im = Image.open(src).convert("RGB")
    box = character_bbox(im)
    cut = cut_character(im, box)
    ref = compose(cut)
    ref.save(out, format="PNG", compress_level=1)
    print(f"saved {out} bbox={box} size={ref.size}")


if __name__ == "__main__":
    main()
