import { describe, expect, it } from "vitest";
import { applySoftwareBlur } from "./blur.ts";
import { filterBlurPx } from "./layout.ts";
import { applyLegacyBlur } from "./test-support/legacy-blur.ts";

type Blur = typeof applySoftwareBlur;
const filters = ["blur-weak", "blur-strong"] as const;

function surface(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function span(values: number[]) {
  return Math.max(...values) - Math.min(...values);
}

/** 縞を2.25pxずつ移動し、端の影響を除いた平均と8px局所平均の時間方向の振幅を測る。 */
function flicker(blur: Blur, long: number, px: number, period: number, vertical: boolean) {
  const target = surface(vertical ? long : 64, vertical ? 64 : long);
  const scratch = surface(1, 1);
  const means: number[] = [];
  const locals = Array.from({ length: 16 }, () => [] as number[]);
  const start = Math.round(long / 4);
  const end = Math.round(long * 3 / 4);
  try {
    const image = target.ctx.createImageData(target.canvas.width, target.canvas.height);
    for (let frame = 0; frame < 12; frame++) {
      for (let y = 0; y < target.canvas.height; y++) for (let x = 0; x < target.canvas.width; x++) {
        const v = Math.round(127.5 + 127.5 * Math.cos(2 * Math.PI * ((vertical ? x : y) - frame * 2.25) / period));
        const i = (y * target.canvas.width + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
        image.data[i + 3] = 255;
      }
      target.ctx.putImageData(image, 0, 0);
      blur(target.canvas, target.ctx, scratch.canvas, scratch.ctx, px);
      const { data } = vertical
        ? target.ctx.getImageData(0, 32, long, 1)
        : target.ctx.getImageData(32, 0, 1, long);
      let mean = 0;
      for (let i = start; i < end; i++) mean += data[i * 4]!;
      means.push(mean / (end - start));
      locals.forEach((values, index) => {
        const position = start + Math.floor((end - start - 8) * index / (locals.length - 1));
        let value = 0;
        for (let i = position; i < position + 8; i++) value += data[i * 4]!;
        values.push(value / 8);
      });
    }
    return { mean: span(means), local: Math.max(...locals.map(span)) };
  } finally {
    target.canvas.width = target.canvas.height = scratch.canvas.width = scratch.canvas.height = 0;
  }
}

describe("photo blur stability", () => {
  for (const long of [640, 1920]) for (const filter of filters) {
    it(`${long}/${filter}: suppresses temporal aliasing of moving high frequency stripes`, () => {
      // 旧一段縮小の共振周期12.48pxと、新縮小グリッド付近も含める。
      const periods = [2, 2.5, 3, 4, 4.896, 5, 5.376, 6, 8, 10, 11.136, 12.48, 14].map((period) => period * long / 1920).filter((period) => period >= 2);
      const px = filterBlurPx(filter, long);
      const oldPx = Math.max(2, Math.round(long * (filter === "blur-weak" ? 0.005 : 0.011)));
      for (const vertical of [true, false]) for (const period of periods) {
        const old = flicker(applyLegacyBlur, long, oldPx, period, vertical);
        const current = flicker(applySoftwareBlur, long, px, period, vertical);
        console.log(JSON.stringify({ long, filter, period, axis: vertical ? "x" : "y", old, current }));
        // 縮小・最終8bit化・再補間の量子化分だけ許容する（平均1、局所2 / 255）。
        expect.soft(current.mean, `period=${period}, mean`).toBeLessThanOrEqual(old.mean + 1);
        expect.soft(current.local, `period=${period}, local`).toBeLessThanOrEqual(old.local + 2);
      }
    });
  }
});
