import { expect, it, vi } from "vitest";
import { applyColorFilter, COLOR_FILTERS, type ColorFilter } from "./color-filter.ts";
import { createCompositor } from "./compositor.ts";
import { IMAGE_FILTERS, TEMPLATE_FPS } from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";

const F = 1 / TEMPLATE_FPS;
const timeline = { slots: [0, 15 * F, 28 * F] };

async function photo(index: number): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = index === 0 ? 303 : 607;
  canvas.height = index === 0 ? 607 : 303;
  const ctx = canvas.getContext("2d")!;
  // 縦の模様はホイップの横ブラーで消えるため、横縞で独立ブラーも検査する。
  for (let y = 0; y < canvas.height; y++) {
    ctx.fillStyle = ["#dc8050", "#4a627e", "#b65172"][(Math.floor(y / 9) + index) % 3]!;
    ctx.fillRect(0, y, canvas.width, 1);
  }
  return { id: `photo-${index}`, name: "fixture.png", bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}

async function prefilter(photo: LoadedPhoto, color: ColorFilter): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = photo.bitmap.width;
  canvas.height = photo.bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(photo.bitmap, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyColorFilter(image.data, color);
  ctx.putImageData(image, 0, 0);
  return { ...photo, bitmap: await createImageBitmap(canvas) };
}

const pixels = (canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
function maxDiff(a: ImageData, b: ImageData, from = 0, to = 1): number {
  let max = 0;
  for (let y = 0; y < a.height; y++) for (let x = Math.floor(a.width * from); x < a.width * to; x++) {
    const i = (y * a.width + x) * 4;
    for (let c = 0; c < 4; c++) max = Math.max(max, Math.abs(a.data[i + c]! - b.data[i + c]!));
  }
  return max;
}

for (const aspect of ["landscape", "portrait"] as const) for (const resolutionScale of [1 / 3, 1]) for (const color of COLOR_FILTERS) {
  it(`${aspect} at ${resolutionScale}, ${color}: colors both whip photos before blur and stays consistent across cuts and seeks`, async () => {
    const actual = createCompositor({ resolutionScale, createKeyer: () => null });
    const reference = createCompositor({ resolutionScale, createKeyer: () => null });
    actual.setAspect(aspect);
    reference.setAspect(aspect);
    const photos = await Promise.all([photo(0), photo(1)]);
    const video = document.createElement("video");
    try {
      const colored = await Promise.all(photos.map((p) => prefilter(p, color)));
      try {
        for (const blur of IMAGE_FILTERS) {
          // 静止、進入、カット、退出、次カット（写真順反転）、逆方向seek。
          for (const frame of [6, 13, 15, 17, 19, 28, 15]) {
            actual.draw(video, photos, timeline, frame * F, "whip", blur, undefined, "standard", color);
            reference.draw(video, colored, timeline, frame * F, "whip", blur);
            expect(maxDiff(pixels(actual.canvas), pixels(reference.canvas)), `${color}/${blur} frame=${frame}`).toBe(0);
          }
        }
      } finally { colored.forEach((p) => p.bitmap.close()); }
      const frames = IMAGE_FILTERS.map((blur) => {
        actual.draw(video, photos, timeline, 15 * F, "whip", blur, undefined, "standard", color);
        return pixels(actual.canvas);
      });
      // 左右とも弱・強のボケが効き、設定が異なることを実画素で確かめる。
      for (const [from, to] of [[0.05, 0.35], [0.65, 0.95]]) {
        expect(maxDiff(frames[0]!, frames[1]!, from, to)).toBeGreaterThan(10);
        expect(maxDiff(frames[1]!, frames[2]!, from, to)).toBeGreaterThan(10);
      }
    } finally {
      actual.destroy();
      reference.destroy();
      photos.forEach((p) => p.bitmap.close());
    }
  });
}

it("reuses both colored whip photos across frames and releases the incoming canvas outside the pan", async () => {
  const comp = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
  const photos = await Promise.all([photo(0), photo(1)]);
  const video = document.createElement("video");
  const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
  const write = vi.spyOn(CanvasRenderingContext2D.prototype, "putImageData");
  const draw = (frame: number, color: ColorFilter = "film") => comp.draw(video, photos, timeline, frame * F, "whip", "none", undefined, "standard", color);
  try {
    draw(6);
    expect(read).toHaveBeenCalledTimes(1);
    draw(13);
    expect(read).toHaveBeenCalledTimes(2);
    const incoming = (write.mock.contexts[1] as CanvasRenderingContext2D).canvas;
    for (const frame of [13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 15]) draw(frame);
    expect(read).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledTimes(2);
    draw(19);
    expect(incoming.width).toBe(0);
    draw(15, "dynamic");
    const active = write.mock.contexts.slice(-2).map((ctx) => (ctx as CanvasRenderingContext2D).canvas);
    const count = read.mock.calls.length;
    draw(16, "dynamic");
    expect(read).toHaveBeenCalledTimes(count);
    draw(16, "none");
    expect(read).toHaveBeenCalledTimes(count);
    expect(active.every((canvas) => canvas.width === 0)).toBe(true);
    draw(16);
    const final = write.mock.contexts.slice(-2).map((ctx) => (ctx as CanvasRenderingContext2D).canvas);
    comp.destroy();
    expect(final.every((canvas) => canvas.width === 0)).toBe(true);
  } finally {
    read.mockRestore();
    write.mockRestore();
    comp.destroy();
    photos.forEach((p) => p.bitmap.close());
  }
});
