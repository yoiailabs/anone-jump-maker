import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCompositor, plateDest } from "./compositor.ts";
import {
  blendLightLeak, lightLeakSource, paintLightLeak, prepareLightLeakPhoto, LIGHT_LEAK_CHARACTER_GAIN,
  LIGHT_LEAK_PHOTO_GAIN, LIGHT_LEAK_SHORT_SIDE, LIGHT_LEAK_FALLBACK,
} from "./lightleak.ts";
import { loadPhotos, revokePhotos, type LoadedPhoto } from "./photos.ts";

const timeline = { slots: [0, 0.5, 1] };
const video = () => document.createElement("video");
const pixels = (canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
type Spot = { x: number; y: number; brightness?: number };

async function photo({ width = 640, height = 360, background = 64, spots = [], prepare = true, pattern = false }: {
  width?: number; height?: number; background?: number; spots?: Spot[]; prepare?: boolean; pattern?: boolean;
} = {}): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `rgb(${background}, ${background}, ${background})`;
  ctx.fillRect(0, 0, width, height);
  if (pattern) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#304560"); gradient.addColorStop(1, "#b9a57c");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  }
  for (const spot of spots) {
    const x = spot.x * width, y = spot.y * height;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.min(width, height) * 0.12);
    const b = spot.brightness ?? 200;
    gradient.addColorStop(0, `rgb(${b}, ${b}, ${b})`);
    gradient.addColorStop(1, `rgba(${b}, ${b}, ${b}, 0)`);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  }
  const bitmap = await createImageBitmap(canvas);
  if (prepare) prepareLightLeakPhoto(bitmap);
  return { id: "fixture", name: "fixture.png", bitmap, thumbUrl: "" };
}

function brightest(canvas: HTMLCanvasElement) {
  const data = pixels(canvas);
  let max = -1, index = 0;
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i]! + data[i + 1]! + data[i + 2]!;
    if (value > max) { max = value; index = i / 4; }
  }
  return { x: (index % canvas.width + 0.5) / canvas.width, y: (Math.floor(index / canvas.width) + 0.5) / canvas.height };
}

async function digest(data: Uint8ClampedArray) {
  const hash = await crypto.subtle.digest("SHA-256", data as Uint8ClampedArray<ArrayBuffer>);
  return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join("");
}

