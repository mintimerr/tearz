#!/usr/bin/env python3
"""Кроп по контенту + стабильный масштаб (убираем зум камеры и водяной знак)."""
from __future__ import annotations

import glob
import os
import sys

from PIL import Image

IN_DIR = sys.argv[1]
OUT_DIR = sys.argv[2]
TARGET_W = int(sys.argv[3] if len(sys.argv) > 3 else 360)
PAD = int(sys.argv[4] if len(sys.argv) > 4 else 24)
PAD_BOTTOM = int(sys.argv[5] if len(sys.argv) > 5 else 32)
MARGIN = float(sys.argv[6] if len(sys.argv) > 6 else 0.92)
BRIGHT = 22


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


def scrub_watermark(im: Image.Image) -> Image.Image:
    out = im.copy()
    w, h = out.size
    px = out.load()
    x0 = max(0, w - int(w * 0.18))
    y0 = max(0, h - int(h * 0.08))
    for y in range(y0, h):
        for x in range(x0, w):
            r, g, b = px[x, y]
            if r + g + b < 200:
                px[x, y] = (0, 0, 0)
    return out


def fit_stable(rgb: Image.Image, tw: int, target_body_w: float) -> Image.Image:
    """Масштаб по ширине тела — компенсирует зум камеры."""
    x0, y0, x1, y1 = content_bbox(rgb)
    body_w = max(1, x1 - x0 + 1)
    scale = target_body_w / body_w

    nw = max(1, round(rgb.width * scale))
    nh = max(1, round(rgb.height * scale))
    scaled = rgb.resize((nw, nh), Image.Resampling.LANCZOS)

    x0, y0, x1, y1 = content_bbox(scaled)
    body_cx = (x0 + x1) / 2.0
    scaled_cx = body_cx

    cw = max(1, int(tw * MARGIN))
    # подгоняем ещё раз под целевую ширину холста
    if x1 - x0 + 1 > cw:
        s2 = cw / (x1 - x0 + 1)
        nw2 = max(1, round(scaled.width * s2))
        nh2 = max(1, round(scaled.height * s2))
        scaled = scaled.resize((nw2, nh2), Image.Resampling.LANCZOS)
        x0, y0, x1, y1 = content_bbox(scaled)
        scaled_cx = (x0 + x1) / 2.0

    vpad = max(10, int((x1 - x0 + 1) * 0.06))
    ch = (y1 - y0 + 1) + 2 * vpad
    canvas = Image.new("RGB", (tw, ch), (0, 0, 0))
    paste_x = int(round(tw / 2 - scaled_cx))
    paste_y = vpad - y0
    canvas.paste(scaled, (paste_x, paste_y))
    return canvas


paths = sorted(glob.glob(os.path.join(IN_DIR, "frame_*.png")))
if not paths:
    raise SystemExit(f"no frames in {IN_DIR}")

os.makedirs(OUT_DIR, exist_ok=True)

flat = [scrub_watermark(Image.open(p)) for p in paths]

minx, miny, maxx, maxy = flat[0].size[0], flat[0].size[1], 0, 0
body_widths = []
for im in flat:
    x0, y0, x1, y1 = content_bbox(im)
    minx = min(minx, x0)
    miny = min(miny, y0)
    maxx = max(maxx, x1)
    maxy = max(maxy, y1)
    body_widths.append(x1 - x0 + 1)

minx = max(0, minx - PAD)
miny = max(0, miny - PAD)
maxx = min(flat[0].width - 1, maxx + PAD)
maxy = min(flat[0].height - 1, maxy + PAD_BOTTOM)

# медианная ширина тела — стабильный масштаб без зума
body_widths.sort()
target_body_w = body_widths[len(body_widths) // 2] * (TARGET_W * MARGIN) / max(1, maxx - minx + 1)

target_h = 0
for i, im in enumerate(flat):
    cropped = im.crop((minx, miny, maxx + 1, maxy + 1))
    out = fit_stable(cropped, TARGET_W, target_body_w)
    target_h = out.height
    out.save(os.path.join(OUT_DIR, f"frame_{i + 1:04d}.png"))

with open(os.path.join(OUT_DIR, "_canvas.txt"), "w", encoding="utf-8") as f:
    f.write(f"{TARGET_W} {target_h}\n")

print(f"frames={len(paths)} canvas={TARGET_W}x{target_h} body_w={target_body_w:.1f}")
