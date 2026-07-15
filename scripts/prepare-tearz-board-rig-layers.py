#!/usr/bin/env python3
"""Готовит cutout-слои Tearz Board Rig → assets/board-rig/"""
from __future__ import annotations

import json
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "assets/board-concept/tearz-board-write-idle.png")
OUT = os.path.join(ROOT, "assets/board-rig")

ARM_BOX_NORM = (0.00, 0.18, 0.58, 0.68)
PIVOT_NORM = (0.42, 0.30)

CLIPS = {
    "stroke-a": ("assets/images/tearz-board-write-a.webp", 2),
    "stroke-b": ("assets/images/tearz-board-write-b.webp", 3),
    "stroke-c": ("assets/images/tearz-board-write-c.webp", 3),
    "erase": ("assets/images/tearz-board-erase.webp", 2),
}


def box_px(w: int, h: int, b: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return int(b[0] * w), int(b[1] * h), int(b[2] * w), int(b[3] * h)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    ax0, ay0, ax1, ay1 = box_px(w, h, ARM_BOX_NORM)
    px, py = int(PIVOT_NORM[0] * w), int(PIVOT_NORM[1] * h)

    arm = im.crop((ax0, ay0, ax1, ay1))
    body = im.copy()
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle((ax0, ay0, ax1, ay1), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=3))
    body_px = body.load()
    mask_px = mask.load()
    for y in range(h):
        for x in range(w):
            if mask_px[x, y] > 8:
                r, g, b, a = body_px[x, y]
                body_px[x, y] = (r, g, b, int(a * (1 - mask_px[x, y] / 255)))

    im.save(os.path.join(OUT, "00-reference.png"))
    body.save(os.path.join(OUT, "body.png"))
    arm.save(os.path.join(OUT, "arm-idle.png"))

    manifest = {
        "source": "assets/board-concept/tearz-board-write-idle.png",
        "width": w,
        "height": h,
        "armBox": {"x": ax0, "y": ay0, "w": ax1 - ax0, "h": ay1 - ay0},
        "pivot": {"x": px, "y": py},
        "armOrigin": {"x": px - ax0, "y": py - ay0},
    }

    for key, (rel, frame_idx) in CLIPS.items():
        path = os.path.join(ROOT, rel)
        clip = Image.open(path)
        clip.seek(min(frame_idx, getattr(clip, "n_frames", 1) - 1))
        frame = clip.convert("RGBA")
        if frame.size != (w, h):
            frame = frame.resize((w, h), Image.Resampling.LANCZOS)
        pose = frame.crop((ax0, ay0, ax1, ay1))
        pose.save(os.path.join(OUT, f"arm-{key}.png"))

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"OK → {OUT}")


if __name__ == "__main__":
    main()
