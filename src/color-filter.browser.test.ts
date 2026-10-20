import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";
import { COLOR_FILTERS, createColorPhotoCache } from "./color-filter.ts";
import { createCompositor } from "./compositor.ts";
import { exportJumpVideo, hasWebCodecsVideoEncoder } from "./export.ts";
import { IMAGE_FILTERS, swapFx } from "./layout.ts";
import { pickOfflinePlan } from "./offline-encode.ts";
import type { LoadedPhoto } from "./photos.ts";

vi.mock("./layout.ts", { spy: true });
afterEach(() => vi.mocked(swapFx).mockReset());

async function photo(w = 320, h = 180): Promise<LoadedPhoto> {
  const source = document.createElement("canvas");
  source.width = w;
  source.height = h;
  const ctx = source.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#edae8f");
  gradient.addColorStop(0.5, "#bd6b42");
  gradient.addColorStop(1, "#354b70");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  return { id: "colors", name: "fixture", bitmap: await createImageBitmap(source), thumbUrl: "" };
}
const pixels = (canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
function maxDiff(a: ArrayLike<number>, b: ArrayLike<number>) {
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i]! - b[i]!));
  return max;
}

it("caches only the active source, invalidates on changes and frees its canvas", async () => {
  const p = await photo();
  const q = await photo();
  const cache = createColorPhotoCache();
  const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
  try {
    expect(cache.get(p.bitmap, "none")).toBe(p.bitmap);
    expect(read).not.toHaveBeenCalled();
    const a = cache.get(p.bitmap, "sepia") as HTMLCanvasElement;
    expect(read).toHaveBeenCalledTimes(1);
    expect(cache.get(p.bitmap, "sepia")).toBe(a);
    expect(read).toHaveBeenCalledTimes(1);
    const b = cache.get(p.bitmap, "film") as HTMLCanvasElement;
    expect(a.width).toBe(0);
    expect(read).toHaveBeenCalledTimes(2);
    const c = cache.get(q.bitmap, "film") as HTMLCanvasElement;
    expect(b.width).toBe(0);
    expect(read).toHaveBeenCalledTimes(3);
    expect(cache.get(undefined, "film")).toBeUndefined();
    expect(c.width).toBe(0);
    const d = cache.get(p.bitmap, "warm") as HTMLCanvasElement;
    cache.get(p.bitmap, "none");
    expect(d.width).toBe(0);
    const e = cache.get(p.bitmap, "cool") as HTMLCanvasElement;
    cache.clear();
    expect(e.width).toBe(0);
  } finally {
    read.mockRestore();
    cache.clear();
    p.bitmap.close();
    q.bitmap.close();
  }
});

it("none adds no readback and color never assigns ctx.filter", async () => {
  const p = await photo();
  const comp = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
  const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
  // filter プロパティ自体がない Safari でも描画検査を実行する。
  const filter = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "filter")?.set
    ? vi.spyOn(CanvasRenderingContext2D.prototype, "filter", "set") : undefined;
  try {
    const video = document.createElement("video");
    comp.draw(video, [p], { slots: [0] }, 0.2, "zoom", "none");
    expect(read).not.toHaveBeenCalled();
    for (const color of COLOR_FILTERS) comp.draw(video, [p], { slots: [0] }, 0.2, "zoom", "none", undefined, "standard", color);
    if (filter) expect(filter.mock.calls.every(([value]) => value === "none")).toBe(true);
  } finally {
    read.mockRestore();
    filter?.mockRestore();
    p.bitmap.close();
    comp.destroy();
  }
});

