#!/usr/bin/env python3
"""Копирует референсы Tearz для импорта в Rive Editor → assets/rive/refs/"""
from __future__ import annotations

import os
import shutil

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "assets/rive/refs")

REFS = [
    ("assets/board-concept/tearz-teacher-kling-write-ref-v2.png", "01-tearz-write-back-main.png"),
    ("assets/board-concept/tearz-teacher-bold-cutout.png", "02-tearz-front-proportions.png"),
    ("assets/board-concept/tearz-board-write-idle.png", "03-tearz-write-idle-frame0.png"),
    ("assets/board-concept/tearz-teacher-bold-only.png", "04-tearz-front-bold.png"),
]

os.makedirs(OUT, exist_ok=True)

for src_rel, dst_name in REFS:
    src = os.path.join(ROOT, src_rel)
    dst = os.path.join(OUT, dst_name)
    if not os.path.isfile(src):
        print(f"SKIP missing {src_rel}")
        continue
    shutil.copy2(src, dst)
    print(f"OK {dst_name}")

print(f"\nГотово → {OUT}")
print("Перетащи 01-* в Rive как основу (спина, маркер).")
