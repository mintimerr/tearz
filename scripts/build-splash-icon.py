#!/usr/bin/env python3
"""Copy planned Tearz splash into Expo + iOS splash assets."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/images/tearz-mario/tearz-splash-planned-result.png'
OUT = ROOT / 'assets/images/splash-icon.png'
IOS_DIR = ROOT / 'ios/Tearz/Images.xcassets/SplashScreenLogo.imageset'

# Match expo-splash-screen imageWidth pt sizes used by prebuild.
IOS_SIZES = [('image.png', 260), ('image@2x.png', 520), ('image@3x.png', 780)]


def main() -> None:
    src = Image.open(SRC).convert('RGBA')
    # Splash plugin expects an opaque square; planned-result is already navy + Tearz.
    canvas = Image.new('RGB', src.size, (11, 20, 48))
    canvas.paste(src, (0, 0), src if src.mode == 'RGBA' else None)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, optimize=True)

    IOS_DIR.mkdir(parents=True, exist_ok=True)
    for name, side in IOS_SIZES:
        canvas.resize((side, side), Image.Resampling.NEAREST).save(IOS_DIR / name, optimize=True)

    print(f'splash → {OUT.relative_to(ROOT)} from {SRC.name}')


if __name__ == '__main__':
    main()
