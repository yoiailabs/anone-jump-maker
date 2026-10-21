import { expect, it } from "vitest";
import track from "./generated/chara-iris-track.json";
import { charaIrisCenter } from "./charairis.ts";
import { characterDest, characterScale, characterShiftY, templateBandRect } from "./layout.ts";
import { keyAlpha, sampleKeyColor } from "./keying.ts";

it("decoded template foreground stays at the tracked iris center in both aspects and every character size", async () => {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  const loaded = new Promise<void>((resolve, reject) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(video.error), { once: true });
  });
  video.src = "/official-assets/template/landscape.mp4";
  try {
    await loaded;
    const canvas = document.createElement("canvas");
    canvas.width = 480; canvas.height = 270;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    for (const frame of [56, 57, 58, 59, 60, 61, 62, 99, 100, 101, 102, 103, 104, 105, 202, 203, 204, 205, 206, 207, 208, 209]) {
      const sought = new Promise<void>((resolve) => video.addEventListener("seeked", () => resolve(), { once: true }));
      // フレーム内の時刻へシークし、境界のデコーダ丸めを避ける。
      video.currentTime = (frame + 0.1) / 30;
      await sought;
      ctx.drawImage(video, 0, 0, 480, 270);
      for (const mode of ["landscape", "portrait"] as const) {
        const band = templateBandRect(480, 270, mode);
        const data = ctx.getImageData(band.x, band.y, band.w, band.h).data;
        const key = sampleKeyColor(data, band.w, band.h);
        const rows = new Uint32Array(band.h), cols = new Uint32Array(band.w);
        for (let y = 0; y < band.h; y++) {
          for (let x = 0; x < band.w; x++) {
            const i = (y * band.w + x) * 4;
            if (keyAlpha(data[i]!, data[i + 1]!, data[i + 2]!, ...key) >= 0.5) { rows[y]!++; cols[x]!++; }
          }
        }
        const xs = [...cols.keys()].filter((x) => cols[x]! >= 3);
        const ys = [...rows.keys()].filter((y) => rows[y]! >= 3);
        expect(xs.length).toBeGreaterThan(0); expect(ys.length).toBeGreaterThan(0);
        const actual = { x: (xs[0]! + xs.at(-1)! + 1) / (2 * band.w), y: (ys[0]! + ys.at(-1)! + 1) / (2 * band.h) };
        const measured = track[mode][frame]!;
        // ffmpegとCanvasの縮小器・YUV変換の差はプレートの1%以内。
        expect(Math.hypot(actual.x - measured[0]!, actual.y - measured[1]!), `frame=${frame}, ${mode}`).toBeLessThan(0.012);
        const w = mode === "landscape" ? 640 : 360, h = mode === "landscape" ? 360 : 640;
        for (const size of ["standard", "1.2", "1.4"] as const) {
          const dest = characterDest(w, h, characterScale(mode, size), characterShiftY(h, mode), mode);
          const iris = charaIrisCenter(frame / 30, w, h, mode, size);
          // ポーズ境界の平滑化による差も含め、実キャラの外接矩形中心付近に収まる。
          expect(Math.hypot((iris.x - dest.x) / dest.w - actual.x, (iris.y - dest.y) / dest.h - actual.y)).toBeLessThan(0.065);
        }
      }
    }
  } finally {
    video.removeAttribute("src"); video.load();
  }
});
