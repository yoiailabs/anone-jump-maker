import { describe, expect, it, vi } from "vitest";
import { createCompositor } from "./compositor.ts";
import { lightLeakPlan, paintLightLeak, LIGHT_LEAK_CHARACTER_GAIN } from "./lightleak.ts";
import type { LoadedPhoto } from "./photos.ts";

const timeline = { slots: [0, 0.5, 1] };
const video = () => document.createElement("video");
const pixels = (canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
async function digest(data: Uint8ClampedArray) {
  const hash = await crypto.subtle.digest("SHA-256", data as Uint8ClampedArray<ArrayBuffer>);
  return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join("");
}
async function photo(pattern = false): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 303;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgb(64, 64, 64)";
  ctx.fillRect(0, 0, 303, 303);
  if (pattern) {
    const gradient = ctx.createLinearGradient(0, 0, 303, 303);
    gradient.addColorStop(0, "#304560");
    gradient.addColorStop(1, "#b9a57c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 303, 303);
    ctx.fillStyle = "#efe0bd";
    for (let x = 0; x < 303; x += 19) ctx.fillRect(x, 0, 2, 303);
  }
  return { id: "fixture", name: "fixture.png", bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}

describe.each(["landscape", "portrait"] as const)("%s light leak rendering", (mode) => {
  for (const resolutionScale of [1 / 3, 0.31, 1]) {
    it(`has no dark lines or transparent pixels on any active frame at scale ${resolutionScale}`, async () => {
      const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
      compositor.setAspect(mode);
      const flat = await photo();
      const credit = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(() => {});
      try {
        // 複数の入口・パレットと全9フレーム。最下行・右端も含む全画素を検査する。
        for (let cut = 1; cut <= 4; cut++) {
          const slots = Array.from({ length: cut + 1 }, (_, i) => i * 0.5);
          for (let frame = -4; frame <= 4; frame++) {
            compositor.draw(video(), [flat], { slots }, cut * 0.5 + frame / 30, "lightleak");
            const data = pixels(compositor.canvas);
            let dark = 0;
            let transparent = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i]! < 64 || data[i + 1]! < 64 || data[i + 2]! < 64) dark++;
              if (data[i + 3] !== 255) transparent++;
            }
            expect(dark, `cut=${cut} frame=${frame}`).toBe(0);
            expect(transparent).toBe(0);
          }
        }
      } finally {
        credit.mockRestore();
        flat.bitmap.close();
        compositor.destroy();
      }
    });
  }

  it("keeps all palettes orange with only a faint pink fringe, including the tail", () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const [w, h] = mode === "landscape" ? [240, 135] : [135, 240];
    for (let cut = 1; cut <= 32; cut++) {
      for (const frame of [0, 4]) {
        paintLightLeak(canvas, ctx, w!, h!, cut, { frame, amount: 1 });
        const data = pixels(canvas);
        let red = 0, green = 0, blue = 0, orange = 0, colored = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!, alpha = data[i + 3]! / 255;
          // 8%まで消えた合成結果の1階調の丸めに左右されず、透明度込みの光の色を測る。
          red += r * alpha; green += g * alpha; blue += b * alpha;
          if (alpha > 0.03) {
            colored++;
            if (r > g * 1.1 && g > b * 1.5) orange++;
          }
        }
        const label = `cut=${cut} frame=${frame}`;
        expect(red, label).toBeGreaterThan(blue * 3);
        expect(green, label).toBeGreaterThan(blue * 1.8);
        expect(orange / colored, label).toBeGreaterThan(0.75);
      }
    }
  });

  it("stays on the entry side through the tail, leaving the lower center clear", async () => {
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    compositor.setAspect(mode);
    const flat = await photo();
    const credit = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(() => {});
    try {
      for (let cut = 1; cut <= 32; cut++) {
        const slots = Array.from({ length: cut + 1 }, (_, i) => i * 0.5);
        for (let frame = -4; frame <= 4; frame++) {
          compositor.draw(video(), [flat], { slots }, cut * 0.5 + frame / 30, "lightleak");
          const { width: w, height: h } = compositor.canvas;
          const data = pixels(compositor.canvas);
          const edge = lightLeakPlan(cut, 0).edge;
          let near = 0, far = 0, red = 0, green = 0, blue = 0, white = 0, visible = 0;
          let moment = 0, lowerCenter = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              const r = data[i]! - 64, g = data[i + 1]! - 64, b = data[i + 2]! - 64;
              const distance = edge >= 2 ? y / h : edge === 0 ? x / w : 1 - x / w;
              const onNearSide = distance < 0.5;
              if (onNearSide) near += r + g + b;
              else far += r + g + b;
              red += r; green += g; blue += b;
              moment += distance * (r + g + b);
              if (x > w * 0.4 && x < w * 0.6 && y > h * 0.55 && y < h * 0.9) {
                lowerCenter = Math.max(lowerCenter, r, g, b);
              }
              if (data[i]! > 230 && data[i + 1]! > 230 && data[i + 2]! > 230) white++;
              if (g < 80) visible++;
            }
          }
          const label = `cut=${cut} frame=${frame}`;
          expect(near, label).toBeGreaterThan(far * 10);
          expect(moment / (near + far), label).toBeLessThan(0.3);
          if (frame === 0) {
            expect(red, label).toBeGreaterThan(blue * 3);
            expect(green, label).toBeGreaterThan(blue * 1.8);
          }
          expect(lowerCenter, label).toBeLessThan(10);
          expect(white / (w * h)).toBeLessThan(0.02);
          expect(visible / (w * h)).toBeGreaterThan(0.7);
        }
      }
    } finally {
      credit.mockRestore(); flat.bitmap.close(); compositor.destroy();
    }
  });

  it("matches every pixel after reseeking and in an independent export compositor", async () => {
    const preview = createCompositor({ resolutionScale: 0.31, createKeyer: () => null });
    const saved = createCompositor({ resolutionScale: 0.31, createKeyer: () => null });
    preview.setAspect(mode); saved.setAspect(mode);
    const patterned = await photo(true);
    try {
      const hashes = new Set<string>();
      for (let cut = 1; cut <= 2; cut++) {
        for (let frame = -5; frame <= 5; frame++) {
          const time = cut * 0.5 + frame / 30;
          preview.draw(video(), [patterned], timeline, time, "lightleak");
          const expected = await digest(pixels(preview.canvas));
          preview.draw(video(), [patterned], timeline, 0.2, "jump");
          preview.setAspect(mode === "portrait" ? "landscape" : "portrait");
          preview.draw(video(), [patterned], timeline, 0.7, "lightleak");
          preview.setAspect(mode);
          preview.draw(video(), [patterned], timeline, time, "lightleak");
          saved.draw(video(), [patterned], timeline, time, "lightleak");
          expect(await digest(pixels(preview.canvas))).toBe(expected);
          expect(await digest(pixels(saved.canvas))).toBe(expected);
          if (frame >= -4 && frame <= 4) hashes.add(expected);
        }
      }
      expect(hashes.size).toBe(18);
    } finally {
      patterned.bitmap.close(); preview.destroy(); saved.destroy();
    }
  });

  it("does no readback or allocations, reuses the small surface, and skips all extra drawing outside the window", async () => {
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    compositor.setAspect(mode);
    const flat = await photo();
    const source = video();
    const draw = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
    const gradient = vi.spyOn(CanvasRenderingContext2D.prototype, "createRadialGradient");
    const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
    const create = vi.spyOn(document, "createElement");
    const random = vi.spyOn(Math, "random");
    try {
      let surface: HTMLCanvasElement | undefined;
      for (const frame of [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, -5]) {
        draw.mockClear(); gradient.mockClear();
        compositor.draw(source, [flat], timeline, 0.5 + frame / 30, "lightleak");
        const active = frame >= -4 && frame <= 4;
        expect(draw).toHaveBeenCalledTimes(active ? 4 : 2);
        expect(gradient).toHaveBeenCalledTimes(active ? 3 : 0);
        if (active) {
          const [canvas, x, y, w, h] = draw.mock.calls[1]!;
          expect([x, y, w, h]).toEqual([0, 0, compositor.canvas.width, compositor.canvas.height]);
          if (surface) expect(canvas).toBe(surface);
          surface = canvas as HTMLCanvasElement;
          expect(Math.min(surface.width, surface.height)).toBe(135);
          expect(surface.width / surface.height).toBeCloseTo(compositor.canvas.width / compositor.canvas.height, 2);
          expect(draw.mock.calls[2]![0]).toBe(surface);
        }
      }
      expect(read).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
    } finally {
      draw.mockRestore(); gradient.mockRestore(); read.mockRestore(); create.mockRestore(); random.mockRestore();
      flat.bitmap.close(); compositor.destroy();
    }
  });

  it("keeps the character light at 20% using the shared additive overlay", async () => {
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    compositor.setAspect(mode);
    const flat = await photo();
    const source = document.createElement("canvas");
    source.width = 1920; source.height = 1080;
    const ctx = source.getContext("2d")!;
    ctx.fillStyle = "#20d03a"; ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = "#202020"; ctx.fillRect(200, 100, 1500, 800);
    const operations: { alpha: number; op: string; smoothing: boolean }[] = [];
    const original = CanvasRenderingContext2D.prototype.drawImage;
    const draw = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage").mockImplementation(function (this: CanvasRenderingContext2D, ...args: Parameters<typeof original>) {
      if ((args[0] as HTMLCanvasElement).width === (mode === "portrait" ? 135 : 240)) {
        operations.push({ alpha: this.globalAlpha, op: this.globalCompositeOperation, smoothing: this.imageSmoothingEnabled });
      }
      return Reflect.apply(original, this, args);
    });
    try {
      compositor.draw(video(), [flat], timeline, 0.5, "lightleak", "none", { source, width: 1920, height: 1080 });
      expect(operations).toEqual([
        { alpha: 0.86, op: "screen", smoothing: true },
        { alpha: LIGHT_LEAK_CHARACTER_GAIN, op: "screen", smoothing: true },
      ]);
    } finally { draw.mockRestore(); flat.bitmap.close(); compositor.destroy(); }
  });
});
