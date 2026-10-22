import { expect, it, vi } from "vitest";
import { charaIrisCenter, drawCharaIris } from "./charairis.ts";
import { createCompositor } from "./compositor.ts";
import { applyColorFilter, COLOR_FILTERS } from "./color-filter.ts";
import { PHOTO_BASE_COLOR, swapFx, type ImageFilter } from "./layout.ts";
import { withComposeDetail } from "./perf-trace.ts";
import type { LoadedPhoto } from "./photos.ts";

const timeline = { slots: [0, 1] };
const filters = ["none", "blur-weak", "blur-strong"] as const;
// 固定256×256 RGBA。左半分は透明、右半分は(240,0,0,128)。
// Pillowで一度だけPNG/WebP(lossless)へ変換。ブラウザのWebPエンコーダには依存しない。
const transparentFixtures = {
  "image/png": "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAACX0lEQVR42u3UQQEAMAjEsGPKkYwEDMwBiYQ+WuG0SVqFu54EYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGAAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGAAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgA8LMgjANwKK9G+wAAAABJRU5ErkJggg==",
  "image/webp": "UklGRigAAABXRUJQVlA4TBwAAAAv/8A/EA8QAx8DGAwhAeH/adEEEf2fALJ5/w0+",
} as const;
const pixels = (canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
function snapshot(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width; canvas.height = source.height;
  canvas.getContext("2d")!.drawImage(source, 0, 0);
  return canvas;
}
async function transparentPhoto(mime: keyof typeof transparentFixtures): Promise<LoadedPhoto> {
  const bytes = Uint8Array.from(atob(transparentFixtures[mime]), (char) => char.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  expect([bitmap.width, bitmap.height]).toEqual([256, 256]);
  expect(ctx.getImageData(64, 128, 1, 1).data[3]).toBe(0);
  expect(ctx.getImageData(192, 128, 1, 1).data[3]).toBe(128);
  return { id: mime, name: "fixture", bitmap, thumbUrl: "" };
}
async function photo(color: string): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#000";
  for (let x = 0; x < 256; x += 8) ctx.fillRect(x, 0, 3, 256);
  return { id: color, name: "fixture", bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}
function equal(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

for (const mode of ["landscape", "portrait"] as const) {
  for (const mime of ["image/png", "image/webp"] as const) {
    it(`${mode} ${mime}: transparent and translucent reveal interiors match normal drawing at the window end`, async () => {
      const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      compositor.setAspect(mode);
      const old = await photo("#00c000");
      const next = await transparentPhoto(mime);
      const video = document.createElement("video");
      try {
        for (const color of COLOR_FILTERS) for (const filter of filters) {
          const render = (time: number) => {
            compositor.draw(video, [old, next], timeline, time, "charairis", filter, undefined, "standard", color);
            return pixels(compositor.canvas);
          };
          const last = render(33 / 30);
          expect(swapFx(33 / 30, timeline.slots, "charairis", mode).reveal).toBeDefined();
          const normal = render(34 / 30);
          expect(swapFx(34 / 30, timeline.slots, "charairis", mode).reveal).toBeUndefined();
          const { width: w, height: h } = compositor.canvas;
          const short = Math.min(w, h);
          // 最後の整数revealフレームでは白縁・影まで画面外にある。
          expect(equal(last, normal), `${color}/${filter}: S+3 → S+4`).toBe(true);
          if (filter === "none") {
            const i = (Math.floor(h / 2) * w + Math.floor(w / 2 - short / 10)) * 4;
            expect([...last.slice(i, i + 3)]).toEqual([10, 8, 6]);
          }
          // 任意時刻の終端直前では白縁・影も画面外。全画素が通常描画へ連続する。
          const terminal = render(34 / 30 - 0.001);
          expect(swapFx(34 / 30 - 0.001, timeline.slots, "charairis", mode).reveal).toBeDefined();
          expect(equal(terminal, normal), `${color}/${filter}: terminal`).toBe(true);
        }
      } finally {
        old.bitmap.close(); next.bitmap.close(); compositor.destroy();
      }
    });
  }

  for (const color of ["dynamic", "dramatic", "film"] as const) for (const filter of filters) {
    it(`${mode} ${color}/${filter}: reveal matches separately processed photos, normal drawing and independent seeks`, async () => {
      const timeline = { slots: [0, 1.966667] }; // 実テンプレの丸めたcut 59も検査する。
      const a = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      const b = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      const reference = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      a.setAspect(mode); b.setAspect(mode); reference.setAspect(mode);
      const photos = [await photo("#b87040"), await photo("#4080b0")];
      const video = document.createElement("video");
      try {
        const normal = (p: LoadedPhoto) => {
          reference.draw(video, [p], timeline, 0, "charairis", filter, undefined, "standard", color);
          return snapshot(reference.canvas);
        };
        const old = normal(photos[0]!);
        const next = normal(photos[1]!);
        // ブラーなしは原寸写真を直接clipする経路。通常描画の縮小済み写真を
        // 再描画するとclip境界の補間が異なるため、原寸で色加工した参照を使う。
        const nextSource = document.createElement("canvas");
        nextSource.width = nextSource.height = 256;
        const sourceCtx = nextSource.getContext("2d")!;
        sourceCtx.drawImage(photos[1]!.bitmap, 0, 0);
        const image = sourceCtx.getImageData(0, 0, 256, 256);
        applyColorFilter(image.data, color);
        sourceCtx.putImageData(image, 0, 0);
        const render = (comp: typeof a, frame: number) => {
          comp.draw(video, photos, timeline, frame / 30, "charairis", filter, undefined, "standard", color);
          return pixels(comp.canvas);
        };
        for (let frame = 56; frame <= 62; frame++) {
          const expected = snapshot(old);
          const { width: w, height: h } = expected;
          drawCharaIris(expected.getContext("2d")!, filter === "none" ? nextSource : next, w, h,
            swapFx(frame / 30, timeline.slots, "charairis", mode).reveal!.progress,
            charaIrisCenter(frame / 30, w, h, mode));
          // 両compositorの描画/readback回数を揃え、seek履歴のみ変える。
          const first = render(a, frame);
          render(a, 0);
          const actual = render(a, frame);
          render(b, frame); render(b, frame);
          expect(equal(actual, first), `seek ${frame}`).toBe(true);
          expect(equal(actual, render(b, frame)), `instance ${frame}`).toBe(true);
          // クレジットは最終合成のため除外。穴内外と白フチを厳密比較する。
          const end = Math.floor(h * 0.8) * w * 4;
          expect(equal(actual.slice(0, end), pixels(expected).slice(0, end)), `interior ${frame}`).toBe(true);
          if (frame === 62) expect(equal(actual, render(a, 63)), "S+3 → S+4 full frame").toBe(true);
        }
      } finally {
        photos.forEach((p) => p.bitmap.close()); a.destroy(); b.destroy(); reference.destroy();
      }
    });
  }

  for (const filter of ["blur-weak", "blur-strong"] as const) {
    it(`${mode} ${filter}: filters each photo before masking and keeps the white outline and shadow sharp`, async () => {
      const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      compositor.setAspect(mode);
      const photos = [await photo("#e00000"), await photo("#0000e0")];
      const video = document.createElement("video");
      const parent = { startChild: () => null } as unknown as Parameters<typeof withComposeDetail>[0];
      try {
        const normal = (p: LoadedPhoto, f: ImageFilter) => {
          compositor.draw(video, [p], timeline, 0, "charairis", f);
          return snapshot(compositor.canvas);
        };
        const old = normal(photos[0]!, filter);
        const next = normal(photos[1]!, filter);
        expect(equal(pixels(old), pixels(normal(photos[0]!, "none")))).toBe(false);
        // 通常描画で個別に加工した写真をマスク合成する独立の期待値。
        for (const frame of [27, 28, 29, 30, 31, 32, 33]) {
          const expected = snapshot(old);
          const { width: w, height: h } = expected;
          const progress = swapFx(frame / 30, timeline.slots, "charairis", mode).reveal!.progress;
          drawCharaIris(expected.getContext("2d")!, next, w, h, progress, charaIrisCenter(frame / 30, w, h, mode));
          const reference = pixels(expected);
          for (const traced of [false, true]) {
            const render = () => compositor.draw(video, photos, timeline, frame / 30, "charairis", filter);
            if (traced) withComposeDetail(parent, render);
            else render();
            const actual = pixels(compositor.canvas);
            // 下端のクレジットは最終合成で描くため除外し、穴内外・白縁・影を全画素比較する。
            const end = Math.floor(h * 0.8) * w * 4;
            expect(equal(actual.slice(0, end), reference.slice(0, end)), `frame ${frame}, traced=${traced}`).toBe(true);
            if (frame === 28) {
              let white = 0, outside = 0;
              for (let i = 0; i < end; i += 4) {
                if (reference[i] === 255 && reference[i + 1] === 255 && reference[i + 2] === 255) {
                  expect([...actual.slice(i, i + 3)]).toEqual([255, 255, 255]);
                  white++;
                }
                // 赤い旧写真の純色領域へ青い次写真が漏れていないことを直接検査する。
                if (reference[i]! > 20 && reference[i + 1] === 0 && reference[i + 2] === 0) {
                  expect(actual[i + 2]).toBe(0);
                  outside++;
                }
              }
              expect(white).toBeGreaterThan(Math.min(w, h));
              expect(outside).toBeGreaterThan(w * h / 5);
            }
          }
        }
      } finally {
        photos.forEach((p) => p.bitmap.close()); compositor.destroy();
      }
    });
  }
}

it.each(["blur-weak", "blur-strong"] as const)("%s: does no extra copying, allocation or resizing outside reveal windows", async (filter) => {
  const compositor = createCompositor({ resolutionScale: 0.1, createKeyer: () => null });
  const p = await photo(PHOTO_BASE_COLOR);
  const video = document.createElement("video");
  const draw = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
  const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
  const allocate = vi.spyOn(document, "createElement");
  const width = vi.spyOn(HTMLCanvasElement.prototype, "width", "set");
  const height = vi.spyOn(HTMLCanvasElement.prototype, "height", "set");
  try {
    for (const time of [0, 1, 31 / 30, 1.5]) {
      draw.mockClear(); read.mockClear(); width.mockClear(); height.mockClear();
      compositor.draw(video, [p], timeline, time, "charairis", filter);
      const active = swapFx(time, timeline.slots, "charairis").reveal !== undefined;
      expect(draw).toHaveBeenCalledTimes(active ? 8 : 4);
      expect(read).toHaveBeenCalledTimes(active ? 2 : 1);
      // 窓外は従来のmain初期化と既存ブラー面だけ。窓内のみ既存fxAを使う。
      expect(width).toHaveBeenCalledTimes(active ? (time === 1 ? 4 : 3) : 2);
      expect(height).toHaveBeenCalledTimes(active ? (time === 1 ? 4 : 3) : 2);
    }
    expect(allocate).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks(); p.bitmap.close(); compositor.destroy();
  }
});

for (const color of ["dynamic", "dramatic", "film"] as const) for (const filter of filters) {
  it(`${color}/${filter}: caches both photos throughout a window and releases both on invalidation`, async () => {
    const comp = createCompositor({ resolutionScale: 0.1, createKeyer: () => null });
    const photos = [await photo("#b87040"), await photo("#4080b0")];
    const replacement = await photo("#507060");
    const video = document.createElement("video");
    const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
    const allocate = vi.spyOn(document, "createElement");
    const render = (frame: number, ps = photos, c = color as typeof COLOR_FILTERS[number], style = "charairis" as "charairis" | "zoom") =>
      comp.draw(video, ps, timeline, frame / 30, style, filter, undefined, "standard", c);
    // 写真の原寸読戻しだけを数える。ブラーの出力解像度での読戻しは別。
    const colorReads = () => read.mock.calls.flatMap((args, i) => args[2] === 256 && args[3] === 256
      ? [(read.mock.contexts[i] as CanvasRenderingContext2D).canvas] : []);
    const released = (canvases: HTMLCanvasElement[]) => {
      for (const canvas of canvases) expect([canvas.width, canvas.height]).toEqual([0, 0]);
    };
    try {
      render(26);
      expect(colorReads()).toHaveLength(1);
      render(27);
      const cached = colorReads();
      expect(cached).toHaveLength(2);
      expect(new Set(cached).size).toBe(2);
      allocate.mockClear();
      for (let frame = 28; frame <= 33; frame++) render(frame);
      expect(colorReads()).toHaveLength(2);
      expect(allocate).not.toHaveBeenCalled();
      comp.setAspect("portrait"); comp.setResolutionScale(0.2); comp.resetCharacter();
      render(32);
      expect(colorReads()).toHaveLength(2);

      render(32, photos, "none");
      released(cached);
      read.mockClear();
      render(32);
      const beforeChange = colorReads();
      expect(beforeChange).toHaveLength(2);
      const otherColor = color === "film" ? "dynamic" : "film";
      render(32, photos, otherColor);
      released(beforeChange);
      expect(colorReads()).toHaveLength(4);
      const afterChange = colorReads().slice(2);
      render(32, []);
      released(afterChange);

      read.mockClear();
      render(32);
      const beforeReplace = colorReads();
      render(32, [photos[0]!, replacement]);
      expect(colorReads()).toHaveLength(3);
      released([beforeReplace[1]!]);
      expect(beforeReplace[0]!.width).toBe(256);
      const next = colorReads()[2]!;
      render(34);
      released([next]);
      read.mockClear();
      render(32);
      const beforeStyle = colorReads();
      render(32, photos, color, "zoom");
      released([beforeStyle[1]!]);

      read.mockClear();
      render(32);
      const active = colorReads();
      expect(active).toHaveLength(2);
      comp.destroy();
      released(active);
    } finally {
      vi.restoreAllMocks(); comp.destroy();
      [...photos, replacement].forEach((p) => p.bitmap.close());
    }
  });
}