beforeEach(() => { vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe.each(["landscape", "portrait"] as const)("%s white light leak", (mode) => {
  const [width, height] = mode === "landscape" ? [640, 360] : [360, 640];
  const sourceFor = (bitmap: ImageBitmap) => lightLeakSource(bitmap,
    plateDest(bitmap.width, bitmap.height, width, height, { scale: 1, dy: 0 }, "lightleak"), width, height);

  for (const resolutionScale of [1 / 3, 0.31, 1]) {
    it(`has no dark lines or transparent pixels on all nine frames at scale ${resolutionScale}`, async () => {
      const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
      compositor.setAspect(mode);
      const flat = await photo({ width, height });
      try {
        for (let frame = -4; frame <= 4; frame++) {
          compositor.draw(video(), [flat], timeline, 0.5 + frame / 30, "lightleak");
          const data = pixels(compositor.canvas);
          let dark = 0, transparent = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i]! < 64 || data[i + 1]! < 64 || data[i + 2]! < 64) dark++;
            if (data[i + 3] !== 255) transparent++;
          }
          expect(dark, `frame=${frame}`).toBe(0);
          expect(transparent).toBe(0);
        }
      } finally { flat.bitmap.close(); compositor.destroy(); }
    });
  }

  it("is neutral white, broad, smoothly radial and local, with a clearly white center", () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const source = { x: 0.25, y: 0.25 };
    paintLightLeak(canvas, ctx, width, height, source, { frame: 0, amount: 1 });
    const data = pixels(canvas), w = canvas.width, h = canvas.height;
    const composite = document.createElement("canvas"); composite.width = w; composite.height = h;
    const compositeCtx = composite.getContext("2d")!;
    compositeCtx.fillStyle = "#404040"; compositeCtx.fillRect(0, 0, w, h);
    blendLightLeak(compositeCtx, canvas, w, h, LIGHT_LEAK_PHOTO_GAIN);
    blendLightLeak(compositeCtx, canvas, w, h, LIGHT_LEAK_CHARACTER_GAIN);
    const result = pixels(composite);
    let broad = 0, near = 0, far = 0, white = 0, visible = 0, farCornerMax = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3]! > 8) {
          expect(Math.max(data[i]!, data[i + 1]!, data[i + 2]!) - Math.min(data[i]!, data[i + 1]!, data[i + 2]!)).toBeLessThanOrEqual(1);
        }
        const alpha = data[i + 3]! / 255;
        if (alpha > 0.1) broad++;
        if (x < w / 2 && y < h / 2) near += alpha;
        if (x > w / 2 && y > h / 2) far += alpha;
        const composited = result[i]!;
        if (x > w * 0.75 && y > h * 0.75) farCornerMax = Math.max(farCornerMax, composited - 64);
        if (composited > 230) white++;
        if (composited - 64 < 30) visible++;
      }
    }
    expect(broad / (w * h)).toBeGreaterThan(0.3);
    expect(broad / (w * h)).toBeLessThan(0.65);
    expect(near).toBeGreaterThan(far * 8);
    expect(white / (w * h)).toBeLessThan(0.05);
    expect(visible / (w * h)).toBeGreaterThan(0.5);
    expect(farCornerMax).toBeLessThanOrEqual(2);
    expect(Math.max(...result.filter((_, i) => i % 4 === 0))).toBeGreaterThan(245);
    const alphaAt = (x: number, y: number) => data[(Math.round(y) * w + Math.round(x)) * 4 + 3]!;
    const cx = Math.round(source.x * w), cy = Math.round(source.y * h);
    expect(alphaAt(cx, cy)).toBeGreaterThan(250);
    // 半径方向の階調差を制限し、帯・硬い芯・外周の段差を検出する。
    let previous = alphaAt(cx, cy);
    for (let dx = 1; cx + dx < w; dx++) {
      const alpha = alphaAt(cx + dx, cy);
      expect(alpha).toBeLessThanOrEqual(previous);
      expect(previous - alpha).toBeLessThanOrEqual(5);
      previous = alpha;
    }
    for (const distance of [10, 25, 40]) {
      expect(Math.abs(alphaAt(cx + distance, cy) - alphaAt(cx, cy + distance))).toBeLessThanOrEqual(3);
    }
  });

  it.each([{ x: 0.22, y: 0.3 }, { x: 0.75, y: 0.55 }, { x: 0.5, y: 0.78 }])(
    "tracks the synthetic photo spot at $x,$y in both the source and composited glow", async (spot) => {
      const fixture = await photo({ width, height, spots: [spot] });
      const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      compositor.setAspect(mode);
      try {
        const source = sourceFor(fixture.bitmap);
        expect(Math.abs(source.x - spot.x)).toBeLessThan(0.04);
        expect(Math.abs(source.y - spot.y)).toBeLessThan(0.04);
        compositor.draw(video(), [fixture], timeline, 0.5, "lightleak");
        const peak = brightest(compositor.canvas);
        expect(Math.abs(peak.x - spot.x)).toBeLessThan(0.04);
        expect(Math.abs(peak.y - spot.y)).toBeLessThan(0.04);
        const data = pixels(compositor.canvas);
        const x = Math.floor(spot.x * compositor.canvas.width), y = Math.floor(spot.y * compositor.canvas.height);
        expect(data[(y * compositor.canvas.width + x) * 4]).toBeGreaterThan(245);
      } finally { fixture.bitmap.close(); compositor.destroy(); }
    },
  );

  it("ignores the brighter spot cropped out by cover", async () => {
    const hidden = mode === "landscape" ? { x: 0.5, y: 0.05 } : { x: 0.05, y: 0.5 };
    const visible = { x: 0.62, y: 0.62, brightness: 160 };
    const fixture = await photo({ width: 640, height: 640, spots: [{ ...hidden, brightness: 255 }, visible] });
    try {
      const dest = plateDest(640, 640, width, height, { scale: 1, dy: 0 }, "lightleak");
      const source = sourceFor(fixture.bitmap);
      expect(Math.abs(source.x - (dest.x + visible.x * dest.w) / width)).toBeLessThan(0.06);
      expect(Math.abs(source.y - (dest.y + visible.y * dest.h) / height)).toBeLessThan(0.06);
    } finally { fixture.bitmap.close(); }
  });

  it("falls back for dark, flat, or visibly flat cropped photos", async () => {
    for (const options of [
      { background: 8, spots: [{ x: 0.8, y: 0.6, brightness: 40 }] },
      { background: 180 },
      { background: 180, spots: [{ x: 0.8, y: 0.6, brightness: 190 }] },
    ]) {
      const fixture = await photo({ width, height, ...options });
      try { expect(sourceFor(fixture.bitmap)).toEqual(LIGHT_LEAK_FALLBACK); }
      finally { fixture.bitmap.close(); }
    }
    const hidden = mode === "landscape" ? { x: 0.5, y: 0.05 } : { x: 0.05, y: 0.5 };
    const cropped = await photo({ width: 640, height: 640, background: 64, spots: [{ ...hidden, brightness: 255 }] });
    try { expect(sourceFor(cropped.bitmap)).toEqual(LIGHT_LEAK_FALLBACK); }
    finally { cropped.bitmap.close(); }
  });

  it("uses the outgoing spot before the cut and the incoming spot on and after it", async () => {
    const spots = [{ x: 0.24, y: 0.3 }, { x: 0.76, y: 0.7 }];
    const fixtures = await Promise.all(spots.map((spot) => photo({ width, height, spots: [spot] })));
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    compositor.setAspect(mode);
    const paint = vi.spyOn(CanvasRenderingContext2D.prototype, "createRadialGradient");
    try {
      for (let frame = -4; frame <= 4; frame++) {
        paint.mockClear();
        compositor.draw(video(), fixtures, timeline, 0.5 + frame / 30, "lightleak");
        const [x, y] = paint.mock.calls[0]!;
        const short = LIGHT_LEAK_SHORT_SIDE;
        const w = mode === "landscape" ? Math.round(short * 16 / 9) : short;
        const h = mode === "landscape" ? short : Math.round(short * 16 / 9);
        const spot = spots[frame < 0 ? 0 : 1]!;
        expect(Math.abs(x / w - spot.x)).toBeLessThan(0.04);
        expect(Math.abs(y / h - spot.y)).toBeLessThan(0.04);
        const peak = brightest(compositor.canvas);
        expect(Math.abs(peak.x - spot.x)).toBeLessThan(0.04);
        expect(Math.abs(peak.y - spot.y)).toBeLessThan(0.04);
      }
    } finally { fixtures.forEach((f) => f.bitmap.close()); compositor.destroy(); }
  });

  it("matches every pixel after reseeking, aspect changes, and in a separate compositor", async () => {
    const preview = createCompositor({ resolutionScale: 0.31, createKeyer: () => null });
    const saved = createCompositor({ resolutionScale: 0.31, createKeyer: () => null });
    preview.setAspect(mode); saved.setAspect(mode);
    const fixtures = await Promise.all([
      photo({ pattern: true, spots: [{ x: 0.3, y: 0.4 }] }),
      photo({ pattern: true, spots: [{ x: 0.7, y: 0.6 }] }),
    ]);
    try {
      for (const frame of [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]) {
        const time = 0.5 + frame / 30;
        preview.draw(video(), fixtures, timeline, time, "lightleak");
        const expected = await digest(pixels(preview.canvas));
        preview.setAspect(mode === "portrait" ? "landscape" : "portrait");
        preview.draw(video(), fixtures, timeline, 0.7, "lightleak");
        preview.setAspect(mode);
        preview.draw(video(), fixtures, timeline, time, "lightleak");
        saved.draw(video(), fixtures, timeline, time, "lightleak");
        expect(await digest(pixels(preview.canvas))).toBe(expected);
        expect(await digest(pixels(saved.canvas))).toBe(expected);
      }
    } finally { fixtures.forEach((f) => f.bitmap.close()); preview.destroy(); saved.destroy(); }
  });

  it("does no frame readback or allocation, reuses the surface, and does no analysis or extra drawing outside the window", async () => {
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    compositor.setAspect(mode);
    const fixture = await photo();
    const unprepared = await photo({ prepare: false });
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
        const active = frame >= -4 && frame <= 4;
        compositor.draw(source, [active ? fixture : unprepared], timeline, 0.5 + frame / 30, "lightleak");
        expect(draw).toHaveBeenCalledTimes(active ? 4 : 2);
        expect(gradient).toHaveBeenCalledTimes(active ? 1 : 0);
        if (active) {
          const [canvas, x, y, w, h] = draw.mock.calls[1]!;
          expect([x, y, w, h]).toEqual([0, 0, compositor.canvas.width, compositor.canvas.height]);
          if (surface) expect(canvas).toBe(surface);
          surface = canvas as HTMLCanvasElement;
          expect(Math.min(surface.width, surface.height)).toBe(LIGHT_LEAK_SHORT_SIDE);
          expect(draw.mock.calls[2]![0]).toBe(surface);
        }
      }
      expect(read).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(random).not.toHaveBeenCalled();
    } finally { fixture.bitmap.close(); unprepared.bitmap.close(); compositor.destroy(); }
  });

  it("uses screen at 95% on the photo and only 12% after the character", async () => {
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    compositor.setAspect(mode);
    const fixture = await photo();
    const source = document.createElement("canvas"); source.width = 1920; source.height = 1080;
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
      compositor.draw(video(), [fixture], timeline, 0.5, "lightleak", "none", { source, width: 1920, height: 1080 });
      expect(operations).toEqual([
        { alpha: 0.95, op: "screen", smoothing: true },
        { alpha: 0.12, op: "screen", smoothing: true },
      ]);
    } finally { draw.mockRestore(); fixture.bitmap.close(); compositor.destroy(); }
  });
});

