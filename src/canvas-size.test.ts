import { describe, expect, it } from "vitest";
import { OUTPUTS, outputSize } from "./layout.ts";
import { ensureCanvasSize, PREVIEW_RESOLUTION_SCALE, scaleCanvasSize } from "./canvas-size.ts";

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
  it("is a named 0.5× preview-only scale", () => {
    expect(PREVIEW_RESOLUTION_SCALE).toBe(0.5);
    expect(PREVIEW_RESOLUTION_SCALE).toBeLessThan(1);
  });

  it("halves the live bitmap and leaves export size at the template resolution", () => {
    expect(outputSize("portrait")).toEqual({ width: 608, height: 1080 });
    expect(outputSize("landscape")).toEqual({ width: 1280, height: 720 });
    expect(scaleCanvasSize(OUTPUTS.portrait.width, OUTPUTS.portrait.height, PREVIEW_RESOLUTION_SCALE)).toEqual({
      width: 304,
      height: 540,
    });
    expect(scaleCanvasSize(OUTPUTS.landscape.width, OUTPUTS.landscape.height, PREVIEW_RESOLUTION_SCALE)).toEqual({
      width: 640,
      height: 360,
    });
    expect(scaleCanvasSize(1280, 720, 1)).toEqual({ width: 1280, height: 720 });
    expect(scaleCanvasSize(608, 1080, 1)).toEqual({ width: 608, height: 1080 });
  });

  it("rejects a non-positive scale so a caller cannot shrink export to zero", () => {
    expect(scaleCanvasSize(1280, 720, 0)).toEqual({ width: 1280, height: 720 });
    expect(scaleCanvasSize(1280, 720, Number.NaN)).toEqual({ width: 1280, height: 720 });
  });
});
