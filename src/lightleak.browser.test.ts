import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCompositor } from "./compositor.ts";
import {
  blendLightLeak, paintLightLeak, lightLeakCharacterPoint, lightLeakCharacterSource,
  LIGHT_LEAK_CHARACTER_GAIN, LIGHT_LEAK_PHOTO_GAIN, LIGHT_LEAK_SHORT_SIDE,
} from "./lightleak.ts";
import { characterDest, characterScale, characterShiftY, templateBandRect } from "./layout.ts";
import { keyAlpha, sampleKeyColor } from "./keying.ts";
import type { LoadedPhoto } from "./photos.ts";
import cuts from "../public/official-assets/template/landscape-cuts.json";

const video = () => document.createElement("video");
const pixels = (canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
const pixel = (canvas: HTMLCanvasElement, x: number, y: number) => {
  const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(x)));
  const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(y)));
  return Array.from(canvas.getContext("2d")!.getImageData(px, py, 1, 1).data);
};
async function photo(): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 360;
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#404040"; ctx.fillRect(0, 0, 640, 360);
  return { id: "fixture", name: "fixture.png", bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}
function syntheticCharacter(x: number, y: number) {
  const source = document.createElement("canvas"); source.width = 320; source.height = 180;
  const ctx = source.getContext("2d")!;
  ctx.fillStyle = "#20d03a"; ctx.fillRect(0, 0, 320, 180);
  ctx.fillStyle = "#202020"; ctx.fillRect(x * 320 - 18, y * 180 - 18, 36, 36);
  ctx.fillStyle = "#b0b0b0"; ctx.fillRect(x * 320 - 12, y * 180 - 12, 24, 24);
  // 顔の目・輪郭をピーク時にも測れるよう、中央を横切る暗い線を置く。
  ctx.fillStyle = "#202020"; ctx.fillRect(x * 320 - 12, y * 180 - 2, 24, 4);
  return { source, width: 320, height: 180 };
}
async function digest(data: Uint8ClampedArray) {
  const hash = await crypto.subtle.digest("SHA-256", data as Uint8ClampedArray<ArrayBuffer>);
  return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join("");
}
beforeEach(() => { vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe.each(["landscape", "portrait"] as const)("%s character bloom", (mode) => {
  const [width, height] = mode === "landscape" ? [640, 360] : [360, 640];
  const placed = characterDest(width, height, characterScale(mode), characterShiftY(height, mode), mode);

  it.each([59, 102, 205])("cut %i: synthetic character lights from its body, with a fixed source throughout the window", async (cut) => {
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    compositor.setAspect(mode);
    const fixture = await photo();
    const point = lightLeakCharacterPoint(cut, mode)!;
    const source = lightLeakCharacterSource(point, placed, width, height);
    const character = syntheticCharacter(point.x, point.y);
    const gradient = vi.spyOn(CanvasRenderingContext2D.prototype, "createRadialGradient");
    try {
      for (let frame = -4; frame <= 4; frame++) {
        gradient.mockClear();
        // プレビューと保存で供給ポーズが前後しても、光源はカット表の位置から動かない。
        const supplied = frame === 0 ? character : syntheticCharacter(point.x + 0.04 * Math.sign(frame), point.y - 0.03);
        compositor.draw(video(), [fixture], cuts, (cut + frame) / 30, "lightleak", "none", supplied);
        const [x, y] = gradient.mock.calls[0]!;
        const w = mode === "landscape" ? 240 : 135, h = mode === "landscape" ? 135 : 240;
        expect(x / w).toBeCloseTo(source.x, 5); expect(y / h).toBeCloseTo(source.y, 5);
        if (frame === 0) {
          // 黒い目・輪郭は白飛びせず、顔の明部と十分なコントラストを保つ。
          const line = pixel(compositor.canvas, source.x * width, source.y * height)[0]!;
          const face = pixel(compositor.canvas, source.x * width, source.y * height - placed.h * 8 / 180)[0]!;
          expect(line).toBeGreaterThan(60); expect(line).toBeLessThan(135);
          expect(face - line).toBeGreaterThan(65);
        }
      }
    } finally { fixture.bitmap.close(); compositor.destroy(); }
  });

  it("is white, Gaussian, smooth, grows visibly before the cut, and reaches every corner at peak", () => {
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d")!;
    const source = lightLeakCharacterSource(lightLeakCharacterPoint(59, mode), placed, width, height);
    let previousArea = 0, previousRadius = 0;
    for (let frame = -4; frame <= 4; frame++) {
      const radial = vi.spyOn(ctx, "createRadialGradient");
      paintLightLeak(canvas, ctx, width, height, source, { frame, amount: 1 });
      const radius = radial.mock.calls.at(-1)![5]; radial.mockRestore();
      const data = pixels(canvas), w = canvas.width, h = canvas.height;
      let area = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3]! > 64) area++;
        if (data[i + 3]! > 8) {
          expect(Math.max(data[i]!, data[i + 1]!, data[i + 2]!) - Math.min(data[i]!, data[i + 1]!, data[i + 2]!)).toBeLessThanOrEqual(1);
        }
      }
      if (frame <= 0) {
        expect(radius).toBeGreaterThan(previousRadius); expect(area).toBeGreaterThan(previousArea);
        previousArea = area; previousRadius = radius;
      }
      if (frame !== 0) continue;
      const cx = source.x * w, cy = source.y * h;
      const center = pixel(canvas, cx, cy)[3]!;
      expect(center).toBeGreaterThan(250);
      for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
        const corner = pixel(canvas, x!, y!)[3]!;
        expect(corner).toBeGreaterThan(115); expect(center - corner).toBeGreaterThan(15);
      }
      // 中心から上へ: 段差を作らず連続的に減衰する。半径方向の1画素差は最大3階調。
      let last = center;
      for (let y = Math.floor(cy) - 1; y >= 0; y--) {
        const alpha = pixel(canvas, cx, y)[3]!;
        expect(alpha).toBeLessThanOrEqual(last + 1); expect(last - alpha).toBeLessThanOrEqual(3); last = alpha;
      }
      const composite = document.createElement("canvas"); composite.width = w; composite.height = h;
      const c = composite.getContext("2d")!; c.fillStyle = "#404040"; c.fillRect(0, 0, w, h);
      blendLightLeak(c, canvas, w, h, LIGHT_LEAK_PHOTO_GAIN);
      const brightest = pixel(composite, cx, cy)[0]!;
      for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
        const corner = pixel(composite, x!, y!)[0]!;
        expect(corner - 64).toBeGreaterThan(80); expect(brightest - corner).toBeGreaterThan(10);
      }
    }
  });

  it("uses the character rectangle fallback when no character is available", async () => {
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null }); compositor.setAspect(mode);
    const fixture = await photo(); const gradient = vi.spyOn(CanvasRenderingContext2D.prototype, "createRadialGradient");
    try {
      compositor.draw(video(), [fixture], cuts, 59 / 30, "lightleak");
      const [x, y] = gradient.mock.calls[0]!;
      expect(x / (mode === "landscape" ? 240 : 135)).toBeCloseTo((placed.x + 0.5 * placed.w) / width);
      expect(y / (mode === "landscape" ? 135 : 240)).toBeCloseTo((placed.y + 0.42 * placed.h) / height);
    } finally { fixture.bitmap.close(); compositor.destroy(); }
  });

  it("matches all pixels after reseeking and across compositors, irrespective of frame supply order", async () => {
    const a = createCompositor({ resolutionScale: 0.31, createKeyer: () => null });
    const b = createCompositor({ resolutionScale: 0.31, createKeyer: () => null });
    a.setAspect(mode); b.setAspect(mode);
    const fixture = await photo(); const point = lightLeakCharacterPoint(102, mode)!;
    const character = syntheticCharacter(point.x, point.y);
    try {
      for (const frame of [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]) {
        const time = (102 + frame) / 30;
        a.draw(video(), [fixture], cuts, time, "lightleak", "none", character);
        const expected = await digest(pixels(a.canvas));
        a.setAspect(mode === "portrait" ? "landscape" : "portrait");
        a.draw(video(), [fixture], cuts, 205 / 30, "lightleak", "none", syntheticCharacter(0.3, 0.5));
        a.setAspect(mode);
        a.draw(video(), [fixture], cuts, time, "lightleak", "none", character);
        b.draw(video(), [fixture], cuts, time, "lightleak", "none", character);
        expect(await digest(pixels(a.canvas))).toBe(expected); expect(await digest(pixels(b.canvas))).toBe(expected);
      }
    } finally { fixture.bitmap.close(); a.destroy(); b.destroy(); }
  });

  it("does no light readback or allocation, keeps the surface, and draws nothing extra outside -4..+4", async () => {
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null }); compositor.setAspect(mode);
    const fixture = await photo(), source = video();
    const draw = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
    const gradient = vi.spyOn(CanvasRenderingContext2D.prototype, "createRadialGradient");
    const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
    const create = vi.spyOn(document, "createElement"), random = vi.spyOn(Math, "random");
    try {
      let surface: HTMLCanvasElement | undefined;
      for (const frame of [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, -5]) {
        draw.mockClear(); gradient.mockClear(); const active = frame >= -4 && frame <= 4;
        compositor.draw(source, [fixture], cuts, (59 + frame) / 30, "lightleak");
        expect(draw).toHaveBeenCalledTimes(active ? 4 : 2); expect(gradient).toHaveBeenCalledTimes(active ? 1 : 0);
        if (active) {
          const [canvas, x, y, w, h] = draw.mock.calls[1]!;
          expect([x, y, w, h]).toEqual([0, 0, compositor.canvas.width, compositor.canvas.height]);
          if (surface) expect(canvas).toBe(surface); surface = canvas as HTMLCanvasElement;
          expect(Math.min(surface.width, surface.height)).toBe(LIGHT_LEAK_SHORT_SIDE);
        }
      }
      expect(read).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(random).not.toHaveBeenCalled();
    } finally { fixture.bitmap.close(); compositor.destroy(); }
  });

  it.each([1 / 3, 0.31, 1])("has no dark seams or transparency at scale %f on all nine frames", async (resolutionScale) => {
    const compositor = createCompositor({ resolutionScale, createKeyer: () => null }); compositor.setAspect(mode);
    const fixture = await photo();
    try {
      for (let frame = -4; frame <= 4; frame++) {
        compositor.draw(video(), [fixture], cuts, (59 + frame) / 30, "lightleak");
        const data = pixels(compositor.canvas); let dark = 0, transparent = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i]! < 64 || data[i + 1]! < 64 || data[i + 2]! < 64) dark++;
          if (data[i + 3] !== 255) transparent++;
        }
        expect(dark).toBe(0); expect(transparent).toBe(0);
      }
    } finally { fixture.bitmap.close(); compositor.destroy(); }
  });
});

