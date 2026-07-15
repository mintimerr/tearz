#!/usr/bin/env python3
"""HQ full-frame спрайты Tearz у доски → assets/board-sprites/ (2× upscale + чистка альфы)."""
from __future__ import annotations

import json
import os

from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "assets/board-sprites")
SCALE = 2

CLIPS = {
    "idle": ("assets/images/tearz-board-write-a.webp", 0),
    "stroke-a": ("assets/images/tearz-board-write-a.webp", 2),
    "stroke-b": ("assets/images/tearz-board-write-b.webp", 3),
    "stroke-c": ("assets/images/tearz-board-write-c.webp", 3),
    "erase": ("assets/images/tearz-board-erase.webp", 2),
}

# HQ idle с референса (если есть) — лучше детализация
HQ_IDLE = "assets/board-concept/tearz-teacher-kling-write-ref-v2.png"
HQ_CROP = (0.12, 0.08, 0.88, 0.96)  # x0,y0,x1,y1 нормализованные


def white_key(im: Image.Image, thr: int = 248) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= thr and g >= thr and b >= thr:
                px[x, y] = (r, g, b, 0)
    return im


def clean_alpha_fringe(im: Image.Image) -> Image.Image:
    """Убирает чёрный ореол по краю альфы."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            lum = (r + g + b) / 3
            if lum < 42 and a < 220:
                px[x, y] = (r, g, b, max(0, int(a * 0.35)))
            elif lum < 28:
                px[x, y] = (r, g, b, 0)
    return im


def upscale(im: Image.Image) -> Image.Image:
    nw, nh = im.size[0] * SCALE, im.size[1] * SCALE
    up = im.resize((nw, nh), Image.Resampling.LANCZOS)
    up = ImageEnhance.Sharpness(up).enhance(1.15)
    return up


def load_hq_idle() -> Image.Image | None:
    path = os.path.join(ROOT, HQ_IDLE)
    if not os.path.exists(path):
        return None
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    x0, y0, x1, y1 = HQ_CROP
    crop = im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))
    crop = white_key(crop)
    # вписать в тот же аспект, что write-idle
    ref = Image.open(os.path.join(ROOT, CLIPS["idle"][0])).convert("RGBA")
    rw, rh = ref.size
    scale = min(rw / crop.width, rh / crop.height)
    nw, nh = int(crop.width * scale), int(crop.height * scale)
    fitted = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (rw, rh), (0, 0, 0, 0))
    ox = (rw - nw) // 2
    oy = rh - nh
    canvas.paste(fitted, (ox, oy), fitted)
    return clean_alpha_fringe(canvas)


def load_frame(rel: str, frame_idx: int | None) -> Image.Image:
    path = os.path.join(ROOT, rel)
    im = Image.open(path)
    if frame_idx is not None:
        im.seek(min(frame_idx, getattr(im, "n_frames", 1) - 1))
    return clean_alpha_fringe(im.convert("RGBA"))


def normalize_canvas(frame: Image.Image, rw: int, rh: int) -> Image.Image:
    """Все кадры в одном размере — без сдвига при crossfade."""
    if frame.size == (rw, rh):
        return frame
    canvas = Image.new("RGBA", (rw, rh), (0, 0, 0, 0))
    fw, fh = frame.size
    scale = min(rw / fw, rh / fh)
    nw, nh = int(fw * scale), int(fh * scale)
    fitted = frame.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = rw - nw
    oy = rh - nh
    canvas.paste(fitted, (ox, oy), fitted)
    return canvas


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    meta: dict = {"scale": SCALE, "sprites": {}}

    hq_idle = load_hq_idle()  # только reference.png
    ref = load_frame(CLIPS["idle"][0], CLIPS["idle"][1])
    ref = upscale(ref)
    rw, rh = ref.size

    for key, (rel, frame_idx) in CLIPS.items():
        frame = load_frame(rel, frame_idx)
        out = normalize_canvas(upscale(frame), rw, rh)
        name = f"{key}.png"
        out.save(os.path.join(OUT, name), optimize=True)
        meta["sprites"][key] = {"file": name, "w": out.width, "h": out.height}
        print("OK", name, out.size)

    if hq_idle is not None:
        hq_idle.save(os.path.join(OUT, "reference-hq.png"), optimize=True)

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"Done → {OUT}")


if __name__ == "__main__":
    main()
