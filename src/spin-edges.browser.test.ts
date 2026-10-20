import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCompositor } from "./compositor.ts";
import { OUTPUTS, swapFx, zoomTransitionScale } from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";

vi.mock("./layout.ts", { spy: true });
beforeEach(() => {
  // 写真層だけを検査する。クレジットの影はフォントによって最外周まで届くため、矩形では除外できない。
  // 文字描画だけを止め、Canvas の補間・回転・平均合成は実ブラウザで全画素を検査する。
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(() => {});
});
afterEach(() => {
  vi.mocked(swapFx).mockReset();
  vi.restoreAllMocks();
});

const S = 0.5;
const F = 1 / 30;
const timeline = { slots: [0, S, 1] };
const UNIFORM_COLOR = [96, 128, 160];
const phases = [-3.01, -2.99, -2, -1, -0.01, 0, 0.5, 1, 2, 3, 4.99, 5, 7];

async function makePhoto(w: number, h: number, gradient: boolean): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const fill = ctx.createLinearGradient(0, 0, w, h);
  fill.addColorStop(0, "rgb(70, 100, 130)");
  fill.addColorStop(1, "rgb(170, 200, 230)");
  ctx.fillStyle = gradient ? fill : "rgb(96, 128, 160)";
  ctx.fillRect(0, 0, w, h);
  return { id: "spin", name: "spin.png", bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}

function pixels(canvas: HTMLCanvasElement): ImageData {
  return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
}

describe("spin plate edges", () => {
  for (const mode of ["landscape", "portrait"] as const) {
    for (const resolutionScale of [1 / 3, 0.3325, 1]) {
      it.each([[1920, 1080], [1080, 1920], [303, 303]])(`${mode} at ${resolutionScale}: covers every pixel of a %i×%i photo while rotating and blurring`, async (photoW, photoH) => {
        const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
        compositor.setAspect(mode);
        const photo = await makePhoto(photoW, photoH, false);
        const video = document.createElement("video");
        try {
          for (const tau of phases) {
            compositor.draw(video, [photo], timeline, S + tau * zoomTransitionScale(mode) * F, "spin");
            const { width: w, height: h, data } = pixels(compositor.canvas);
            let maxError = 0;
            let minAlpha = 255;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              for (let c = 0; c < 3; c++) maxError = Math.max(maxError, Math.abs(data[i + c]! - UNIFORM_COLOR[c]!));
              minAlpha = Math.min(minAlpha, data[i + 3]!);
            }
            expect(maxError, `τ=${tau}`).toBeLessThanOrEqual(2);
            expect(minAlpha, `τ=${tau}`).toBe(255);
          }
        } finally {
          photo.bitmap.close();
          compositor.destroy();
        }
      });
    }

    it(`${mode}: keeps gradients smooth throughout the frame and restores identical still pixels`, async () => {
      const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      compositor.setAspect(mode);
      const { width, height } = OUTPUTS[mode];
      const photo = await makePhoto(width, height, true);
      const video = document.createElement("video");
      try {
        compositor.draw(video, [photo], timeline, 0.2, "spin");
        const before = pixels(compositor.canvas).data.slice();
        for (const tau of phases) {
          compositor.draw(video, [photo], timeline, S + tau * zoomTransitionScale(mode) * F, "spin");
          const { width: w, height: h, data } = pixels(compositor.canvas);
          let edgeStep = 0;
          let innerStep = 0;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            for (const offset of [x > 0 ? 4 : 0, y > 0 ? w * 4 : 0]) {
              for (let c = 0; c < 3; c++) {
                const step = Math.abs(data[i + c]! - data[i - offset + c]!);
                if (x < w * 0.15 || x > w * 0.85 || y < h * 0.15 || y > h * 0.85) edgeStep = Math.max(edgeStep, step);
                else innerStep = Math.max(innerStep, step);
              }
            }
          }
          // 8bit の平均合成による丸め差を含めて検査する。
          // #159 と同じ上限 3 に加え、端だけに不連続が増えないことも検査する。
          expect(edgeStep, `τ=${tau}, interior=${innerStep}`).toBeLessThanOrEqual(innerStep + 1);
          expect(Math.max(edgeStep, innerStep), `τ=${tau}`).toBeLessThanOrEqual(3);
        }
        compositor.draw(video, [photo], timeline, 0.2, "spin");
        expect(pixels(compositor.canvas).data).toEqual(before);
      } finally {
        photo.bitmap.close();
        compositor.destroy();
      }
    });

    it(`${mode}: softens spokes along the rotation direction`, async () => {
      const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      compositor.setAspect(mode);
      const source = document.createElement("canvas");
      source.width = source.height = 600;
      const ctx = source.getContext("2d")!;
      for (let i = 0; i < 48; i++) {
        ctx.beginPath();
        ctx.moveTo(300, 300);
        ctx.arc(300, 300, 600, i * Math.PI / 24, (i + 1) * Math.PI / 24);
        ctx.fillStyle = i % 2 ? "white" : "black";
        ctx.fill();
      }
      const photo = { id: "spokes", name: "spokes.png", bitmap: await createImageBitmap(source), thumbUrl: "" };
      const video = document.createElement("video");
      const time = S - F;
      const contrast = () => {
        const { width: w, height: h, data } = pixels(compositor.canvas);
        let sum = 0;
        for (let degree = 0; degree < 360; degree++) {
          const theta = degree * Math.PI / 180;
          const r = Math.min(w, h) * 0.3;
          const x = Math.round(w / 2 + r * Math.cos(theta));
          const y = Math.round(h / 2 + r * Math.sin(theta));
          sum += (data[(y * w + x) * 4]! - 127.5) ** 2;
        }
        return Math.sqrt(sum / 360);
      };
      try {
        compositor.draw(video, [photo], timeline, time, "spin");
        const blurred = contrast();
        vi.mocked(swapFx).mockReturnValueOnce({ ...swapFx(time, timeline.slots, "spin", mode), rotationBlur: 0 });
        compositor.draw(video, [photo], timeline, time, "spin");
        expect(blurred).toBeLessThan(contrast() * 0.8);
      } finally {
        photo.bitmap.close();
        compositor.destroy();
      }
    });
  }
});
