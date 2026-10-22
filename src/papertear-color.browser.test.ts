import { expect, it, vi } from "vitest";
import { applyColorFilter, COLOR_FILTERS, createColorPhotoCache, type ColorFilter } from "./color-filter.ts";
import { createCompositor } from "./compositor.ts";
import { IMAGE_FILTERS } from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";

const cuts = { slots: [0, 0.5] };
const pixels = (canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
function maxDiff(a: ArrayLike<number>, b: ArrayLike<number>) {
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i]! - b[i]!));
  return max;
}

async function photo(color: string, detail = false, filter: ColorFilter = "none"): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = 303;
  canvas.height = 227;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (detail) {
    ctx.fillStyle = "rgba(238,242,216,0.7)";
    for (let x = 0; x < canvas.width; x += 12) ctx.fillRect(x, 0, 5, canvas.height);
    // Also exercise alpha before the normal opaque photo backdrop is added.
    ctx.clearRect(120, 90, 30, 25);
  }
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyColorFilter(image.data, filter);
  ctx.putImageData(image, 0, 0);
  return { id: color, name: color, bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}

it("retains both tear sources without readback churn and evicts the least recently used source", async () => {
  const photos = await Promise.all([photo("#d04030"), photo("#3050c0"), photo("#30a050")]);
  const cache = createColorPhotoCache(2);
  const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
  try {
    const a = cache.get(photos[0]!.bitmap, "film") as HTMLCanvasElement;
    const b = cache.get(photos[1]!.bitmap, "film") as HTMLCanvasElement;
    for (let frame = 0; frame < 7; frame++) {
      expect(cache.get(photos[0]!.bitmap, "film")).toBe(a);
      expect(cache.get(photos[1]!.bitmap, "film")).toBe(b);
      expect(a.width).toBe(303);
      expect(b.width).toBe(303);
    }
    expect(read).toHaveBeenCalledTimes(2);
    const c = cache.get(photos[2]!.bitmap, "film") as HTMLCanvasElement;
    expect(a.width).toBe(0);
    expect(cache.get(photos[1]!.bitmap, "film")).toBe(b);
    expect(read).toHaveBeenCalledTimes(3);
    const changed = cache.get(photos[1]!.bitmap, "dynamic") as HTMLCanvasElement;
    expect(b.width).toBe(0);
    expect(c.width).toBe(0);
    cache.clear();
    expect(changed.width).toBe(0);
  } finally {
    read.mockRestore();
    cache.clear();
    photos.forEach((p) => p.bitmap.close());
  }
});

it("converts each photo only once across consecutive tear frames and the following still", async () => {
  const photos = await Promise.all([photo("#d04030", true), photo("#3050c0", true)]);
  const comp = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
  const video = document.createElement("video");
  const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
  try {
    for (let frame = 13; frame <= 22; frame++) {
      comp.draw(video, photos, cuts, frame / 30, "papertear", "none", undefined, "standard", "film");
    }
    expect(read).toHaveBeenCalledTimes(2);
  } finally {
    read.mockRestore();
    comp.destroy();
    photos.forEach((p) => p.bitmap.close());
  }
});

for (const aspect of ["landscape", "portrait"] as const) {
  for (const color of COLOR_FILTERS) for (const blur of IMAGE_FILTERS) {
    it(`${aspect} ${color}/${blur}: colors both photos, preserves paper/shadows and stays continuous before/during/after the tear`, async () => {
      const actual = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      const reference = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      actual.setAspect(aspect);
      reference.setAspect(aspect);
      const video = document.createElement("video");
      const photos: LoadedPhoto[] = [];
      try {
        for (const detail of [false, true]) {
          const source = await Promise.all([photo("#d04030", detail), photo("#3050c0", detail)]);
          photos.push(...source);
          // Independent reference: color original pixels before compositing;
          // paper, shadows and blur still go through the uncolored renderer.
          const colored = await Promise.all([photo("#d04030", detail, color), photo("#3050c0", detail, color)]);
          photos.push(...colored);
          const draw = (frame: number) => {
            actual.draw(video, source, cuts, frame / 30, "papertear", blur, undefined, "standard", color);
            return pixels(actual.canvas);
          };
          const before = draw(13);
          const after = draw(21);
          let fibers = 0;
          for (let frame = 14; frame <= 20; frame++) {
            const rendered = draw(frame);
            reference.draw(video, colored, cuts, frame / 30, "papertear", blur);
            const expected = pixels(reference.canvas);
            expect(maxDiff(rendered, expected), `frame ${frame}, detail=${detail}`).toBeLessThanOrEqual(2);
            const { width: w, height: h } = actual.canvas;
            if (!detail) {
              if (frame === 14) for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
                const i = (y! * w + x!) * 4;
                expect(maxDiff(rendered.slice(i, i + 4), before.slice(i, i + 4)), "old photo continuity").toBeLessThanOrEqual(2);
              }
              if (frame === 18) {
                const i = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
                expect(maxDiff(rendered.slice(i, i + 4), after.slice(i, i + 4)), "revealed photo continuity").toBe(0);
              }
              // Restrict to the seam area so song credit pixels cannot count.
              for (let y = Math.floor(h * 0.15); y < h * 0.85; y++) for (let x = Math.floor(w * 0.15); x < w * 0.85; x++) {
                const i = (y * w + x) * 4;
                if (expected[i] === 255 && expected[i + 1] === 253 && expected[i + 2] === 247) {
                  fibers++;
                  expect(Array.from(rendered.slice(i, i + 4))).toEqual([255, 253, 247, 255]);
                }
              }
            }
            if (frame === 20) expect(maxDiff(rendered, after), "last window frame / normal new photo").toBe(0);
          }
          if (!detail) expect(fibers).toBeGreaterThan(50);
          // Seeking back must reproduce the same pixels with warm caches.
          expect(maxDiff(draw(13), before)).toBe(0);
        }
      } finally {
        actual.destroy();
        reference.destroy();
        photos.forEach((p) => p.bitmap.close());
      }
    });
  }
}
