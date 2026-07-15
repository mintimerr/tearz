#!/usr/bin/env python3
"""
Fallback: кроп torso-up из tearz-emote-displeased (тот же 3D Tearz, руки сложены).
У emote рот нейтральный — для ухмылки используй assets/images/tearz-board-chat-avatar.png
(сгенерирован по референсу tearz-teacher-bold-cutout).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/images/tearz-emote-displeased.png"
OUT = ROOT / "assets/images/tearz-board-chat-avatar-from-emote.png"


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 12:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)

    body_w = maxx - minx + 1
    body_h = maxy - miny + 1
    cx = minx + body_w * 0.50
    top = miny
    bottom = miny + int(body_h * 0.62)
    side = bottom - top
    left = max(0, int(cx - side / 2))
    right = min(w, left + side)
    bottom = min(h, top + (right - left))

    crop = im.crop((left, top, right, bottom))
    bg = Image.new("RGBA", crop.size, (255, 255, 255, 255))
    bg.paste(crop, (0, 0), crop)
    out = bg.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, quality=92)
    print(f"→ {OUT}")


if __name__ == "__main__":
    main()
