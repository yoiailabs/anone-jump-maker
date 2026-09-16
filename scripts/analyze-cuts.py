#!/usr/bin/env python3
"""Recompute jump slots from public/template/vertical.mp4 (needs ffmpeg + pillow + numpy)."""

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


def sample_bg(arr: np.ndarray) -> np.ndarray:
    h, w, _ = arr.shape
    pts = np.concatenate(
        [
            arr[0:8, 0:8].reshape(-1, 3),
            arr[0:8, w - 8 : w].reshape(-1, 3),
            arr[0:12, w // 2 - 8 : w // 2 + 8].reshape(-1, 3),
            arr[h - 8 : h, 0:8].reshape(-1, 3),
            arr[h - 8 : h, w - 8 : w].reshape(-1, 3),
        ],
        axis=0,
    )
    return pts.mean(axis=0)


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(VIDEO), "-vf", "fps=15", str(dest / "f%04d.png")],
            check=True,
            capture_output=True,
        )
        files = sorted(dest.glob("f*.png"))
        prev = None
        prev_bg = None
        events: list[tuple[float, float, float]] = []
        for i, path in enumerate(files):
            image = Image.open(path).convert("RGB")
            arr = np.asarray(image, dtype=np.float32)
            bg = sample_bg(arr)
            small = np.asarray(image.resize((90, 160), Image.BILINEAR), dtype=np.float32)
            pix = 0.0 if prev is None else float(np.mean(np.abs(small - prev)))
            bgd = 0.0 if prev_bg is None else float(np.mean(np.abs(bg - prev_bg)))
            events.append((i / 15.0, pix, bgd))
            prev = small
            prev_bg = bg

    slots = [0.0]
    for t, pix, bgd in events[1:]:
        if (pix > 12 or bgd > 20) and t - slots[-1] >= 0.2:
            slots.append(round(t, 3))

    payload = {
        "source": "public/template/vertical.mp4",
        "note": "15fps フレームの背景色差・画素差から検出。閾値 pix>12 または bgd>20、最短間隔 0.2s。",
        "duration": 15.54,
        "fps": 30,
        "width": 360,
        "height": 640,
        "slots": slots,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(slots)} slots -> {OUT}")


if __name__ == "__main__":
    main()
