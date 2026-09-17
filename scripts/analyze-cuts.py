#!/usr/bin/env python3
"""Detect jump slots from a template video.

Portrait: green 16:9 band of public/template/vertical.mp4
Landscape: full frame of public/template/landscape.mp4
"""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]

PIX_THR = 8
MIN_GAP = 0.22
FPS_DETECT = 15

PORTRAIT_BAND_Y = 312
PORTRAIT_BAND_H = 342


def probe(video: Path) -> tuple[int, int, float]:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate,duration",
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


def extract_frames(video: Path, dest: Path, fps: int = FPS_DETECT) -> list[Path]:
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(video), "-vf", f"fps={fps}", str(dest / "f%04d.png")],
        check=True,
        capture_output=True,
    )
    return sorted(dest.glob("f*.png"))


def crop_region(arr: np.ndarray, mode: str) -> np.ndarray:
    if mode == "portrait":
        return arr[PORTRAIT_BAND_Y : PORTRAIT_BAND_Y + PORTRAIT_BAND_H]
    return arr


def detect_slots(files: list[Path], mode: str) -> list[float]:
    prev = None
    events: list[tuple[float, float]] = []
    for i, path in enumerate(files):
        image = Image.open(path).convert("RGB")
        arr = np.asarray(image, dtype=np.uint8)
        band = crop_region(arr, mode)
        small = np.asarray(Image.fromarray(band).resize((90, 50), Image.BILINEAR), dtype=np.float32)
        pix = 0.0 if prev is None else float(np.mean(np.abs(small - prev)))
        events.append((i / FPS_DETECT, pix))
        prev = small

    slots = [0.0]
    for t, pix in events[1:]:
        if pix > PIX_THR and t - slots[-1] >= MIN_GAP:
            slots.append(round(t, 3))
    return slots


def payload_for(mode: str, video: Path, width: int, height: int, duration: float, slots: list[float]) -> dict:
    rel = video.relative_to(ROOT).as_posix()
    if mode == "portrait":
        return {
            "source": rel,
            "note": "緑16:9帯の15fps画素差。閾値 pix>8、最短間隔 0.22s。",
            "duration": round(duration, 3),
            "fps": 30,
            "width": width,
            "height": height,
            "band": {"y": PORTRAIT_BAND_Y, "h": PORTRAIT_BAND_H},
            "slots": slots,
        }
    return {
        "source": rel,
        "note": "横テンプレ全面の15fps画素差。閾値 pix>8、最短間隔 0.22s。",
        "duration": round(duration, 3),
        "fps": 30,
        "width": width,
        "height": height,
        "band": {"y": 0, "h": height},
        "slots": slots,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("portrait", "landscape", "both"), default="both")
    args = parser.parse_args()
    modes = ("portrait", "landscape") if args.mode == "both" else (args.mode,)

    for mode in modes:
        video = ROOT / "public/template" / ("vertical.mp4" if mode == "portrait" else "landscape.mp4")
        out = ROOT / "public/template" / ("cuts.json" if mode == "portrait" else "landscape-cuts.json")
        width, height, duration = probe(video)
        with tempfile.TemporaryDirectory() as tmp:
            files = extract_frames(video, Path(tmp))
            slots = detect_slots(files, mode)
        out.write_text(json.dumps(payload_for(mode, video, width, height, duration, slots), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{mode}: wrote {len(slots)} slots, {width}x{height}, {duration:.3f}s -> {out}")


if __name__ == "__main__":
    main()