describe("shared preview / WebCodecs photo processing", () => {
  for (const aspect of ["landscape", "portrait"] as const) {
    it(`${aspect}: all color × blur combinations match RGBA-copy export and preserve character pixels`, async () => {
      const p = await photo();
      const preview = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      const saved = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      preview.setAspect(aspect);
      saved.setAspect(aspect);
      const plate = document.createElement("canvas");
      plate.width = 320;
      plate.height = 180;
      const ctx = plate.getContext("2d")!;
      ctx.fillStyle = "#20b836";
      ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = "#64364a";
      ctx.fillRect(100, 80, 120, 80);
      // 保存で使う WebCodecs の RGBA copyTo と同じ受け渡し。
      const bytes = new Uint8ClampedArray(320 * 180 * 4);
      if (typeof VideoFrame !== "undefined") {
        const frame = new VideoFrame(plate, { timestamp: 0 });
        try { await frame.copyTo(bytes, { format: "RGBA" }); }
        finally { frame.close(); }
      } else {
        bytes.set(ctx.getImageData(0, 0, 320, 180).data);
      }
      const copied = document.createElement("canvas");
      copied.width = 320;
      copied.height = 180;
      copied.getContext("2d")!.putImageData(new ImageData(bytes, 320, 180), 0, 0);
      const video = document.createElement("video");
      const draw = (comp: typeof preview, source: HTMLCanvasElement, blur: typeof IMAGE_FILTERS[number], color: typeof COLOR_FILTERS[number], time = 0.2) => {
        comp.draw(video, [p], { slots: [0, 0.5] }, time, "zoom", blur, { source, width: 320, height: 180 }, "standard", color);
        return pixels(comp.canvas);
      };
      try {
        const original = draw(preview, plate, "none", "none");
        // 不透明なキャラの内部だけを選び、背景と混ざる縁は除く。
        const characterIndices: number[] = [];
        const whiteIndices: number[] = [];
        for (let i = 0; i < original.length; i += 4) {
          if (original[i] === 100 && original[i + 1] === 54 && original[i + 2] === 74) characterIndices.push(i);
          if (original[i] === 255 && original[i + 1] === 255 && original[i + 2] === 255) whiteIndices.push(i);
        }
        expect(characterIndices.length).toBeGreaterThan(100);
        expect(whiteIndices.length).toBeGreaterThan(100);
        for (const color of COLOR_FILTERS) for (const blur of IMAGE_FILTERS) {
          const actual = draw(preview, plate, blur, color);
          const expected = draw(saved, copied, blur, color);
          expect(maxDiff(actual, expected), `${color}/${blur}`).toBe(0);
          let characterError = 0;
          for (const i of [...characterIndices, ...whiteIndices]) for (let c = 0; c < 3; c++) {
            characterError = Math.max(characterError, Math.abs(actual[i + c]! - original[i + c]!));
          }
          expect(characterError, `${color}/${blur}: character`).toBe(0);
          if (color !== "none") expect(maxDiff(actual, original)).toBeGreaterThan(0);
        }
        // 写真への白フラッシュを強制し、色処理が白に掛からないことを検査する。
        const flash = { ...swapFx(0.2, [0, 0.5], "zoom", aspect), flashAdd: 1, flashScreen: 1 };
        vi.mocked(swapFx).mockReturnValue(flash);
        const whiteFlash = draw(preview, plate, "none", "none");
        for (const color of COLOR_FILTERS) {
          expect(maxDiff(draw(preview, plate, "none", color), whiteFlash), `${color}: white flash`).toBe(0);
        }
      } finally {
        preview.destroy();
        saved.destroy();
        p.bitmap.close();
      }
    });
  }

  it("encodes each color with blur through the real offline export callback", async ({ skip }) => {
    if (!hasWebCodecsVideoEncoder() || !await pickOfflinePlan(320, 180)) skip();
    const p = await photo();
    const preview = createCompositor({ resolutionScale: 1 / 6, createKeyer: () => null });
    const saved = createCompositor({ resolutionScale: 1 / 6, createKeyer: () => null });
    const video = document.createElement("video");
    let currentTime = 0;
    Object.defineProperties(video, {
      duration: { get: () => 0.1 }, readyState: { get: () => 2 },
      currentTime: { get: () => currentTime, set: (v: number) => { currentTime = v; queueMicrotask(() => video.dispatchEvent(new Event("seeked"))); } },
    });
    try {
      for (const color of COLOR_FILTERS) {
        const draw = (comp: typeof saved, time: number) => comp.draw(document.createElement("video"), [p], { slots: [0] }, time + 0.2, "zoom", "blur-weak", undefined, "standard", color);
        let frames = 0;
        const result = await exportJumpVideo({
          video, canvas: saved.canvas, duration: 0.1, fps: 30,
          draw: (time) => {
            draw(preview, time);
            draw(saved, time);
            expect(maxDiff(pixels(preview.canvas), pixels(saved.canvas))).toBe(0);
            frames++;
          },
        });
        expect(frames).toBeGreaterThanOrEqual(3);
        expect(result.mode).toBe("offline");
        const input = new Input({ source: new BlobSource(result.blob), formats: ALL_FORMATS });
        try {
          const track = await input.getPrimaryVideoTrack();
          expect(track).toBeTruthy();
          const decoded = await new CanvasSink(track!).getCanvas(0);
          expect(decoded).toBeTruthy();
          const expected = preview.canvas.getContext("2d")!.getImageData(160, 70, 1, 1).data;
          const actual = decoded!.canvas.getContext("2d")!.getImageData(160, 70, 1, 1).data;
          expect(maxDiff(actual, expected), color).toBeLessThanOrEqual(8);
        } finally { input.dispose(); }
      }
    } finally {
      preview.destroy();
      saved.destroy();
      p.bitmap.close();
    }
  });
});

