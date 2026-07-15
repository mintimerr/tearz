#!/usr/bin/env python3
from __future__ import annotations

import sys

from PIL import Image

from magenta_key import key_magenta

SRC = sys.argv[1]
OUT = sys.argv[2]
TARGET_W = int(sys.argv[3] if len(sys.argv) > 3 else 360)
TARGET_H = int(sys.argv[4] if len(sys.argv) > 4 else 360)
FILL = float(sys.argv[5] if len(sys.argv) > 5 else 0.88)
BRIGHT = 24

im = key_magenta(Image.open(SRC))
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

pad = 12
minx = max(0, minx - pad)
miny = max(0, miny - pad)
maxx = min(w - 1, maxx + pad)
maxy = min(h - 1, maxy + pad)
im = im.crop((minx, miny, maxx + 1, maxy + 1))

max_w = int(TARGET_W * FILL)
max_h = int(TARGET_H * FILL)
scale = min(max_w / im.width, max_h / im.height)
nw = max(1, round(im.width * scale))
nh = max(1, round(im.height * scale))
scaled = im.resize((nw, nh), Image.Resampling.LANCZOS)
canvas = Image.new("RGB", (TARGET_W, TARGET_H), (0, 0, 0))
canvas.paste(scaled, ((TARGET_W - nw) // 2, (TARGET_H - nh) // 2))
canvas.save(OUT)
print("saved", OUT, canvas.size)
