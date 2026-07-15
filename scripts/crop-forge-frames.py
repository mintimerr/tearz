#!/usr/bin/env python3
"""Full-frame chroma key → union crop → scale to width (no letterbox bars)."""
from __future__ import annotations

import glob
import os
import sys

from PIL import Image

from magenta_key import key_magenta

IN_DIR = sys.argv[1]
OUT_DIR = sys.argv[2]
FINAL_OUT = sys.argv[3]
TARGET_W = int(sys.argv[4] if len(sys.argv) > 4 else 400)
PAD = int(sys.argv[5] if len(sys.argv) > 5 else 40)
PAD_BOTTOM = int(sys.argv[6] if len(sys.argv) > 6 else PAD)
MARGIN = float(sys.argv[7] if len(sys.argv) > 7 else 0.86)
SHIFT_X = int(sys.argv[8] if len(sys.argv) > 8 else 0)
BRIGHT = 8


def content_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if sum(px[x, y]) > BRIGHT:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if maxx < minx:
        return 0, 0, w - 1, h - 1
    return minx, miny, maxx, maxy


def content_center_x(im: Image.Image) -> float:
    """Оптический центр по яркости — точнее геометрического bbox."""
    w, h = im.size
    px = im.load()
    sx = 0.0
    weight = 0.0
    for y in range(h):
        for x in range(w):
            b = float(sum(px[x, y]))
            if b > BRIGHT:
                sx += x * b
                weight += b
    if weight <= 0:
        x0, _, x1, _ = content_bbox(im)
        return (x0 + x1) / 2.0
    return sx / weight


def fit_with_margin(rgb: Image.Image, tw: int, anchor_cx: float) -> Image.Image:
    """Масштаб + стабильное центрирование (один anchor на все кадры)."""
    cw = max(1, int(tw * MARGIN))
    nh = max(1, round(rgb.height * cw / rgb.width))
    scaled = rgb.resize((cw, nh), Image.Resampling.LANCZOS)

    scale = cw / rgb.width
    scaled_cx = anchor_cx * scale
    paste_x = int(round(tw / 2 - scaled_cx + SHIFT_X))

    vpad = max(18, int(nh * (1 - MARGIN) / 2))
    ch = nh + 2 * vpad
    canvas = Image.new("RGB", (tw, ch), (0, 0, 0))
    canvas.paste(scaled, (paste_x, vpad))
    return canvas


paths = sorted(glob.glob(os.path.join(IN_DIR, "frame_*.png")))
if not paths:
    raise SystemExit(f"no frames in {IN_DIR}")

os.makedirs(OUT_DIR, exist_ok=True)

flat = [key_magenta(Image.open(p)) for p in paths]

minx, miny, maxx, maxy = flat[0].size[0], flat[0].size[1], 0, 0
for im in flat:
    x0, y0, x1, y1 = content_bbox(im)
    minx = min(minx, x0)
    miny = min(miny, y0)
    maxx = max(maxx, x1)
    maxy = max(maxy, y1)

minx = max(0, minx - PAD)
miny = max(0, miny - PAD)
maxx = min(flat[0].width - 1, maxx + PAD)
maxy = min(flat[0].height - 1, maxy + PAD_BOTTOM)

crop_w = maxx - minx + 1
final_crop = flat[-1].crop((minx, miny, maxx + 1, maxy + 1))
anchor_cx = content_center_x(final_crop)

last = None
target_h = 0
for i, im in enumerate(flat):
    cropped = im.crop((minx, miny, maxx + 1, maxy + 1))
    scaled = fit_with_margin(cropped, TARGET_W, anchor_cx)
    target_h = scaled.height
    last = scaled
    last.save(os.path.join(OUT_DIR, f"frame_{i + 1:04d}.png"))

if last is not None:
    last.save(FINAL_OUT)

meta_path = os.path.join(OUT_DIR, "_canvas.txt")
with open(meta_path, "w", encoding="utf-8") as f:
    f.write(f"{TARGET_W} {target_h}\n")

print(f"frames={len(paths)} canvas={TARGET_W}x{target_h} crop={crop_w}x{maxy-miny+1} anchor_cx={anchor_cx:.1f}")
