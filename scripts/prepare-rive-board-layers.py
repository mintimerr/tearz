#!/usr/bin/env python3
"""Готовит артборд и подсказки для Rive Editor → assets/rive/layers/"""
from __future__ import annotations

import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "assets/board-concept/tearz-teacher-kling-write-ref-v2.png")
OUT = os.path.join(ROOT, "assets/rive/layers")

ARTBOARD_W = 420
ARTBOARD_H = 580


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size

    # Вписать в артборд, ноги у низа.
    scale = ARTBOARD_W / w
    nh = round(h * scale)
    resized = im.resize((ARTBOARD_W, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (ARTBOARD_W, ARTBOARD_H), (0, 0, 0, 0))
    y = ARTBOARD_H - nh
    canvas.paste(resized, (0, y), resized)
    canvas.save(os.path.join(OUT, "00-artboard-reference.png"))

    # Грубые зоны для ручной обводки (не финальные слои).
    # Персонаж спиной: рука с маркером — левая часть кадра.
    arm_box = (0, int(ARTBOARD_H * 0.22), int(ARTBOARD_W * 0.52), int(ARTBOARD_H * 0.62))
    arm = canvas.crop(arm_box)
    arm.save(os.path.join(OUT, "01-arm-zone-hint.png"))

    body_box = (int(ARTBOARD_W * 0.08), int(ARTBOARD_H * 0.12), ARTBOARD_W, ARTBOARD_H)
    body = canvas.crop(body_box)
    body.save(os.path.join(OUT, "02-body-zone-hint.png"))

    print(f"OK → {OUT}")
    print("  00-artboard-reference.png  — подложка в Rive (opacity 35%)")
    print("  01-arm-zone-hint.png       — зона руки (обведи Pen tool)")
    print("  02-body-zone-hint.png      — зона тела")


if __name__ == "__main__":
    main()
