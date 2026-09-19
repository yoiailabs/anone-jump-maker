import { describe, expect, it } from "vitest";
import {
  CANVAS_FILTER_BLUR,
  boxBlurRgba,
  softwareBlurDownscale,
} from "./blur.ts";

describe("software blur", () => {
  it("does not rely on Canvas2D filter, which Safari / iOS disable", () => {
    expect(CANVAS_FILTER_BLUR).toBe("unsupported-on-safari");
  });

  it("softens a hard edge so iOS gets the same bokeh without ctx.filter", () => {
    const w = 16;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        const v = x < 8 ? 0 : 255;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    boxBlurRgba(data, w, h, 2);
    expect(data[7 * 4]).toBeGreaterThan(0);
    expect(data[8 * 4]).toBeLessThan(255);
    expect(data[3]!).toBe(255);
  });

  it("downscales more for a stronger radius", () => {
    expect(softwareBlurDownscale(0)).toBe(1);
    expect(softwareBlurDownscale(24)).toBeLessThan(softwareBlurDownscale(8));
  });

  it("leaves pixels alone when the radius is under 1", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255]);
    boxBlurRgba(data, 2, 1, 0);
    expect([...data]).toEqual([255, 0, 0, 255, 0, 0, 0, 255]);
  });
});
