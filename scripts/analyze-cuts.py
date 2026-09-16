#!/usr/bin/env python3
"""Recompute jump slots from the green 16:9 band of public/template/vertical.mp4."""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
VIDEO = ROOT / "public/template/vertical.mp4"
OUT = ROOT / "public/template/cuts.json"

BAND_Y = 312
BAND_H = 342
PIX_THR = 8
MIN_GAP = 0.22
FPS_DETECT = 15


def main() -> None:
    probe = subprocess.check_output(
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
            str(VIDEO),
        ],
        text=True,
    )
    stream = json.loads(probe)["streams"][0]
    width = int(stream["width"])
    height = int(stream["height"])
    duration = float(stream.get("duration") or 0)
    if not duration:
        fmt = json.loads(
            subprocess.check_output(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(VIDEO)],
                text=True,
            )
        )
        duration = float(fmt["format"]["duration"])

    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(VIDEO), "-vf", f"fps={FPS_DETECT}", str(dest / "f%04d.png")],
            check=True,
            capture_output=True,
        )
        files = sorted(dest.glob("f*.png"))
        prev = None
        events: list[tuple[float, float]] = []
        for i, path in enumerate(files):
            image = Image.open(path).convert("RGB")
            arr = np.asarray(image, dtype=np.uint8)
            band = arr[BAND_Y : BAND_Y + BAND_H]
            small = np.asarray(Image.fromarray(band).resize((90, 50), Image.BILINEAR), dtype=np.float32)
            pix = 0.0 if prev is None else float(np.mean(np.abs(small - prev)))
            events.append((i / FPS_DETECT, pix))
            prev = small

    slots = [0.0]
    for t, pix in events[1:]:
        if pix > PIX_THR and t - slots[-1] >= MIN_GAP:
            slots.append(round(t, 3))

    payload = {
        "source": "public/template/vertical.mp4",
        "note": "緑16:9帯の15fps画素差。閾値 pix>8、最短間隔 0.22s。",
        "duration": round(duration, 3),
        "fps": 30,
        "width": width,
        "height": height,
        "band": {"y": BAND_Y, "h": BAND_H},
        "slots": slots,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(slots)} slots, {width}x{height}, {duration:.3f}s -> {OUT}")


if __name__ == "__main__":
    main()
