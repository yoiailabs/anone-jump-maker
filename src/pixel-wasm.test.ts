// @ts-nocheck Node fs is available in vitest; app tsconfig has no @types/node.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { boxBlurRgbaJs } from "./blur.ts";
import { keyImageDataJs } from "./keying.ts";
import {
  boxBlurRgbaWasm,
  isPixelWasmReady,
  keyImageDataWasm,
  loadPixelWasm,
  PIXEL_ENGINE_WASM,
  pixelEngine,
  unloadPixelWasm,
} from "./pixel-wasm.ts";

const wasmPath = join(dirname(fileURLToPath(import.meta.url)), "wasm/pixel.wasm");

function solidImage(width: number, height: number, rgb: [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

function edgeImage(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const v = x < width / 2 ? 0 : 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

afterEach(() => {
  unloadPixelWasm();
});

describe("pixel wasm module", () => {
  it("loads the committed wasm and reports the wasm engine", async () => {
    expect(isPixelWasmReady()).toBe(false);
    expect(pixelEngine()).toBe("js");
    const bytes = await readFile(wasmPath);
    expect(await loadPixelWasm(bytes)).toBe(true);
    expect(isPixelWasmReady()).toBe(true);
    expect(pixelEngine()).toBe(PIXEL_ENGINE_WASM);
  });

  it("keys a flat teal plate the same as the JS reference", async () => {
    const bytes = await readFile(wasmPath);
    expect(await loadPixelWasm(bytes)).toBe(true);
    const js = solidImage(24, 16, [68, 155, 163]);
    const wasm = solidImage(24, 16, [68, 155, 163]);
    keyImageDataJs(js);
    expect(keyImageDataWasm(wasm)).toBe(true);
    expectMaxDelta(js.data, wasm.data, 1);
    expect(wasm.data[3]).toBe(0);
  });

  it("keeps dark line art opaque like the JS key", async () => {
    const bytes = await readFile(wasmPath);
    expect(await loadPixelWasm(bytes)).toBe(true);
    const js = solidImage(16, 12, [68, 155, 163]);
    const wasm = solidImage(16, 12, [68, 155, 163]);
    paintDot(js.data, 16, 6, 6, [8, 8, 8]);
    paintDot(wasm.data, 16, 6, 6, [8, 8, 8]);
    keyImageDataJs(js);
    expect(keyImageDataWasm(wasm)).toBe(true);
    const i = (6 * 16 + 6) * 4;
    expect(js.data[i + 3]).toBe(255);
    expect(wasm.data[i + 3]).toBe(255);
    expectMaxDelta(js.data, wasm.data, 1);
  });

  it("matches the JS box blur on a hard edge", async () => {
    const bytes = await readFile(wasmPath);
    expect(await loadPixelWasm(bytes)).toBe(true);
    const js = edgeImage(32, 8);
    const wasm = edgeImage(32, 8);
    boxBlurRgbaJs(js, 32, 8, 2, 2);
    expect(boxBlurRgbaWasm(wasm, 32, 8, 2, 2)).toBe(true);
    expectMaxDelta(js, wasm, 0);
    expect(wasm[15 * 4]).toBeGreaterThan(0);
    expect(wasm[16 * 4]).toBeLessThan(255);
  });
});

function paintDot(data: Uint8ClampedArray, width: number, x: number, y: number, rgb: [number, number, number]): void {
  const i = (y * width + x) * 4;
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
  data[i + 3] = 255;
}

function expectMaxDelta(a: Uint8ClampedArray, b: Uint8ClampedArray, max: number): void {
  expect(a.length).toBe(b.length);
  let worst = 0;
  for (let i = 0; i < a.length; i += 1) {
    worst = Math.max(worst, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
  }
  expect(worst).toBeLessThanOrEqual(max);
}
