#!/usr/bin/env python3
"""Покадровые sequence из WebP → assets/board-sprites/sequences/"""
from __future__ import annotations

import json
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "assets/board-sprites/sequences")
TARGET = (391, 520)

CLIPS = {
    "writing-a": "assets/images/tearz-board-write-a.webp",
    "writing-b": "assets/images/tearz-board-write-b.webp",
    "writing-c": "assets/images/tearz-board-write-c.webp",
    "erasing": "assets/images/tearz-board-erase.webp",
}


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    meta: dict = {}
    for key, rel in CLIPS.items():
        path = os.path.join(ROOT, rel)
        im = Image.open(path)
        n = getattr(im, "n_frames", 1)
        d = os.path.join(OUT, key)
        os.makedirs(d, exist_ok=True)
        frames: list[str] = []
        for i in range(n):
            im.seek(i)
            f = im.convert("RGBA")
            if f.size != TARGET:
                f = f.resize(TARGET, Image.Resampling.LANCZOS)
            name = f"f{i:02d}.png"
            f.save(os.path.join(d, name), optimize=True)
            frames.append(name)
        meta[key] = {"count": n, "frames": frames, "w": TARGET[0], "h": TARGET[1]}
        print("OK", key, n)
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"Done → {OUT}")


if __name__ == "__main__":
    main()
