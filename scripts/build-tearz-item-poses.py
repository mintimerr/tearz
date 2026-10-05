"""Recolor each drawn item pose and export hat layers for the wardrobe.

The phone shows one body sprite (item in hand, or the thinking pose) plus a
hat layer. Color only shifts the cyan body, so the book, phone, eyes and
outlines stay put.
"""

from __future__ import annotations

import colorsys
import json
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/images/tearz-mario/cosmetics"
OUT = SRC / "poses"
BODY_H = 512

# Match the pixels already baked into base-color-*.png
COLORS = {
    "classic": None,
    "mint": (81, 224, 155),
    "sunset": (224, 121, 81),
    "grape": (157, 119, 224),
    "gold": (232, 191, 67),
    "rose": (224, 94, 138),
}
REF = (61, 220, 255)

POSES = {
    "acc-book": SRC / "custom-poses/acc-book.png",
    "acc-phone": SRC / "custom-poses/acc-phone.png",
    "acc-game": SRC / "custom-poses/acc-game.png",
    "acc-star": SRC / "custom-poses/acc-star.png",
    "acc-shades": SRC / "custom-poses/acc-shades.png",
}

# Hat width as a fraction of the head width, and which fraction of the hat
# height sits on the top of the head (between the ears).
HAT_PLACE = {
    "hat-grad": {"scale": 1.12, "anchor": 0.58},
    "hat-cap": {"scale": 0.86, "anchor": 0.72},
    "hat-beanie": {"scale": 0.78, "anchor": 0.82},
    "hat-party": {"scale": 0.58, "anchor": 0.90},
    "hat-crown": {"scale": 0.70, "anchor": 0.92},
}


def is_body(r: int, g: int, b: int, a: int) -> bool:
    if a < 30 or g < 40 or b < 35:
        return False
    if g < r + 25 or b < r + 15:
        return False
    # Navy eyes are blue-heavy; the body keeps G and B close.
    if g < b * 0.72 or b < g * 0.65:
        return False
    return True


def is_gold(r: int, g: int, b: int, a: int) -> bool:
    if a < 40:
        return False
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 0.05 <= h <= 0.18 and s > 0.35 and v > 0.4


def trim(im: Image.Image, thr: int = 16) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > thr:
                found = True
                minx, miny = min(minx, x), min(miny, y)
                maxx, maxy = max(maxx, x), max(maxy, y)
    if not found:
        return im
    return im.crop((minx, miny, maxx + 1, maxy + 1))


def recolor(im: Image.Image, target: tuple[int, int, int] | None) -> Image.Image:
    im = im.convert("RGBA")
    if target is None:
        return im
    out = im.copy()
    px = out.load()
    w, h = out.size
    th, ts, tv = colorsys.rgb_to_hsv(*(c / 255 for c in target))
    _, _, rv = colorsys.rgb_to_hsv(*(c / 255 for c in REF))
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not is_body(r, g, b, a):
                continue
            _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            nv = max(0.0, min(1.0, v * (tv / rv)))
            ns = max(0.0, min(1.0, ts * (0.82 + 0.18 * s)))
            nr, ng, nb = colorsys.hsv_to_rgb(th, ns, nv)
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return out


def to_height(im: Image.Image, height: int) -> Image.Image:
    w, h = im.size
    nw = max(1, int(round(w * (height / h))))
    return im.resize((nw, height), Image.Resampling.NEAREST)


def metrics(im: Image.Image) -> dict[str, float]:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    x0, x1 = int(w * 0.40), int(w * 0.60)
    head = 0
    for y in range(h):
        n = sum(1 for x in range(x0, x1) if px[x, y][3] > 80)
        if n > (x1 - x0) * 0.35:
            head = y
            break
    y = min(h - 1, head + int(h * 0.16))
    xs = [x for x in range(w) if px[x, y][3] > 80]
    runs: list[list[int]] = []
    run = [xs[0]]
    prev = xs[0]
    for x in xs[1:]:
        if x == prev + 1:
            run.append(x)
        else:
            runs.append(run)
            run = [x]
        prev = x
    runs.append(run)
    span = max(runs, key=len)
    cx = (span[0] + span[-1]) / 2
    hw = span[-1] - span[0] + 1
    return {
        "aspect": round(w / h, 4),
        "head": round(head / h, 4),
        "cx": round(cx / w, 4),
        "headW": round(hw / w, 4),
    }


