import { expect, it, vi } from "vitest";
import { applySoftwareBlur, releaseSoftwareBlurBuffers } from "./blur.ts";

for (const px of [1.664, 4.992, 11.136]) it(`sigma=${px}: reuses float buffers and canvas storage across frames without retaining old pixels`, () => {
  const scratch = document.createElement("canvas");
  const scratchCtx = scratch.getContext("2d", { willReadFrequently: true })!;
  const cases = [[64, 36, 0], [64, 36, 1], [96, 54, 2], [96, 54, 3], [54, 96, 4]] as const;
  const draw = (width: number, height: number, frame: number, buffer: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const target = document.createElement("canvas");
    target.width = width;
    target.height = height;
    const targetCtx = target.getContext("2d")!;
    try {
      targetCtx.fillStyle = frame % 2 ? "#d467af" : "#124781";
      targetCtx.fillRect(0, 0, width, height);
      targetCtx.fillStyle = "#f7ec85";
      targetCtx.fillRect(frame * 7, frame * 3, width / 2, height / 2);
      applySoftwareBlur(target, targetCtx, buffer, ctx, px);
      return targetCtx.getImageData(0, 0, width, height).data;
    } finally {
      target.width = target.height = 0;
    }
  };
  // 毎回新しく確保した経路と比較し、前フレームや縦横切替の残像を検出する。
  const expected = cases.map(([width, height, frame]) => {
    const fresh = document.createElement("canvas");
    try {
      return draw(width, height, frame, fresh, fresh.getContext("2d", { willReadFrequently: true })!);
    } finally {
      releaseSoftwareBlurBuffers(fresh);
      fresh.width = fresh.height = 0;
    }
  });
  // ネイティブTypedArrayを直接spyにすると内部スロットのないインスタンスになり、
  // .set()が例外になる。実物を返すコンストラクタで確保回数だけ測る。
  const NativeFloat32Array = globalThis.Float32Array;
  const allocations = vi.fn(function (length: number) { return new NativeFloat32Array(length); });
  vi.stubGlobal("Float32Array", allocations);
  const resizeWidth = vi.spyOn(scratch, "width", "set");
  const resizeHeight = vi.spyOn(scratch, "height", "set");
  try {
    cases.forEach(([width, height, frame], index) => {
      expect(draw(width, height, frame, scratch, scratchCtx), `frame ${index}`).toEqual(expected[index]);
      expect(allocations).toHaveBeenCalledTimes([2, 2, 4, 4, 4][index]!);
      expect(resizeWidth).toHaveBeenCalledTimes([1, 1, 2, 2, 3][index]!);
      expect(resizeHeight).toHaveBeenCalledTimes([1, 1, 2, 2, 3][index]!);
    });
    releaseSoftwareBlurBuffers(scratch);
    expect(draw(54, 96, 4, scratch, scratchCtx)).toEqual(expected[4]);
    expect(allocations).toHaveBeenCalledTimes(6);
  } finally {
    vi.unstubAllGlobals();
    resizeWidth.mockRestore();
    resizeHeight.mockRestore();
    releaseSoftwareBlurBuffers(scratch);
    scratch.width = scratch.height = 0;
  }
});