it("analyzes once per loaded bitmap, caches across preparations/compositors, and uses a long-edge 32 grid", async () => {
  const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#404040"; ctx.fillRect(0, 0, 640, 480);
  ctx.fillStyle = "#eee"; ctx.fillRect(400, 200, 50, 50);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
  const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
  const loaded = await loadPhotos([new File([blob], "spot.png", { type: "image/png" })]);
  const other = await photo({ width: 360, height: 640, prepare: false });
  const a = createCompositor({ resolutionScale: 0.1, createKeyer: () => null });
  const b = createCompositor({ resolutionScale: 0.1, createKeyer: () => null });
  try {
    expect(read.mock.calls).toEqual([[0, 0, 32, 24]]);
    prepareLightLeakPhoto(loaded[0]!.bitmap);
    prepareLightLeakPhoto(other.bitmap);
    prepareLightLeakPhoto(other.bitmap);
    expect(read.mock.calls).toEqual([[0, 0, 32, 24], [0, 0, 18, 32]]);
    read.mockClear();
    for (const compositor of [a, b]) {
      for (const mode of ["portrait", "landscape"] as const) {
        compositor.setAspect(mode);
        for (let frame = -5; frame <= 5; frame++) {
          compositor.draw(video(), [loaded[0]!, other], timeline, 0.5 + frame / 30, "lightleak");
        }
      }
    }
    expect(read).not.toHaveBeenCalled();
  } finally { revokePhotos(loaded); other.bitmap.close(); a.destroy(); b.destroy(); }
});

it("resolves tied maximum cells in index order deterministically", async () => {
  const fixture = await photo({ width: 640, height: 640, spots: [
    { x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 },
  ] });
  try {
    for (let i = 0; i < 3; i++) {
      const source = lightLeakSource(fixture.bitmap, { x: 0, y: 0, w: 640, h: 640 }, 640, 640);
      expect(source.x).toBeLessThan(0.3); expect(source.y).toBeLessThan(0.3);
    }
  } finally { fixture.bitmap.close(); }
});

it("smooths an isolated hot cell so the larger bright region wins", async () => {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = "#fff"; ctx.fillRect(4, 4, 1, 1);
  ctx.fillStyle = "rgb(100, 100, 100)"; ctx.fillRect(20, 20, 5, 5);
  const bitmap = await createImageBitmap(canvas);
  try {
    prepareLightLeakPhoto(bitmap);
    const source = lightLeakSource(bitmap, { x: 0, y: 0, w: 320, h: 320 }, 320, 320);
    expect(source.x).toBeGreaterThan(0.6); expect(source.y).toBeGreaterThan(0.6);
  } finally { bitmap.close(); }
});
