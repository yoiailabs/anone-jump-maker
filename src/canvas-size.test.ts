import { describe, expect, it } from "vitest";
import { ensureCanvasSize } from "./canvas-size.ts";

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
