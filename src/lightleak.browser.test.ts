import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCompositor } from "./compositor.ts";
import {
  blendLightLeak, paintLightLeak, lightLeakCharacterPoint, lightLeakCharacterSource,
  LIGHT_LEAK_CHARACTER_GAIN, LIGHT_LEAK_PHOTO_GAIN, LIGHT_LEAK_SHORT_SIDE,
} from "./lightleak.ts";
import { characterDest, characterScale, characterShiftY, IMAGE_FILTERS, LIGHT_LEAK_AMOUNTS } from "./layout.ts";
import { COLOR_FILTERS } from "./color-filter.ts";
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

  it.each(COLOR_FILTERS)("%s × all blurs: processes only photos before bloom, then lights the character weakly", async (color) => {
    const reference = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    const actual = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    reference.setAspect(mode); actual.setAspect(mode);
    const striped = document.createElement("canvas"); striped.width = 640; striped.height = 360;
    const stripeCtx = striped.getContext("2d")!;
    stripeCtx.fillStyle = "#cc5431"; stripeCtx.fillRect(0, 0, 640, 360);
    stripeCtx.fillStyle = "#f0dca0";
    for (let x = 0; x < 640; x += 32) stripeCtx.fillRect(x, 0, 16, 360);
    const fixture = { id: "stripes", name: "stripes.png", bitmap: await createImageBitmap(striped), thumbUrl: "" };
    const character = syntheticCharacter(0.4, 0.8), media = video();
    const expected = document.createElement("canvas"); expected.width = width; expected.height = height;
    const expectedCtx = expected.getContext("2d")!;
    const light = document.createElement("canvas"), lightCtx = light.getContext("2d")!;
    try {
      for (const blur of IMAGE_FILTERS) {
        // 時刻0は光の窓外。同じ写真・配置で、色とブラーを処理済みの基準画像を得る。
        reference.draw(media, [fixture], cuts, 0, "lightleak", blur, undefined, "standard", color);
        const photoOnly = pixels(reference.canvas);
        reference.draw(media, [fixture], cuts, 0, "lightleak", blur, character, "standard", color);
        const withCharacter = pixels(reference.canvas);
        const photoIndices: number[] = [], characterIndices: number[] = [];
        for (let i = 0; i < photoOnly.length; i += 4) {
          if (withCharacter[i] === photoOnly[i] && withCharacter[i + 1] === photoOnly[i + 1] && withCharacter[i + 2] === photoOnly[i + 2]) photoIndices.push(i);
          // キーや輪郭の半透明な縁を除いた、キャラ内部と白い輪郭を検査する。
          const value = withCharacter[i];
          if ([32, 176, 255].includes(value!) && withCharacter[i + 1] === value && withCharacter[i + 2] === value) characterIndices.push(i);
        }
        expect(photoIndices.length).toBeGreaterThan(10_000);
        expect(characterIndices.length).toBeGreaterThan(100);
        for (const supplied of [undefined, character]) {
          const source = lightLeakCharacterSource(supplied ? lightLeakCharacterPoint(59, mode) : undefined, placed, width, height);
          for (let frame = -5; frame <= 5; frame++) {
            const label = `${color}/${blur}/${supplied ? "character" : "photo"}/${frame}`;
            const active = frame >= -4 && frame <= 4;
            const amount = active ? LIGHT_LEAK_AMOUNTS[frame + 4]! : 0;
            expectedCtx.putImageData(new ImageData(photoOnly.slice(), width, height), 0, 0);
            if (active) {
              paintLightLeak(light, lightCtx, width, height, source, { frame, amount });
              blendLightLeak(expectedCtx, light, width, height, amount * LIGHT_LEAK_PHOTO_GAIN);
            }
            // 不透明なキャラは写真への強い光を隠し、その後に弱い光だけを受ける。
            if (supplied) {
              const image = expectedCtx.getImageData(0, 0, width, height);
              for (const i of characterIndices) image.data.set(withCharacter.subarray(i, i + 4), i);
              expectedCtx.putImageData(image, 0, 0);
            }
            if (active) blendLightLeak(expectedCtx, light, width, height, amount * LIGHT_LEAK_CHARACTER_GAIN);
            actual.draw(media, [fixture], cuts, (59 + frame) / 30, "lightleak", blur, supplied, "standard", color);
            const want = pixels(expected), got = pixels(actual.canvas);
            let error = 0;
            const indices = supplied ? [...photoIndices, ...characterIndices] : photoIndices;
            for (const i of indices) for (let c = 0; c < 4; c++) error = Math.max(error, Math.abs(got[i + c]! - want[i + c]!));
            expect(error, label).toBe(0);
          }
        }
      }
    } finally { fixture.bitmap.close(); reference.destroy(); actual.destroy(); }
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
