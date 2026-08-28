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
BG_TOLERANCE = 8


def _bg_refs(img: Image.Image) -> list[tuple[int, int, int]]:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    pts = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (0, h // 2)]
    refs: list[tuple[int, int, int]] = []
    seen: set[tuple[int, int, int]] = set()
    for x, y in pts:
        rgb = px[x, y][:3]
        if rgb not in seen:
            seen.add(rgb)
            refs.append(rgb)
    return refs


def _matches_bg(r: int, g: int, b: int, refs: list[tuple[int, int, int]], tolerance: int) -> bool:
    for ref in refs:
        if (
            abs(r - ref[0]) <= tolerance
            and abs(g - ref[1]) <= tolerance
            and abs(b - ref[2]) <= tolerance
        ):
            return True
    return False


def key_sheet_background(img: Image.Image, tolerance: int = BG_TOLERANCE) -> Image.Image:
    """Flood-fill navy sheet background from edges only — tight tolerance keeps sprite crisp."""
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    refs = _bg_refs(rgba)

    visited = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    for sx in range(w):
        for sy in (0, h - 1):
            idx = sy * w + sx
            if visited[idx]:
                continue
            r, g, b, a = px[sx, sy]
            if a == 0 or not _matches_bg(r, g, b, refs, tolerance):
                continue
            visited[idx] = 1
            q.append((sx, sy))

    for sy in range(h):
        for sx in (0, w - 1):
            idx = sy * w + sx
            if visited[idx]:
                continue
            r, g, b, a = px[sx, sy]
            if a == 0 or not _matches_bg(r, g, b, refs, tolerance):
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
            if a == 0 or not _matches_bg(r, g, b, refs, tolerance):
                continue
            visited[idx] = 1
            q.append((nx, ny))

    return rgba


def defringe_background(img: Image.Image, tolerance: int = 10) -> Image.Image:
    """Remove leftover navy halos on outer edges."""
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    refs = _bg_refs(rgba)

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or not _matches_bg(r, g, b, refs, tolerance):
                continue
            touches_clear = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if nx < 0 or ny < 0 or nx >= w or ny >= h or px[nx, ny][3] == 0:
                    touches_clear = True
                    break
            if touches_clear:
                px[x, y] = (0, 0, 0, 0)

    return rgba


def main() -> None:
    sheet = Image.open(SHEET).convert("RGBA")
    frames: list[Image.Image] = []
    for i in range(4):
        x0 = PAD + i * (FRAME + PAD)
        fr = sheet.crop((x0, PAD, x0 + FRAME, PAD + FRAME))
        fr = key_sheet_background(fr)
        fr = defringe_background(fr)
        fr.save(ROOT / f"tearz-globe-spin-frame-{i}.png", optimize=True)
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
    print(f"exported 4 crisp transparent frames from {SHEET.name} (tolerance={BG_TOLERANCE})")


if __name__ == "__main__":
    main()