it("生成表の光源が実テンプレの異なる3ポーズのアルファ重心と一致する（縦横）", async () => {
  const source = video(); source.muted = true; source.preload = "auto";
  source.src = "/official-assets/template/landscape.mp4";
  await new Promise<void>((resolve, reject) => { source.onloadeddata = () => resolve(); source.onerror = () => reject(new Error("テンプレ読み込み失敗")); });
  const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 180;
  const ctx = canvas.getContext("2d")!;
  try {
    for (const frame of [59, 102, 205]) {
      await new Promise<void>((resolve) => { source.onseeked = () => resolve(); source.currentTime = frame / 30 + 0.001; });
      for (const mode of ["landscape", "portrait"] as const) {
        const band = templateBandRect(source.videoWidth, source.videoHeight, mode);
        ctx.drawImage(source, band.x, band.y, band.w, band.h, 0, 0, 320, 180);
        const data = pixels(canvas), key = sampleKeyColor(data, 320, 180);
        let mass = 0, sx = 0, sy = 0;
        for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) {
          const i = (y * 320 + x) * 4;
          const alpha = keyAlpha(data[i]!, data[i + 1]!, data[i + 2]!, ...key);
          if (alpha < 0.5) continue;
          mass += alpha; sx += (x + 0.5) * alpha; sy += (y + 0.5) * alpha;
        }
        const point = lightLeakCharacterPoint(frame, mode)!;
        expect(Math.abs(point.x - sx / mass / 320)).toBeLessThan(0.01);
        expect(Math.abs(point.y - sy / mass / 180)).toBeLessThan(0.01);
      }
    }
  } finally { source.removeAttribute("src"); source.load(); }
});

