import { describe, expect, it } from "vitest";
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
            // クレジットを除き、背景・短冊境界・カード両縁を含む全列で測る。
            for (let y = 0; y < h * 0.8; y += 3) {
              for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                minAlpha = Math.min(minAlpha, data[i + 3]!);
                for (let c = 0; c < 3; c++) {
                  min = Math.min(min, data[i + c]!);
                  if (x > 0) maxStep = Math.max(maxStep, Math.abs(data[i + c]! - data[i + c - 4]!));
                }
              }
            }
            expect(minAlpha, `k=${k}`).toBe(255);
            expect(min, `k=${k}`).toBeGreaterThan(40);
            expect(maxStep, `k=${k}`).toBeLessThanOrEqual(8);
            // 横に露出した領域は等倍の写真そのもの。縁に隠れた暗い帯も許さない。
            if (Math.abs(k) <= 2) {
              expect(data[(Math.floor(h / 2) * w) * 4]!).toBeGreaterThan(60);
              expect(data[(Math.floor(h / 2) * w + w - 1) * 4]!).toBeGreaterThan(60);
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
          const pixel = compositor.canvas.getContext("2d")!.getImageData(w / 2, h / 2, 1, 1).data;
          expect(k < 0 ? pixel[0]! - pixel[2]! : pixel[2]! - pixel[0]!).toBeGreaterThan(70);
        }
      } finally {
        outgoing.bitmap.close();
        incoming.bitmap.close();
        compositor.destroy();
      }
    });
  }
});