def extract_crown() -> Image.Image:
    im = Image.open(SRC / "drawn/tearz-hat-crown.png").convert("RGBA")
    w, h = im.size
    px = im.load()
    seeds: list[tuple[int, int]] = []
    max_gy = 0
    for y in range(h):
        for x in range(w):
            if is_gold(*px[x, y]):
                seeds.append((x, y))
                max_gy = max(max_gy, y)
    cut = max_gy + 6
    seen = set(seeds)
    q = deque(seeds)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()

    def kind(p: tuple[int, int, int, int]) -> str | None:
        r, g, b, a = p
        if a < 30 or is_body(r, g, b, a):
            return None
        if is_gold(r, g, b, a):
            return "gold"
        hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s > 0.35 and v > 0.25 and max(r, g, b) > 60:
            return "gem"
        if max(r, g, b) < 90:
            return "dark"
        return None

    while q:
        x, y = q.popleft()
        if y > cut or kind(px[x, y]) is None:
            continue
        op[x, y] = px[x, y]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= w or ny >= h or (nx, ny) in seen:
                continue
            if kind(px[nx, ny]) is None:
                continue
            seen.add((nx, ny))
            q.append((nx, ny))

    gxs = [x for y in range(h) for x in range(w) if is_gold(*op[x, y])]
    gys = [y for y in range(h) for x in range(w) if is_gold(*op[x, y])]
    pad = 8
    minx, maxx = min(gxs) - pad, max(gxs) + pad
    miny, maxy = min(gys) - pad, max(gys) + pad
    colorful = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = op[x, y]
            if a < 20:
                continue
            if not (minx <= x <= maxx and miny <= y <= maxy):
                op[x, y] = (0, 0, 0, 0)
                continue
            if max(r, g, b) > 80:
                colorful.append((x, y))
    near = {(x + dx, y + dy) for x, y in colorful for dy in range(-3, 4) for dx in range(-3, 4) if max(abs(dx), abs(dy)) <= 3}
    for y in range(h):
        for x in range(w):
            if op[x, y][3] > 10 and (x, y) not in near:
                op[x, y] = (0, 0, 0, 0)
    return trim(out)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    body_metrics: dict[str, dict[str, float]] = {}
    for key, path in POSES.items():
        src = Image.open(path)
        for color, target in COLORS.items():
            pose = to_height(trim(recolor(src, target)), BODY_H)
            pose.save(OUT / f"{key}--{color}.png", optimize=True)
            if color == "classic":
                body_metrics[key] = metrics(pose)
        print(key, body_metrics[key])

    base = trim(Image.open(SRC / "base-color-classic.png"))
    body_metrics["base"] = metrics(base)
    print("base", body_metrics["base"])

    hat_metrics: dict[str, dict[str, float]] = {}
    raw_hats = {
        "hat-grad": trim(Image.open(SRC / "drawn/tearz-hat-grad.png")),
        "hat-cap": trim(Image.open(SRC / "drawn/tearz-hat-cap.png")),
        "hat-beanie": trim(Image.open(SRC / "drawn/tearz-hat-beanie.png")),
        "hat-party": trim(Image.open(SRC / "drawn/tearz-hat-party.png")),
        "hat-crown": extract_crown(),
    }
    for key, im in raw_hats.items():
        im = to_height(im, min(BODY_H, im.size[1]))
        im.save(OUT / f"{key}.png", optimize=True)
        w, h = im.size
        hat_metrics[key] = {
            "aspect": round(w / h, 4),
            "scale": HAT_PLACE[key]["scale"],
            "anchor": HAT_PLACE[key]["anchor"],
        }
        print(key, im.size, hat_metrics[key])

    (OUT / "layout.json").write_text(json.dumps({"body": body_metrics, "hat": hat_metrics}, indent=2))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
