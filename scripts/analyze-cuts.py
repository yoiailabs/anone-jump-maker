#!/usr/bin/env python3
"""Write the photo-slot tables (public/template/cuts.json, landscape-cuts.json).

Source of truth for the slot timing is the colour-coded Short utNIG60-li0: the
template rendered with each of its 10 photo slots filled by a flat colour, so
every photo swap is an unambiguous colour change. Frames were extracted with
ffmpeg (30 fps) and the video aligned to public/template/vertical.mp4 by
cross-correlating the character-silhouette difference signal (template frame =
video frame + 1, corr 0.92, stable in every 60-frame window).

Each swap is a two-frame dip-to-white: S-1 shows the old colour lifted, S shows
the old/new blend (and the character pose change), S+1 the clean new colour.
`slots` is S. The earlier photo references agree within a frame: the jump
Short (o1ROhNU0UNw) shows the new photo with its flash on S, the zoom post
(hagikaze_sami) shows the blur peak on S and the new photo on S+1.

The same video gives the photo count and order: 10 distinct colours over 32
slots, A B C D E F G B E A H B A I F I B D H I G H J C H F I J G D A I
(`slotPhotoOrder`, A..J -> 0..9). The vertical and landscape templates share
the animation frame for frame, so both tables get the same slots.

Detecting the beats from the template alone (pixel difference of the character)
is not reliable: the character animates on its own ~3-frame grid and the photo
cut can sit a frame or two away from the nearest pose change (233 vs 236,
426 vs 424 ...), which is how 4.067 / 8.0 / 9.933 crept into the old tables.

Usage: python3 scripts/analyze-cuts.py [--check]
  --check  also print the template's per-frame difference at each beat frame
           (needs ffmpeg, Pillow, numpy) so the pose change can be eyeballed.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FPS = 30

PORTRAIT_BAND_Y = 313
PORTRAIT_BAND_H = 342

# Template frame index of each photo swap (frame 0 = first slot), from the
# colour-coded Short utNIG60-li0 (video frame + 1).
BEAT_FRAMES = [
    0, 15, 30, 45, 59, 74, 88, 102, 118, 134, 148, 163, 178, 192, 205, 219,
    233, 250, 264, 279, 294, 308, 322, 338, 352, 366, 380, 396, 411, 426, 441, 457,
]

# Which of the template's 10 photos each slot shows (colour sequence of the same video).
PHOTO_COUNT = 10
SLOT_PHOTO_ORDER = [
    0, 1, 2, 3, 4, 5, 6, 1, 4, 0, 7, 1, 0, 8, 5, 8, 1, 3, 7, 8, 6, 7, 9, 2, 7, 5, 8, 9, 6, 3, 0, 8,
]
assert len(SLOT_PHOTO_ORDER) == len(BEAT_FRAMES)
assert max(SLOT_PHOTO_ORDER) + 1 == PHOTO_COUNT

NOTE = (
    "色分け Short utNIG60-li0（10 色＝10 枚のスロット）の色が切り替わるフレームをテンプレ時刻に合わせた 30fps の拍。"
    " 値は frame/30。slotPhotoOrder は各カットに入る写真番号（0..9）。"
)


def probe(video: Path) -> tuple[int, int, float]:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,duration",
            "-of",
            "json",
            str(video),
        ],
        text=True,
    )
    stream = json.loads(raw)["streams"][0]
    width = int(stream["width"])
    height = int(stream["height"])
    duration = float(stream.get("duration") or 0)
    if not duration:
        fmt = json.loads(
            subprocess.check_output(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(video)],
                text=True,
            )
        )
        duration = float(fmt["format"]["duration"])
    return width, height, duration


def slot_seconds(frames: list[int]) -> list[float]:
    return [round(f / FPS, 6) for f in frames]


def payload_for(mode: str, video: Path, width: int, height: int, duration: float) -> dict:
    rel = video.relative_to(ROOT).as_posix()
    band = {"y": PORTRAIT_BAND_Y, "h": PORTRAIT_BAND_H} if mode == "portrait" else {"y": 0, "h": height}
    return {
        "source": rel,
        "note": NOTE,
        "duration": round(duration, 3),
        "fps": FPS,
        "width": width,
        "height": height,
        "band": band,
        "slotFrames": BEAT_FRAMES,
        "slots": slot_seconds(BEAT_FRAMES),
        "photoCount": PHOTO_COUNT,
        "slotPhotoOrder": SLOT_PHOTO_ORDER,
    }


def check_template(video: Path, mode: str) -> None:
    import tempfile

    import numpy as np
    from PIL import Image

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vsync", "passthrough", f"{tmp}/f%04d.png"],
            check=True,
        )
        files = sorted(Path(tmp).glob("f*.png"))
        prev = None
        diffs: list[float] = []
        for path in files:
            arr = np.asarray(Image.open(path).convert("L"), dtype=np.float32)
            if mode == "portrait":
                h = arr.shape[0]
                arr = arr[int(round(h * PORTRAIT_BAND_Y / 1080)) : int(round(h * (PORTRAIT_BAND_Y + PORTRAIT_BAND_H) / 1080))]
            small = np.asarray(Image.fromarray(arr.astype(np.uint8)).resize((96, 54)), dtype=np.float32)
            diffs.append(0.0 if prev is None else float(np.mean(np.abs(small - prev))))
            prev = small
    for f in BEAT_FRAMES:
        window = " ".join(f"{diffs[i]:4.1f}" if 0 <= i < len(diffs) else "  --" for i in range(f - 2, f + 3))
        print(f"  frame {f:3d} t={f / FPS:6.3f}  diff[f-2..f+2] = {window}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("portrait", "landscape", "both"), default="both")
    parser.add_argument("--check", action="store_true", help="print template frame differences at each beat")
    args = parser.parse_args()
    modes = ("portrait", "landscape") if args.mode == "both" else (args.mode,)

    for mode in modes:
        video = ROOT / "public/template" / ("vertical.mp4" if mode == "portrait" else "landscape.mp4")
        out = ROOT / "public/template" / ("cuts.json" if mode == "portrait" else "landscape-cuts.json")
        width, height, duration = probe(video)
        payload = payload_for(mode, video, width, height, duration)
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{mode}: wrote {len(BEAT_FRAMES)} slots, {width}x{height}, {duration:.3f}s -> {out}")
        if args.check:
            check_template(video, mode)


if __name__ == "__main__":
    main()
