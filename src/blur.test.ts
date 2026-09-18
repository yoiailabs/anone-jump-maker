import { describe, expect, it } from "vitest";
import {
  CANVAS_FILTER_BLUR,
  EXPORT_BLUR_QUALITY,
  PREVIEW_BLUR_QUALITY,
  PREVIEW_SOFTWARE_BLUR_DOWNSCALE,
  PREVIEW_SOFTWARE_BLUR_PASSES,
  PREVIEW_SOFTWARE_BLUR_RADIUS_SCALE,
  SOFTWARE_BLUR_PASSES,
  SOFTWARE_BLUR_QUALITY,
  boxBlurRgba,
  isSoftwareBlurQuality,
  resolveSoftwareBlurSettings,
  softwareBlurDownscale,
  type SoftwareBlurQuality,
} from "./blur.ts";
import { PREVIEW_RESOLUTION_SCALE, scaleCanvasSize } from "./canvas-size.ts";
import { filterBlurPx, type ImageFilter } from "./layout.ts";

/** 縮小バッファ画素 × パス数。ぼかしホットパスの粗い見積もり。 */
function blurPaintWork(
  width: number,
  height: number,
  quality: SoftwareBlurQuality,
  filter: ImageFilter,
): number {
  const px = filterBlurPx(filter, Math.max(width, height));
  const settings = resolveSoftwareBlurSettings(px, quality);
  const sw = Math.max(8, Math.round(width * settings.downscale));
  const sh = Math.max(8, Math.round(height * settings.downscale));
  return sw * sh * settings.passes;
}

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
});

describe("preview vs export blur quality", () => {
  it("gates preview as a named cheaper mode and forces full quality on export", () => {
    expect(EXPORT_BLUR_QUALITY).toBe(SOFTWARE_BLUR_QUALITY.full);
    expect(PREVIEW_BLUR_QUALITY).toBe(SOFTWARE_BLUR_QUALITY.preview);
    expect(EXPORT_BLUR_QUALITY).not.toBe(PREVIEW_BLUR_QUALITY);
    expect(isSoftwareBlurQuality("full")).toBe(true);
    expect(isSoftwareBlurQuality("preview")).toBe(true);
    expect(isSoftwareBlurQuality("half")).toBe(false);
    expect(SOFTWARE_BLUR_PASSES).toBe(2);
    expect(PREVIEW_SOFTWARE_BLUR_PASSES).toBe(1);
    expect(PREVIEW_SOFTWARE_BLUR_RADIUS_SCALE).toBe(0.5);
    expect(PREVIEW_SOFTWARE_BLUR_DOWNSCALE).toBe(0.5);
  });

  it("keeps export settings identical to the current full software blur", () => {
    for (const filter of ["blur-weak", "blur-strong"] as const) {
      const px = filterBlurPx(filter, 1280);
      const full = resolveSoftwareBlurSettings(px, EXPORT_BLUR_QUALITY);
      const omitted = resolveSoftwareBlurSettings(px);
      expect(px).toBeGreaterThan(0);
      expect(full).toEqual({
        quality: "full",
        px,
        passes: SOFTWARE_BLUR_PASSES,
        downscale: softwareBlurDownscale(px),
      });
      expect(omitted).toEqual(full);
    }
  });

  it("uses half radius, one pass, and a stronger downscale on preview", () => {
    for (const filter of ["blur-weak", "blur-strong"] as const) {
      const px = filterBlurPx(filter, 1280);
      const preview = resolveSoftwareBlurSettings(px, PREVIEW_BLUR_QUALITY);
      const full = resolveSoftwareBlurSettings(px, EXPORT_BLUR_QUALITY);
      expect(preview.passes).toBe(PREVIEW_SOFTWARE_BLUR_PASSES);
      expect(preview.passes).toBeLessThan(full.passes);
      expect(preview.px).toBe(Math.max(1, Math.round(px * PREVIEW_SOFTWARE_BLUR_RADIUS_SCALE)));
      expect(preview.px).toBeLessThan(full.px);
      expect(preview.downscale).toBeLessThan(full.downscale);
      expect(preview.downscale).toBeCloseTo(softwareBlurDownscale(px) * PREVIEW_SOFTWARE_BLUR_DOWNSCALE, 8);
    }
  });

  it("keeps preview blur-strong heavier than preview blur-weak, and cheaper than export", () => {
    const weakPx = filterBlurPx("blur-weak", 1280);
    const strongPx = filterBlurPx("blur-strong", 1280);
    const previewWeak = resolveSoftwareBlurSettings(weakPx, PREVIEW_BLUR_QUALITY);
    const previewStrong = resolveSoftwareBlurSettings(strongPx, PREVIEW_BLUR_QUALITY);
    const exportStrong = resolveSoftwareBlurSettings(strongPx, EXPORT_BLUR_QUALITY);
    expect(strongPx).toBeGreaterThan(weakPx);
    expect(previewStrong.px).toBeGreaterThan(previewWeak.px);
    const previewWork = 1280 * 720 * previewStrong.downscale ** 2 * previewStrong.passes;
    const exportWork = 1280 * 720 * exportStrong.downscale ** 2 * exportStrong.passes;
    expect(previewWork).toBeLessThan(exportWork * 0.3);
  });

  it("is cheaper than main's 0.5× preview that still used full 2-pass blur", () => {
    const exportSize = { width: 1280, height: 720 };
    const previewSize = scaleCanvasSize(exportSize.width, exportSize.height, PREVIEW_RESOLUTION_SCALE);
    expect(previewSize).toEqual({ width: 640, height: 360 });
    const mainPreview = blurPaintWork(previewSize.width, previewSize.height, EXPORT_BLUR_QUALITY, "blur-strong");
    const thisPreview = blurPaintWork(previewSize.width, previewSize.height, PREVIEW_BLUR_QUALITY, "blur-strong");
    const exportWork = blurPaintWork(exportSize.width, exportSize.height, EXPORT_BLUR_QUALITY, "blur-strong");
    expect(thisPreview).toBeLessThan(mainPreview);
    expect(thisPreview).toBeLessThan(mainPreview * 0.3);
    expect(thisPreview).toBeLessThan(exportWork);
    expect(mainPreview).toBeLessThan(exportWork);
  });

  it("does not change the requested filter radius used by export", () => {
    expect(filterBlurPx("blur-weak", 720)).toBe(Math.max(2, Math.round(720 * 0.005)));
    expect(filterBlurPx("blur-strong", 1280)).toBe(Math.max(2, Math.round(1280 * 0.011)));
    expect(resolveSoftwareBlurSettings(0, PREVIEW_BLUR_QUALITY).passes).toBe(0);
    expect(resolveSoftwareBlurSettings(0, EXPORT_BLUR_QUALITY)).toEqual({
      quality: "full",
      px: 0,
      passes: 0,
      downscale: 1,
    });
  });
});
