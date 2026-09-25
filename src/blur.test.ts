import { describe, expect, it } from "vitest";
import {
  CANVAS_FILTER_BLUR,
  applySoftwareBlur,
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

  it("does not reallocate the downscale buffer when its size stays the same", () => {
    const target = fakeBlurCanvas(100, 80);
    const scratch = fakeBlurCanvas(0, 0);
    applySoftwareBlur(
      target.canvas,
      target.ctx,
      scratch.canvas,
      scratch.ctx,
      8,
    );
    expect(scratch.canvas.widthWrites).toBe(1);
    expect(scratch.canvas.heightWrites).toBe(1);
    const width = scratch.canvas.width;
    const height = scratch.canvas.height;

    applySoftwareBlur(
      target.canvas,
      target.ctx,
      scratch.canvas,
      scratch.ctx,
      8,
    );
    expect(scratch.canvas.widthWrites).toBe(1);
    expect(scratch.canvas.heightWrites).toBe(1);
    expect(scratch.canvas.width).toBe(width);
    expect(scratch.canvas.height).toBe(height);

    target.canvas.width = 40;
    target.canvas.height = 40;
    applySoftwareBlur(
      target.canvas,
      target.ctx,
      scratch.canvas,
      scratch.ctx,
      40,
    );
    expect(scratch.canvas.widthWrites).toBe(2);
    expect(scratch.canvas.heightWrites).toBe(2);
    expect(scratch.canvas.width).not.toBe(width);
  });
});

function fakeBlurCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement & { widthWrites: number; heightWrites: number };
  ctx: CanvasRenderingContext2D;
} {
  let w = width;
  let h = height;
  const canvas = {
    widthWrites: 0,
    heightWrites: 0,
    get width() {
      return w;
    },
    set width(value: number) {
      this.widthWrites += 1;
      w = value;
    },
    get height() {
      return h;
    },
    set height(value: number) {
      this.heightWrites += 1;
      h = value;
    },
  };
  const ctx = {
    canvas,
    imageSmoothingEnabled: true,
    filter: "none",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    setTransform() {},
    drawImage() {},
    getImageData(_x: number, _y: number, iw: number, ih: number) {
      return {
        data: new Uint8ClampedArray(iw * ih * 4).fill(255),
        width: iw,
        height: ih,
      };
    },
    putImageData() {},
  };
  return {
    canvas: canvas as unknown as HTMLCanvasElement & { widthWrites: number; heightWrites: number },
    ctx: ctx as unknown as CanvasRenderingContext2D,
  };
}
