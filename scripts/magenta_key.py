#!/usr/bin/env python3
"""Magenta chroma key → RGB on black with despill."""
from __future__ import annotations

import math
import sys

from PIL import Image

LO, HI = 72.0, 148.0


def key_magenta(im: Image.Image) -> Image.Image:
    src = im.convert("RGB")
    w, h = src.size
    px = src.load()
    out = Image.new("RGBA", (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            dist = math.sqrt((r - 255) ** 2 + (g - 0) ** 2 + (b - 255) ** 2)
            spill = min(r, b) - g
            if spill > 0:
                r = max(0, r - int(spill * 0.85))
                b = max(0, b - int(spill * 0.85))
            if dist <= LO:
                a = 0
            elif dist >= HI:
                a = 255
            else:
                a = int((dist - LO) / (HI - LO) * 255)
            dst[x, y] = (r, g, b, a)
    flat = Image.new("RGB", (w, h), (0, 0, 0))
    flat.paste(out, mask=out.split()[3])
    return flat


if __name__ == "__main__":
    inp, outp = sys.argv[1], sys.argv[2]
    key_magenta(Image.open(inp)).save(outp)
