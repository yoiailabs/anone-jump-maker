import { beforeAll, expect, it, vi } from "vitest";
let cuts: { slots: number[]; slotFrames: number[] };
beforeAll(async () => {
  cuts = await fetch("/official-assets/template/landscape-cuts.json").then((response) => response.json());
});
import { createCompositor } from "./compositor.ts";
import { drawCatIris } from "./catiris.ts";
import { swapFx } from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";

async function photo(w: number, h: number, color: string): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return { id: color, name: "fixture", bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}
const pixels = (canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
function same(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function opaqueAndBright(data: Uint8ClampedArray): boolean {
  for (let i = 0; i < data.length; i += 4) {
    // 薄いステッカー影とクレジットの影は許すが、暗い下地の欠けを許さない。
    if (data[i + 3] !== 255 || Math.min(data[i]!, data[i + 1]!, data[i + 2]!) < 70) return false;
  }
  return true;
}
function edgeLine(data: Uint8ClampedArray, w: number, h: number): number {
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  const diff = (i: number, j: number) => Math.max(...[0, 1, 2].map((c) => Math.abs(data[i + c]! - data[j + c]!)));
  const edges: number[] = [];
  for (const x of [0, w - 1]) {
    const inner = x === 0 ? 1 : w - 2;
    edges.push(median(Array.from({ length: h }, (_, y) => diff((y * w + x) * 4, (y * w + inner) * 4))));
  }
  for (const y of [0, h - 1]) {
    const inner = y === 0 ? 1 : h - 2;
    edges.push(median(Array.from({ length: w }, (_, x) => diff((y * w + x) * 4, (inner * w + x) * 4))));
  }
  return Math.max(...edges);
}

for (const mode of ["landscape", "portrait"] as const) {
  for (const resolutionScale of [0.1, 0.3325, 1]) {
    it(`${mode} ${resolutionScale}: every window phase stays covered, has no edge line and seeks deterministically`, async () => {
      const a = createCompositor({ resolutionScale, createKeyer: () => null });
      const b = createCompositor({ resolutionScale, createKeyer: () => null });
      a.setAspect(mode);
      b.setAspect(mode);
      const photos = [await photo(303, 303, "rgb(140, 160, 180)"), await photo(401, 199, "rgb(180, 150, 140)")];
      const video = document.createElement("video");
      const capture = () => pixels(a.canvas);
      try {
        // 全カットは縮小解像度で検査。実寸は最初と丸めた59番の各位相を検査し、
        // 同じ形の巨大な読み戻しバッファを全31カット分繰り返し生成しない。
        const cutFrames = resolutionScale === 1 ? [cuts.slotFrames[1]!, 59] : cuts.slotFrames.slice(1);
        for (const cut of cutFrames) {
          for (let k = -3; k <= 4; k++) {
            const time = (cut + k) / 30;
            a.draw(video, photos, cuts, time, "catiris");
            const expected = capture();
            expect(opaqueAndBright(expected), `cut ${cut}, k=${k}`).toBe(true);
            expect(edgeLine(expected, a.canvas.width, a.canvas.height), `edge at ${cut + k}`).toBeLessThanOrEqual(3);
            a.draw(video, photos, cuts, 0, "catiris");
            a.draw(video, photos, cuts, time, "catiris");
            b.draw(video, photos, cuts, time, "catiris");
            expect(same(expected, capture()), `seek ${cut + k}`).toBe(true);
            expect(same(expected, pixels(b.canvas)), `instance ${cut + k}`).toBe(true);
          }
        }
      } finally {
        photos.forEach((p) => p.bitmap.close());
        a.destroy(); b.destroy();
      }
    });
  }

  it(`${mode}: reveals the next photo over the previous plate, including rounded cut 59`, async () => {
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    compositor.setAspect(mode);
    const photos = [await photo(203, 401, "rgb(160, 100, 100)"), await photo(401, 203, "rgb(100, 160, 100)")];
    const video = document.createElement("video");
    try {
      for (const frame of [56, 57, 58, 59, 60, 61, 62, 63]) {
        const fx = swapFx(frame / 30, cuts.slots, "catiris", mode);
        compositor.draw(video, photos, cuts, frame / 30, "catiris");
        const data = pixels(compositor.canvas);
        const { width: w, height: h } = compositor.canvas;
        const center = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
        // cut 59 のスロットは4。旧 slot3 は緑、新 slot4 は赤。
        expect([...data.slice(center, center + 3)]).toEqual([160, 100, 100]);
        if (frame <= 60) expect([...data.slice(0, 3)]).toEqual([100, 160, 100]);
        if (frame === 63) {
          expect(fx.reveal).toBeUndefined();
          expect([...data.slice(0, 3)]).toEqual([160, 100, 100]);
        }
      }
      // 終端直前も白縁・影を含めて四隅を通過済み。
      const canvas = document.createElement("canvas");
      canvas.width = compositor.canvas.width; canvas.height = compositor.canvas.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#00f"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawCatIris(ctx, photos[0]!.bitmap, canvas.width, canvas.height, 1);
      expect(pixels(canvas).every((v, i) => v === [160, 100, 100, 255][i % 4])).toBe(true);
    } finally {
      photos.forEach((p) => p.bitmap.close()); compositor.destroy();
    }
  });
}

it("adds no drawing outside windows, allocates no surfaces and never reads pixels during reveal", async () => {
  const compositor = createCompositor({ resolutionScale: 0.1, createKeyer: () => null });
  const p = await photo(303, 203, "#aaa");
  const video = document.createElement("video");
  const draw = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
  const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
  const clip = vi.spyOn(CanvasRenderingContext2D.prototype, "clip");
  const stroke = vi.spyOn(CanvasRenderingContext2D.prototype, "stroke");
  const allocate = vi.spyOn(document, "createElement");
  try {
    for (let n = 0; n < 470; n++) {
      draw.mockClear(); clip.mockClear(); stroke.mockClear();
      compositor.draw(video, [p], cuts, n / 30, "catiris");
      const active = swapFx(n / 30, cuts.slots, "catiris").reveal !== undefined;
      expect(draw).toHaveBeenCalledTimes(active ? 3 : 2);
      expect(clip).toHaveBeenCalledTimes(active ? 1 : 0);
      expect(stroke).toHaveBeenCalledTimes(active ? 1 : 0);
    }
    expect(read).not.toHaveBeenCalled();
    expect(allocate).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks(); p.bitmap.close(); compositor.destroy();
  }
});
