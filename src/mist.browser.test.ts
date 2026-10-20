import { describe, expect, it, vi } from "vitest";
import { createCompositor } from "./compositor.ts";
import type { LoadedPhoto } from "./photos.ts";

const timeline = { slots: [0, 1, 2] };
const video = () => document.createElement("video");

async function photo(color: string): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 90;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 160, 90);
  return { id: color, name: "fixture", bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}

function pixels(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
}

async function digest(canvas: HTMLCanvasElement): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", pixels(canvas).buffer as ArrayBuffer))].join(",");
}

describe.each(["landscape", "portrait"] as const)("%s mist", (mode) => {
  for (const resolutionScale of [1 / 3, 0.3325, 1]) {
    it(`covers every edge at ${resolutionScale}, retains cloud shading and is deterministic`, async () => {
      const a = createCompositor({ resolutionScale, createKeyer: () => null });
      const b = createCompositor({ resolutionScale, createKeyer: () => null });
      a.setAspect(mode);
      b.setAspect(mode);
      const light = await photo("rgb(96, 128, 160)");
      const dark = await photo("#000");
      try {
        const hashes = new Map<number, string>();
        for (let frame = -8; frame <= 8; frame++) {
          a.draw(video(), [light], timeline, 1 + frame / 30, "mist");
          const data = pixels(a.canvas);
          const { width: w, height: h } = a.canvas;
          let minAlpha = 255;
          let minEdge = 255;
          let maxStep = 0;
          // クレジット以外の周囲を全画素で検査。隣接画素の急な線も拾う。
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              minAlpha = Math.min(minAlpha, data[i + 3]!);
              if ((x < 3 || x >= w - 3 || y < 3 || y >= h - 3) && (x < w * 0.4 || y < h * 0.8)) {
                minEdge = Math.min(minEdge, data[i]!);
                const inner = ((y < 3 ? y + 1 : y >= h - 3 ? y - 1 : y) * w + (x < 3 ? x + 1 : x >= w - 3 ? x - 1 : x)) * 4;
                maxStep = Math.max(maxStep, Math.abs(data[i]! - data[inner]!));
              }
            }
          }
          expect(minAlpha).toBe(255);
          expect(minEdge).toBeGreaterThanOrEqual(94);
          expect(maxStep, `frame ${frame}`).toBeLessThan(15);
          hashes.set(frame, await digest(a.canvas));
        }
        // 再生順、別 compositor、別の写真でも頂点は同じ雲に隠れる。
        for (const frame of [6, 0, -4, 3, -1]) {
          a.draw(video(), [light], timeline, 1 + frame / 30, "mist");
          b.draw(video(), [light], timeline, 1 + frame / 30, "mist");
          expect(await digest(a.canvas)).toBe(hashes.get(frame));
          expect(await digest(b.canvas)).toBe(hashes.get(frame));
        }
        a.draw(video(), [dark], timeline, 1, "mist");
        expect(await digest(a.canvas)).toBe(hashes.get(0));
        const data = pixels(a.canvas);
        const { width: w, height: h } = a.canvas;
        let sum = 0;
        let squares = 0;
        let count = 0;
        let minimum = 255;
        for (let y = 0; y < h * 0.8; y += 3) {
          for (let x = 0; x < w; x += 3) {
            const value = data[(y * w + x) * 4]!;
            sum += value;
            squares += value * value;
            count++;
            minimum = Math.min(minimum, value);
          }
        }
        const variance = squares / count - (sum / count) ** 2;
        console.info(`mist ${mode} scale=${resolutionScale} cutMin=${minimum} variance=${variance.toFixed(2)}`);
        expect(minimum).toBeGreaterThan(220);
        expect(variance).toBeGreaterThan(5);
      } finally {
        light.bitmap.close();
        dark.bitmap.close();
        a.destroy();
        b.destroy();
      }
    });
  }
});

it("does no extra drawing or readback outside the window, including without OffscreenCanvas", async () => {
  vi.stubGlobal("OffscreenCanvas", undefined);
  const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
  const image = await photo("#6080a0");
  const draws = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
  const readback = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
  try {
    compositor.draw(video(), [image], timeline, 0.4, "mist");
    const count = draws.mock.calls.length;
    const baseline = await digest(compositor.canvas);
    draws.mockClear();
    compositor.draw(video(), [image], timeline, 0.4, "zoom");
    expect(draws.mock.calls.length).toBe(count);
    expect(await digest(compositor.canvas)).toBe(baseline);
    readback.mockClear();
    compositor.draw(video(), [image], timeline, 1, "mist");
    expect(readback).not.toHaveBeenCalled();
    compositor.draw(video(), [image], timeline, 0.4, "mist");
    expect(await digest(compositor.canvas)).toBe(baseline);
  } finally {
    draws.mockRestore();
    readback.mockRestore();
    vi.unstubAllGlobals();
    image.bitmap.close();
    compositor.destroy();
  }
});
