import { describe, expect, it } from "vitest";
import { OUTPUTS, outputSize } from "./layout.ts";
import {
  ensureCanvasSize,
  PORTRAIT_PREVIEW_RESOLUTION_SCALE,
  PREVIEW_RESOLUTION_SCALE,
  previewResolutionScale,
  scaleCanvasSize,
} from "./canvas-size.ts";

describe("ensureCanvasSize", () => {
  it("does not rewrite the bitmap when the size is already correct", () => {
    const writes: Array<[number, number]> = [];
    const canvas = {
      _w: 608,
      _h: 1080,
      get width() {
        return this._w;
      },
      set width(value: number) {
        writes.push([value, this._h]);
        this._w = value;
      },
      get height() {
        return this._h;
      },
      set height(value: number) {
        writes.push([this._w, value]);
        this._h = value;
      },
    };
    expect(ensureCanvasSize(canvas, 608, 1080)).toBe(false);
    expect(writes).toEqual([]);
  });

  it("resizes when the aspect changes", () => {
    const canvas = { width: 608, height: 1080 };
    expect(ensureCanvasSize(canvas, 1280, 720)).toBe(true);
    expect(canvas).toEqual({ width: 1280, height: 720 });
  });
});

describe("PREVIEW_RESOLUTION_SCALE", () => {
  it("keeps landscape at half and portrait at a third", () => {
    expect(PREVIEW_RESOLUTION_SCALE).toBe(0.5);
    expect(PORTRAIT_PREVIEW_RESOLUTION_SCALE).toBeCloseTo(1 / 3, 12);
    expect(previewResolutionScale("landscape")).toBe(PREVIEW_RESOLUTION_SCALE);
    expect(previewResolutionScale("portrait")).toBe(PORTRAIT_PREVIEW_RESOLUTION_SCALE);
    expect(previewResolutionScale("portrait")).toBeLessThan(previewResolutionScale("landscape"));
  });

  it("matches landscape preview pixels and leaves export at 1080x1920", () => {
    expect(outputSize("portrait")).toEqual({ width: 1080, height: 1920 });
    expect(outputSize("landscape")).toEqual({ width: 1280, height: 720 });
    const portrait = scaleCanvasSize(
      OUTPUTS.portrait.width,
      OUTPUTS.portrait.height,
      previewResolutionScale("portrait"),
    );
    const landscape = scaleCanvasSize(
      OUTPUTS.landscape.width,
      OUTPUTS.landscape.height,
      previewResolutionScale("landscape"),
    );
    expect(portrait).toEqual({ width: 360, height: 640 });
    expect(landscape).toEqual({ width: 640, height: 360 });
    expect(portrait.width * portrait.height).toBe(landscape.width * landscape.height);
    expect(scaleCanvasSize(1280, 720, 1)).toEqual({ width: 1280, height: 720 });
    expect(scaleCanvasSize(1080, 1920, 1)).toEqual({ width: 1080, height: 1920 });
  });

  it("rejects a non-positive scale so a caller cannot shrink export to zero", () => {
    expect(scaleCanvasSize(1280, 720, 0)).toEqual({ width: 1280, height: 720 });
    expect(scaleCanvasSize(1280, 720, Number.NaN)).toEqual({ width: 1280, height: 720 });
  });
});
