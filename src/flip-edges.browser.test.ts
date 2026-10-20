import { describe, expect, it, vi } from "vitest";
import { createCompositor } from "./compositor.ts";
import { swapFx } from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";

const F = 1 / 30;
const S = 0.5;
const timeline = { slots: [0, S, 1] };

async function makePhoto(gradient: boolean, color = "rgb(96,128,160)"): Promise<LoadedPhoto> {
  const source = document.createElement("canvas");
  source.width = 603;
  source.height = 407;
  const ctx = source.getContext("2d")!;
  const fill = ctx.createLinearGradient(0, 0, 603, 407);
  fill.addColorStop(0, "rgb(70,100,130)");
  fill.addColorStop(1, "rgb(170,200,230)");
  ctx.fillStyle = gradient ? fill : color;
  ctx.fillRect(0, 0, 603, 407);
  return { id: color, name: "fixture.png", bitmap: await createImageBitmap(source), thumbUrl: "" };
}

describe("flip photo background and card edges", () => {
  for (const aspect of ["landscape", "portrait"] as const) {
    for (const resolutionScale of [0.3325, 1]) {
      it.each([false, true])(`${aspect} at ${resolutionScale}, gradient=%s: stays opaque with no black gaps or column seams`, async (gradient) => {
        const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
        compositor.setAspect(aspect);
        const photo = await makePhoto(gradient);
        const video = document.createElement("video");
        try {
          for (const k of [-3.99, -3, -2, -1, -0.05, 0, 0.05, 1, 2, 3, 3.99]) {
            compositor.draw(video, [photo], timeline, S + k * F, "flip");
            const { width: w, height: h } = compositor.canvas;
            const { data } = compositor.canvas.getContext("2d")!.getImageData(0, 0, w, h);
            let min = 255;
            let minAlpha = 255;
            let maxStep = 0;
            let maxColumnDip = 0;
            const fx = swapFx(S + k * F, timeline.slots, "flip", aspect);
            const left = Math.round((w - w * fx.flipWidth) / 2);
            const right = w - left;
            // クレジットを除き、背景・短冊境界・カード両縁を含む全列で測る。
            for (let y = 0; y < h * 0.8; y += 3) {
              for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                minAlpha = Math.min(minAlpha, data[i + 3]!);
                for (let c = 0; c < 3; c++) {
                  min = Math.min(min, data[i + c]!);
                }
              }
            }
            // 中央行ではカードの両縁だけが写真面と背景の正当な段差。
            // それ以外の全列を検査し、短冊の継ぎ目や背景の縦線を検出する。
            const row = Math.floor(h / 2);
            for (let x = 1; x < w; x++) {
              if (x === left || x === right) continue;
              for (let c = 0; c < 3; c++) {
                const i = (row * w + x) * 4 + c;
                // 極細カードでは写真のグラデーション自体が圧縮されるので、
                // 面内は隣接列から孤立した暗い列を検査。背景は隣接差を検査する。
                if (x < left || x > right) maxStep = Math.max(maxStep, Math.abs(data[i]! - data[i - 4]!));
                if (x > left && x < right - 1) {
                  maxColumnDip = Math.max(maxColumnDip, Math.min(data[i - 4]!, data[i + 4]!) - data[i]!);
                }
              }
            }
            expect(minAlpha, `k=${k}`).toBe(255);
            // 全列の明度下限で、下地 #0a0806 に近い 1px 列も拒否する。
            expect(min, `k=${k}`).toBeGreaterThan(40);
            expect(maxStep, `k=${k}`).toBeLessThanOrEqual(8);
            expect(maxColumnDip, `k=${k}`).toBeLessThanOrEqual(3);
            // 背景は暗い帯ではなく明るさを残した写真。均一色なら 0.65 倍＋発光。
            if (Math.abs(k) <= 2) {
              expect(data[(Math.floor(h / 2) * w) * 4]!).toBeGreaterThan(40);
              expect(data[(Math.floor(h / 2) * w + w - 1) * 4]!).toBeGreaterThan(40);
            }
            if (!gradient) {
              const flash = fx.flashGlobal > 0.002 ? fx.flashGlobal : 0;
              const pixel = (x: number, c: number) => data[(row * w + x) * 4 + c]!;
              const colors = [96, 128, 160];
              for (const [c, color] of colors.entries()) {
                if (left > 0) {
                  for (const x of [0, w - 1]) {
                    expect(Math.abs(pixel(x, c) - (color * 0.65 * (1 - flash) + 255 * flash)), `background k=${k} x=${x}`).toBeLessThanOrEqual(2);
                  }
                }
                if (right - left >= 4) {
                  // 縁のすぐ内側も中央も、背景が混ざらない不透明な写真＋陰影。
                  for (const x of [left + 1, Math.floor(w / 2), right - 2]) {
                    const u = (x + 0.5 - left) / (right - left);
                    const dark = fx.flipPerspective > 0 ? 1 - 0.85 * u : 0.15 + 0.85 * u;
                    const expected = color * (1 - fx.flipShade * dark) * (1 - flash) + 255 * flash;
                    expect(Math.abs(pixel(x, c) - expected), `opaque card k=${k} x=${x}`).toBeLessThanOrEqual(2);
                  }
                }
              }
            }
          }
          compositor.draw(video, [photo], timeline, 0.2, "flip");
          const still = compositor.canvas.toDataURL();
          compositor.draw(video, [photo], timeline, S - F, "flip");
          compositor.draw(video, [photo], timeline, 0.2, "flip");
          expect(compositor.canvas.toDataURL()).toBe(still);
        } finally {
          photo.bitmap.close();
          compositor.destroy();
        }
      });
    }

    it(`${aspect}: blurs only the background and reuses surfaces without readback`, async () => {
      const source = document.createElement("canvas");
      source.width = 603;
      source.height = 407;
      const ctx = source.getContext("2d")!;
      for (let y = 0; y < 407; y += 10) {
        for (let x = 0; x < 603; x += 10) {
          ctx.fillStyle = (x / 10 + y / 10) % 2 ? "rgb(200,200,200)" : "rgb(80,80,80)";
          ctx.fillRect(x, y, 10, 10);
        }
      }
      const photo = { id: "checker", name: "checker.png", bitmap: await createImageBitmap(source), thumbUrl: "" };
      const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      compositor.setAspect(aspect);
      const video = document.createElement("video");
      try {
        const allocation = vi.spyOn(document, "createElement");
        const readback = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
        try {
          for (let k = -4; k <= 4; k++) {
            compositor.draw(video, [photo], timeline, S + k * F, "flip");
          }
          expect(allocation).not.toHaveBeenCalled();
          expect(readback).not.toHaveBeenCalled();
        } finally {
          allocation.mockRestore();
          readback.mockRestore();
        }
        compositor.draw(video, [photo], timeline, S - 2 * F, "flip");
        const { width: w, height: h } = compositor.canvas;
        const data = compositor.canvas.getContext("2d")!.getImageData(0, Math.floor(h / 2), w, 1).data;
        const left = Math.round(w * (1 - swapFx(S - 2 * F, timeline.slots, "flip", aspect).flipWidth) / 2);
        const background = Array.from({ length: left - 2 }, (_, x) => data[x * 4]!);
        const card = Array.from({ length: w - 2 * left - 4 }, (_, x) => data[(left + 2 + x) * 4]!);
        expect(Math.max(...background) - Math.min(...background)).toBeLessThan(16);
        expect(Math.min(...background)).toBeGreaterThan(40);
        expect(Math.max(...card) - Math.min(...card)).toBeGreaterThan(60);
      } finally {
        photo.bitmap.close();
        compositor.destroy();
      }
    });

    it(`${aspect}: shows outgoing before edge-on and incoming from edge-on`, async () => {
      const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      compositor.setAspect(aspect);
      const outgoing = await makePhoto(false, "rgb(180,80,80)");
      const incoming = await makePhoto(false, "rgb(80,80,180)");
      try {
        for (const k of [-1, -0.001, 0, 0.001, 1]) {
          const time = S + k * F;
          expect(swapFx(time, timeline.slots, "flip", aspect).plateSlot).toBe(k < 0 ? 0 : 1);
          compositor.draw(document.createElement("video"), [outgoing, incoming], timeline, time, "flip");
          const { width: w, height: h } = compositor.canvas;
          for (const x of [0, Math.floor(w / 2), w - 1]) {
            const pixel = compositor.canvas.getContext("2d")!.getImageData(x, h / 2, 1, 1).data;
            expect(k < 0 ? pixel[0]! - pixel[2]! : pixel[2]! - pixel[0]!).toBeGreaterThan(55);
          }
        }
      } finally {
        outgoing.bitmap.close();
        incoming.bitmap.close();
        compositor.destroy();
      }
    });
  }
});
