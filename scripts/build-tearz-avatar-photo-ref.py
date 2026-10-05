#!/usr/bin/env python3
"""Passport Tearz avatar ref — globe-spin eyes pasted 1:1 on front-facing idle body."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MARIO = ROOT / "assets/images/tearz-mario"
GLOBE = MARIO / "tearz-globe-spin-frame-0.png"
IDLE = MARIO / "tearz-mario-idle-sprite.png"
OUT = MARIO / "tearz-mario-avatar-photo-ref.png"

GLOBE_EYE_L = (298, 379, 368, 424)
GLOBE_EYE_R = (413, 379, 483, 424)
GLOBE_MOUTH = (350, 407, 405, 415)

BODY = (70, 196, 220, 255)
INK = (20, 20, 30, 255)


def sample_body_fill(im: Image.Image, cx: int, cy: int) -> tuple[int, int, int, int]:
    for dy in (50, 60, 70):
        x, y = cx, cy + dy
        if 0 <= x < im.width and 0 <= y < im.height:
            r, g, b, a = im.getpixel((x, y))
            if a > 20 and not is_ink(r, g, b, a):
                return (r, g, b, 255)
    return BODY


def bbox_content(im: Image.Image, alpha_min: int = 12) -> tuple[int, int, int, int]:
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] >= alpha_min:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    return minx, miny, maxx, maxy


def is_cyan_body(r: int, g: int, b: int, a: int) -> bool:
    if a < 20:
        return True
    return g > 110 and b > 125 and r < 140


def is_ink(r: int, g: int, b: int, a: int) -> bool:
    return a > 20 and r < 55 and g < 55 and b < 70


def feature_only(patch: Image.Image) -> Image.Image:
    out = Image.new("RGBA", patch.size, (0, 0, 0, 0))
    src = patch.load()
    dst = out.load()
    for y in range(patch.height):
        for x in range(patch.width):
            r, g, b, a = src[x, y]
            if a < 20 or is_cyan_body(r, g, b, a):
                continue
            dst[x, y] = (r, g, b, a)
    return out


def paste_layer(base: Image.Image, layer: Image.Image, x: int, y: int) -> None:
    base.paste(layer, (x, y), layer)


def prepare_face(im: Image.Image, cx: int, cy: int, fill: tuple[int, int, int, int]) -> None:
    px = im.load()
    r2 = 88 * 88
    for y in range(cy - 98, cy + 58):
        for x in range(cx - 102, cx + 102):
            if (x - cx) ** 2 + (y - cy) ** 2 > r2:
                continue
            if 0 <= x < im.width and 0 <= y < im.height:
                r, g, b, a = px[x, y]
                if a > 20 and (
                    is_ink(r, g, b, a) or (r > 180 and g > 180 and b > 180)
                ):
                    px[x, y] = fill


def erase_thinking_arm(im: Image.Image, cx: int, cy: int, fill: tuple[int, int, int, int]) -> None:
    px = im.load()
    for y in range(cy - 72, cy + 115):
        for x in range(cx + 4, cx + 225):
            if 0 <= x < im.width and 0 <= y < im.height and px[x, y][3] > 20:
                px[x, y] = fill


def mirror_left_arm(im: Image.Image, cx: int, foot_y: int) -> None:
    px = im.load()
    y0 = foot_y - 205
    y1 = foot_y - 105
    src_x0 = cx - 138
    dst_x0 = cx + 95
    width = 30
    for y in range(y0, y1):
        for dx in range(width):
            sx = src_x0 + dx
            tx = dst_x0 + dx
            if 0 <= sx < im.width and 0 <= tx < im.width and 0 <= y < im.height:
                r, g, b, a = px[sx, y]
                if a > 20 and not is_ink(r, g, b, a):
                    px[tx, y] = (r, g, b, a)


def main() -> None:
    globe = Image.open(GLOBE).convert("RGBA")
    eye_r = feature_only(globe.crop(GLOBE_EYE_R))
    eye_l = eye_r.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    mouth = feature_only(globe.crop(GLOBE_MOUTH))

    body = Image.open(IDLE).convert("RGBA").copy()
    minx, miny, maxx, maxy = bbox_content(body)
    cx = (minx + maxx) // 2
    cy = miny + int((maxy - miny) * 0.355)
    foot_y = maxy - 6

    body_fill = sample_body_fill(body, cx, cy)

    erase_thinking_arm(body, cx, cy, body_fill)
    prepare_face(body, cx, cy, body_fill)

    ew, eh = eye_r.size
    gap = 30
    eye_y = cy - eh // 2 - 2
    paste_layer(body, eye_l, cx - gap - ew, eye_y)
    paste_layer(body, eye_r, cx + gap, eye_y)

    mw, mh = mouth.size
    paste_layer(body, mouth, cx - mw // 2 + 2, cy + 22)

    mirror_left_arm(body, cx, foot_y)

    minx, miny, maxx, maxy = bbox_content(body)
    pad = 16
    crop = body.crop(
        (
            max(0, minx - pad),
            max(0, miny - pad),
            min(body.width, maxx + pad),
            min(body.height, maxy + pad),
        )
    )
    side = max(crop.size)
    square = Image.new("RGBA", (side, side), (255, 0, 255, 255))
    ox = (side - crop.width) // 2
    oy = (side - crop.height) // 2
    square.paste(crop, (ox, oy), crop)

    out = square.resize((1024, 1024), Image.Resampling.NEAREST)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, optimize=True)

    sprite = key_magenta(out.copy())
    sprite_out = MARIO / "tearz-mario-avatar-photo-sprite.png"
    sprite.save(sprite_out, optimize=True)
    print(f"→ {OUT}")
    print(f"→ {sprite_out}")


def key_magenta(im: Image.Image) -> Image.Image:
    from collections import deque

    px = im.convert("RGBA").load()
    w, h = im.size
    out = im.copy()
    dst = out.load()

    def is_mag(r: int, g: int, b: int, a: int) -> bool:
        return a > 20 and r > 200 and b > 200 and g < 80

    visited = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_mag(*px[x, y]):
                visited[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if not visited[i] and is_mag(*px[x, y]):
                visited[i] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        dst[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not visited[i] and is_mag(*px[nx, ny]):
                    visited[i] = 1
                    q.append((nx, ny))

    minx, miny, maxx, maxy = bbox_content(out)
    pad = 8
    return out.crop(
        (
            max(0, minx - pad),
            max(0, miny - pad),
            min(w, maxx + pad),
            min(h, maxy + pad),
        )
    )


if __name__ == "__main__":
    main()
