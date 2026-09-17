#!/usr/bin/env python3
"""Write the photo-slot tables (public/template/cuts.json, landscape-cuts.json).

The slot times are the template's pose-change frames that the two official
references swap photos on (30 fps):

* jump reference (Short o1ROhNU0UNw): the frame where the new photo appears
  together with the white flash.
* zoom reference (X post hagikaze_sami): the frame where the outgoing photo is
  at its smallest / most blurred (the new photo appears one frame later).

Both references were frame-extracted with ffmpeg and aligned to the template
by cross-correlating per-frame difference signals (lag +1 frame for both).
The two beat lists agree within one frame; where only one reference has a cut
(the Short holds its last photo from 11.7 s) the other one is used. The
vertical and landscape templates share the same animation frame for frame, so
both tables get the same slots.

Detecting the beats from the template alone (15 fps or 30 fps pixel
difference) is not reliable: the character animates at ~10 fps and the beat
cut is not always the biggest change, which is how 4.067 / 8.0 / 9.933 crept
into the old tables.

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

PORTRAIT_BAND_Y = 312
PORTRAIT_BAND_H = 342

# Template frame index of each photo swap (frame 0 = first slot). Where the two
# references disagreed by a frame, the template's own pose-change frame (the
# `--check` peak) decides: 236, 309, 353, 367.
BEAT_FRAMES = [
    0, 15, 30, 45, 59, 74, 88, 102, 118, 133, 148, 163, 177, 192, 206, 220,
    236, 250, 264, 279, 294, 309, 323, 338, 353, 367, 381, 396, 411, 424, 440, 455,
]

NOTE = (
    "参考 2 本（Short o1ROhNU0UNw / X hagikaze_sami）の写真切替フレームをテンプレのポーズ切替に合わせた 30fps の拍。"
    " 値は frame/30。"
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
