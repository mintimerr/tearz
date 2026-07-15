#!/usr/bin/env python3
"""Вырезает только Tearz (cyan + маркер) из кадров write-клипа, фон и доску — прозрачные."""
from __future__ import annotations

import glob
import os
import sys

from PIL import Image

IN_DIR = sys.argv[1]
OUT_DIR = sys.argv[2]
TARGET_H = int(sys.argv[3] if len(sys.argv) > 3 else 520)
PAD = int(sys.argv[4] if len(sys.argv) > 4 else 18)


def is_character_pixel(r: int, g: int, b: int) -> bool:
    """Cyan-тело Tearz + чёрный/тёмный маркер (#152238) + legacy orange."""
    if g > 110 and b > 110 and g > r + 25 and b > r + 15:
        return True
    if r < 55 and g < 70 and b < 95 and b >= r and r + g + b < 180:
        return True
    if r > 160 and g > 70 and g < 200 and b < 120:
        return True
    if r > 90 and g > 90 and b > 90 and r + g + b < 620:
        return False
    return False


def is_background_pixel(r: int, g: int, b: int) -> bool:
    if r > 215 and g > 215 and b > 215:
        return True
    if abs(r - g) < 12 and abs(g - b) < 12 and r > 190:
        return True
    return False


def character_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3] if len(px[x, y]) == 4 else px[x, y]
            if is_character_pixel(r, g, b):
                found = True
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if not found:
        return None
    return minx, miny, maxx, maxy


def cut_character(im: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    x0, y0, x1, y1 = box
    cropped = im.crop((x0, y0, x1 + 1, y1 + 1)).convert("RGBA")
    w, h = cropped.size
    px = cropped.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_character_pixel(r, g, b):
                continue
            if is_background_pixel(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (r, g, b, 0)
    return cropped


paths = sorted(glob.glob(os.path.join(IN_DIR, "frame_*.png")))
if not paths:
    raise SystemExit(f"no frames in {IN_DIR}")

os.makedirs(OUT_DIR, exist_ok=True)

boxes: list[tuple[int, int, int, int]] = []
images = [Image.open(p).convert("RGB") for p in paths]

for im in images:
    box = character_bbox(im)
    if box:
        boxes.append(box)

if not boxes:
    raise SystemExit("no cyan character found in frames")

# Стабильный union bbox по всем кадрам
minx = min(b[0] for b in boxes) - PAD
miny = min(b[1] for b in boxes) - PAD
maxx = max(b[2] for b in boxes) + PAD
maxy = max(b[3] for b in boxes) + PAD
minx = max(0, minx)
miny = max(0, miny)
maxx = min(images[0].width - 1, maxx)
maxy = min(images[0].height - 1, maxy)
stable = (minx, miny, maxx, maxy)

cuts = [cut_character(im, stable) for im in images]
cw = max(1, maxx - minx + 1)
ch = max(1, maxy - miny + 1)
scale = TARGET_H / ch
tw = max(1, round(cw * scale))
th = TARGET_H

target_w = 0
for i, cut in enumerate(cuts):
    out = cut.resize((tw, th), Image.Resampling.LANCZOS)
    target_w = out.width
    out.save(os.path.join(OUT_DIR, f"frame_{i + 1:04d}.png"))

with open(os.path.join(OUT_DIR, "_canvas.txt"), "w", encoding="utf-8") as f:
    f.write(f"{target_w} {th}\n")

print(f"frames={len(paths)} canvas={target_w}x{th} bbox={stable}")
