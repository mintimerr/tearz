#!/usr/bin/env python3
"""Пак для импорта в Rive Editor → assets/rive/import-pack/"""
from __future__ import annotations

import os
import shutil

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "assets/rive/import-pack")

ITEMS = [
    ("refs/01-tearz-write-back-main.png", "01-reference-back.png"),
    ("refs/03-tearz-write-idle-frame0.png", "02-idle-frame.png"),
    ("../board-sprites/sequences/writing-a", "animations/writing-a"),
    ("../board-sprites/sequences/writing-b", "animations/writing-b"),
    ("../board-sprites/sequences/writing-c", "animations/writing-c"),
    ("../board-sprites/sequences/erasing", "animations/erasing"),
]


def main() -> None:
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)

    rive = os.path.join(ROOT, "assets/rive")
    for src_rel, dst_rel in ITEMS:
        src = os.path.join(rive, src_rel) if not src_rel.startswith("..") else os.path.join(ROOT, "assets", src_rel.replace("../", ""))
        dst = os.path.join(OUT, dst_rel)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
        print("OK", dst_rel)

    readme = os.path.join(OUT, "README.txt")
    with open(readme, "w", encoding="utf-8") as f:
        f.write(
            "Rive Editor import pack for Tearz Board\n"
            "1. Open rive.app → New file tearz-board\n"
            "2. Artboard TearzBoard 420×580 transparent\n"
            "3. Import 01-reference-back.png at 35% opacity\n"
            "4. Pen tool: body + arm from reference\n"
            "5. animations/writing-a → Timeline Writing (0.2s)\n"
            "6. State Machine BoardMachine — see scripts/rive-board-self-build.md\n"
            "7. Export → assets/rive/tearz-board.riv\n"
        )
    print(f"Done → {OUT}")


if __name__ == "__main__":
    main()
