#!/usr/bin/env python3
"""Export globe-spin frames from hero sheet (Tearz + spinning globe)."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "assets/images/tearz-mario"
SHEET = ROOT / "tearz-globe-spin-hero-sheet.png"
PAD = 16
FRAME = 1024
FRAME_MS = 300


def key_sheet_background(img: Image.Image, tolerance: int = 42) -> Image.Image:
    """Flood-fill navy sheet background from corners → transparent."""
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size

    seeds: list[tuple[int, int]] = []
    for x in range(w):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(h):
        seeds.append((0, y))
        seeds.append((w - 1, y))

    ref = px[0, 0][:3]
    visited = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def close(r: int, g: int, b: int) -> bool:
        return (
            abs(r - ref[0]) <= tolerance
            and abs(g - ref[1]) <= tolerance
            and abs(b - ref[2]) <= tolerance
        )

    for sx, sy in seeds:
        idx = sy * w + sx
        if visited[idx]:
            continue
        r, g, b, a = px[sx, sy]
        if a == 0 or not close(r, g, b):
            continue
        visited[idx] = 1
        q.append((sx, sy))

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            idx = ny * w + nx
            if visited[idx]:
                continue
            r, g, b, a = px[nx, ny]
            if a == 0 or not close(r, g, b):
                continue
            visited[idx] = 1
            q.append((nx, ny))

    return rgba


def main() -> None:
    sheet = Image.open(SHEET).convert("RGBA")
    frames: list[Image.Image] = []
    for i in range(4):
        x0 = PAD + i * (FRAME + PAD)
        fr = sheet.crop((x0, PAD, x0 + FRAME, PAD + FRAME))
        fr = key_sheet_background(fr)
        fr.save(ROOT / f"tearz-globe-spin-frame-{i}.png")
        frames.append(fr)

    anim = Image.new("RGBA", (FRAME * 4, FRAME), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        anim.paste(fr, (i * FRAME, 0), fr)
    anim.save(ROOT / "tearz-globe-spin-anim-sheet.png")

    gif = [f.convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for f in frames]
    for g in gif:
        g.info["transparency"] = 0
    gif[0].save(
        ROOT / "tearz-globe-spin.gif",
        save_all=True,
        append_images=gif[1:],
        duration=[FRAME_MS] * 4,
        loop=0,
        disposal=2,
        transparency=0,
    )
    print(f"exported 4 transparent frames from {SHEET.name}")


if __name__ == "__main__":
    main()
