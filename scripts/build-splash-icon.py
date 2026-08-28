#!/usr/bin/env python3
"""Build opaque Tearz splash with clean edges (no white halos)."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path('/Users/mitya/.cursor/projects/Users-mitya-cortex-mobile/assets/tearz-splash-idea-v2.png')
OUT = ROOT / 'assets/images/splash-icon.png'
IOS_DIR = ROOT / 'ios/Tearz/Images.xcassets/SplashScreenLogo.imageset'

NAVY = (11, 20, 48)


def is_mag(r: int, g: int, b: int, a: int) -> bool:
    return a < 8 or (r > 180 and b > 160 and g < 130)


def is_cyan(r: int, g: int, b: int) -> bool:
    return g > 140 and b > 150 and g > r + 35


def is_yellow(r: int, g: int, b: int) -> bool:
    return r > 200 and g > 180 and b < 140


def is_white(r: int, g: int, b: int) -> bool:
    return r > 215 and g > 215 and b > 215


def neighbors(lpx, w, h, x, y, radius=2):
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                yield nx, ny


def main() -> None:
    src = Image.open(SRC).convert('RGBA')
    w, h = src.size
    px = src.load()

    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    lpx = layer.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_mag(r, g, b, a):
                continue
            lpx[x, y] = (r, g, b, 255)

    # Remove white / light fringe pixels hugging the sprite silhouette.
    for _ in range(6):
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                r, g, b, a = lpx[x, y]
                if a < 10:
                    continue
                # Near-white or light cyan fringe from bad chroma key.
                light_fringe = is_white(r, g, b) or (r > 190 and g > 190 and b > 190)
                if not light_fringe:
                    continue
                near_yellow = any(
                    is_yellow(*lpx[nx, ny][:3])
                    for nx, ny in neighbors(lpx, w, h, x, y, 4)
                    if lpx[nx, ny][3] > 0
                )
                if near_yellow:
                    continue
                cyans = [
                    lpx[nx, ny][:3]
                    for nx, ny in neighbors(lpx, w, h, x, y, 3)
                    if lpx[nx, ny][3] > 0 and is_cyan(*lpx[nx, ny][:3])
                ]
                if cyans:
                    cr = sum(c[0] for c in cyans) // len(cyans)
                    cg = sum(c[1] for c in cyans) // len(cyans)
                    cb = sum(c[2] for c in cyans) // len(cyans)
                    lpx[x, y] = (cr, cg, cb, 255)
                else:
                    lpx[x, y] = (0, 0, 0, 0)

    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if lpx[x, y][3] > 0:
                xs.append(x)
                ys.append(y)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cw, ch = x1 - x0, y1 - y0
    band_y0 = y0 + int(ch * 0.31)
    band_y1 = y0 + int(ch * 0.41)

    visited: set[tuple[int, int]] = set()
    blobs: list[list[tuple[int, int]]] = []
    for y in range(band_y0, band_y1):
        for x in range(x0 + int(cw * 0.22), x0 + int(cw * 0.78)):
            if (x, y) in visited:
                continue
            r, g, b, a = lpx[x, y]
            if a < 10 or not (r < 55 and g < 75 and b < 125):
                continue
            q = deque([(x, y)])
            visited.add((x, y))
            pts: list[tuple[int, int]] = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if (nx, ny) in visited:
                        continue
                    if not (0 <= nx < w and band_y0 <= ny < band_y1):
                        continue
                    nr, ng, nb, na = lpx[nx, ny]
                    if na > 10 and nr < 55 and ng < 75 and nb < 125:
                        visited.add((nx, ny))
                        q.append((nx, ny))
            if 150 <= len(pts) <= 2500:
                blobs.append(pts)

    blobs.sort(key=len, reverse=True)
    eyes: list[list[tuple[int, int]]] = []
    for b in blobs:
        cx = sum(p[0] for p in b) / len(b)
        if all(abs(cx - sum(p[0] for p in e) / len(e)) > 55 for e in eyes):
            eyes.append(b)
        if len(eyes) == 2:
            break

    for b in eyes:
        bx = [p[0] for p in b]
        by = [p[1] for p in b]
        bx0, by0, bx1, by1 = min(bx), min(by), max(bx), max(by)
        ecx = sum(bx) / len(b)
        ecy = sum(by) / len(b)
        pad_x = int((bx1 - bx0) * 0.38) + 4
        pad_y = int((by1 - by0) * 0.38) + 4
        ex0, ey0, ex1, ey1 = bx0 - pad_x, by0 - pad_y, bx1 + pad_x, by1 + pad_y
        for y in range(max(0, ey0), min(h, ey1 + 1)):
            for x in range(max(0, ex0), min(w, ex1 + 1)):
                r, g, b, a = lpx[x, y]
                if a < 10 or is_cyan(r, g, b) or is_yellow(r, g, b):
                    continue
                if (r + g + b < 340) or is_white(r, g, b):
                    lpx[x, y] = (0, 0, 0, 255)
        for hx, hy, s in [
            (int(ecx - 7), int(ecy - 9), 3),
            (int(ecx - 3), int(ecy - 3), 2),
            (int(ecx + 6), int(ecy + 5), 1),
        ]:
            for dy in range(s):
                for dx in range(s):
                    x, y = hx + dx, hy + dy
                    if 0 <= x < w and 0 <= y < h and sum(lpx[x, y][:3]) < 50:
                        lpx[x, y] = (255, 255, 255, 255)

    bbox = layer.getbbox()
    assert bbox is not None
    cropped = layer.crop(bbox)
    pcw, pch = cropped.size
    pad = 24
    padded = Image.new('RGBA', (pcw + pad * 2, pch + pad * 2), (0, 0, 0, 0))
    padded.paste(cropped, (pad, pad), cropped)
    pcw, pch = padded.size
    scale = min(760 / pcw, 760 / pch)
    nw, nh = int(pcw * scale), int(pch * scale)
    resized = padded.resize((nw, nh), Image.Resampling.NEAREST)

    canvas = Image.new('RGB', (1024, 1024), NAVY)
    char = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    char.paste(resized, ((1024 - nw) // 2, (1024 - nh) // 2 + 2), resized)
    canvas.paste(char, (0, 0), char)

    cp = canvas.load()
    for y in range(1024):
        for x in range(1024):
            r, g, b = cp[x, y]
            if not (r > 210 and g > 210 and b > 210):
                continue
            keep = False
            for nx, ny in neighbors(cp, 1024, 1024, x, y, 3):
                nr, ng, nb = cp[nx, ny]
                if nr > 200 and ng > 170 and nb < 150:
                    keep = True
                if nr + ng + nb < 40:
                    keep = True
            if not keep:
                cp[x, y] = NAVY

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, optimize=True)

    IOS_DIR.mkdir(parents=True, exist_ok=True)
    for name, side in [('image.png', 300), ('image@2x.png', 600), ('image@3x.png', 900)]:
        canvas.resize((side, side), Image.Resampling.NEAREST).save(IOS_DIR / name, optimize=True)

    white = sum(1 for y in range(1024) for x in range(1024) if all(v > 210 for v in cp[x, y]))
    print(f'splash saved, stray white pixels: {white}')


if __name__ == '__main__':
    main()