it("写真よりキャラへのscreenが弱く、合成時にも係数を使う", async () => {
  const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
  const fixture = await photo(); const ops: { alpha: number; op: string; smoothing: boolean }[] = [];
  const original = CanvasRenderingContext2D.prototype.drawImage;
  vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage").mockImplementation(function (this: CanvasRenderingContext2D, ...args: Parameters<typeof original>) {
    if ((args[0] as HTMLCanvasElement).width === 240) ops.push({ alpha: this.globalAlpha, op: this.globalCompositeOperation, smoothing: this.imageSmoothingEnabled });
    return Reflect.apply(original, this, args);
  });
  try {
    compositor.draw(video(), [fixture], cuts, 59 / 30, "lightleak", "none", syntheticCharacter(0.4, 0.8));
    expect(ops).toEqual([
      { alpha: LIGHT_LEAK_PHOTO_GAIN, op: "screen", smoothing: true },
      { alpha: LIGHT_LEAK_CHARACTER_GAIN, op: "screen", smoothing: true },
    ]);
    expect(LIGHT_LEAK_CHARACTER_GAIN).toBeGreaterThanOrEqual(0.3); expect(LIGHT_LEAK_CHARACTER_GAIN).toBeLessThanOrEqual(0.45);
    expect(LIGHT_LEAK_CHARACTER_GAIN).toBeLessThan(LIGHT_LEAK_PHOTO_GAIN);
  } finally { fixture.bitmap.close(); compositor.destroy(); }
});
