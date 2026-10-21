import { describe, expect, it } from "vitest";
import {
  CANVAS_FILTER_BLUR,
  boxBlurRgba,
  softwareBlurDownscale,
  softwareBlurPasses,
  softwareBlurRadius,
} from "./blur.ts";
import { filterBlurPx } from "./layout.ts";

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
    expect(softwareBlurDownscale(filterBlurPx("blur-weak", 640))).toBe(0.5);
    expect(softwareBlurDownscale(24)).toBeLessThan(softwareBlurDownscale(6));
  });

  it("avoids a resampling blur floor for small sigmas and matches variance across downscale thresholds", () => {
    for (const px of [0.01, 0.5, Math.sqrt(0.75), 0.9, 0.9999, 1, 1.0001, 1.632, 1.9999, 2, 7.9999, 8]) {
      const down = softwareBlurDownscale(px);
      const resampleVariance = (1 / down ** 2 - 1) / 4;
      expect(resampleVariance).toBeLessThanOrEqual(px ** 2);
      const kernel = softwareBlurRadius(px);
      const r = Math.floor(kernel);
      const t = kernel - r;
      const variance = (r * (r + 1) * (2 * r + 1) / 3 + 2 * t * (r + 1) ** 2) / (2 * r + 1 + 2 * t);
      expect(variance * softwareBlurPasses(px) / down ** 2 + resampleVariance).toBeCloseTo(px ** 2, 8);
    }
    expect(softwareBlurDownscale(0.85)).toBe(1);
  });

  for (const filter of ["blur-weak", "blur-strong"] as const) {
    it(`${filter}: matches target variance including resampling at preview and export sizes`, () => {
      for (const long of [360, 640, 1080, 1920]) {
        const px = filterBlurPx(filter, long);
        const kernel = softwareBlurRadius(px);
        const radius = Math.floor(kernel);
        const weight = kernel - radius;
        const down = softwareBlurDownscale(px);
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThan(1);
        expect([1, 0.5, 0.25]).toContain(down);
        const variance = softwareBlurPasses(px) * (radius * (radius + 1) * (2 * radius + 1) / 3 + 2 * weight * (radius + 1) ** 2) / (2 * radius + 1 + 2 * weight);
        const resampleVariance = (1 / down ** 2 - 1) / 4;
        // 実際のバッファ寸法の丸めも含めたフル解像度のσ。
        const effectiveSigma = Math.sqrt(variance * (long / Math.round(long * down)) ** 2 + resampleVariance);
        expect(effectiveSigma / px).toBeCloseTo(1, 2);
      }
    });
  }

  it("applies fractional outer taps with only final 8bit rounding", () => {
    const width = 9;
    const data = new Uint8ClampedArray(width * 4);
    data[4 * 4] = 255;
    // r=1、外周±2が0.5。1パスの重みは [0.5,1,1,1,0.5]/4。
    boxBlurRgba(data, width, 1, 1.5, 1);
    expect(Array.from({ length: width }, (_, x) => data[x * 4])).toEqual([0, 0, 32, 64, 64, 64, 32, 0, 0]);
  });

  it("supports sigmas below the smallest integer kernel without a pixel floor", () => {
    const radius = softwareBlurRadius(0.5);
    expect(radius).toBeGreaterThan(0);
    expect(radius).toBeLessThan(1);
    expect(softwareBlurDownscale(0.5)).toBe(1);
  });

  it("leaves pixels alone when the radius is zero", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255]);
    boxBlurRgba(data, 2, 1, 0);
    expect([...data]).toEqual([255, 0, 0, 255, 0, 0, 0, 255]);
  });
});
