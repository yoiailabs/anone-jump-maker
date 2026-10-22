import { expect, it, vi } from "vitest";
import { applySoftwareBlur, releaseSoftwareBlurBuffers } from "./blur.ts";

const dimensions = [1, 2, 3, 4, 5, 6, 7, 16];

for (const px of [0.0001, 0.01, 1, 8]) {
  it(`sigma=${px}: keeps tiny work canvases within the source and preserves pixels at tiny sigma`, () => {
    for (const width of dimensions) for (const height of dimensions) {
      if (width === 16 && height === 16) continue;
      const target = document.createElement("canvas");
      const scratch = document.createElement("canvas");
      target.width = width;
      target.height = height;
      const ctx = target.getContext("2d", { willReadFrequently: true })!;
      const scratchCtx = scratch.getContext("2d", { willReadFrequently: true })!;
      const readback = vi.spyOn(scratchCtx, "getImageData");
      const label = `${width}x${height}, sigma=${px}`;
      try {
        // 画素ごとに色を変え、拡大・再縮小で生じる補間ボケを検出する。
        const input = ctx.createImageData(width, height);
        for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          input.data[i] = (x + y) % 2 ? 255 : 0;
          input.data[i + 1] = x % 2 ? 255 : 0;
          input.data[i + 2] = y % 2 ? 255 : 0;
          input.data[i + 3] = 255;
        }
        ctx.putImageData(input, 0, 0);
        applySoftwareBlur(target, ctx, scratch, scratchCtx, px);
        if (px < 1) {
          const output = ctx.getImageData(0, 0, width, height).data;
          const maxDifference = output.reduce((max, value, i) => Math.max(max, Math.abs(value - input.data[i]!)), 0);
          // 8bitの丸め1階調だけを許容し、σに無関係な画素の混合を防ぐ。
          expect(maxDifference, label).toBeLessThanOrEqual(1);
          expect([scratch.width, scratch.height], label).toEqual([width, height]);
          expect(readback, label).toHaveBeenCalledExactlyOnceWith(0, 0, width, height);
        } else {
          expect(scratch.width, label).toBeLessThanOrEqual(width);
          expect(scratch.height, label).toBeLessThanOrEqual(height);
          expect(readback, label).toHaveBeenCalledTimes(1);
          const [, , sw, sh] = readback.mock.calls[0]!;
          expect(sw, label).toBeLessThanOrEqual(width);
          expect(sh, label).toBeLessThanOrEqual(height);
        }
      } finally {
        readback.mockRestore();
        releaseSoftwareBlurBuffers(scratch);
        target.width = target.height = scratch.width = scratch.height = 0;
      }
    }
  });
}
