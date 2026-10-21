import { beforeAll, expect, it, vi } from "vitest";
let cuts: { slots: number[]; slotFrames: number[] };
beforeAll(async () => {
  cuts = await fetch("/official-assets/template/landscape-cuts.json").then((response) => response.json());
});
import { createCompositor, songCreditLayout } from "./compositor.ts";
import { charaIrisCenter, charaIrisRadius, drawCharaIris } from "./charairis.ts";
import { swapFx, type AspectMode } from "./layout.ts";
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

/** 厳密一致は維持し、失敗時だけ差の大きさと位置を記録する。領域は診断用で許容には使わない。 */
function expectSamePixels(
  expected: Uint8ClampedArray, actual: Uint8ClampedArray, canvas: HTMLCanvasElement,
  time: number, mode: AspectMode, label: string,
): void {
  if (same(expected, actual)) return;
  expect(actual.length, label).toBe(expected.length);
  const { width: w, height: h } = canvas;
  const reveal = swapFx(time, cuts.slots, "charairis", mode).reveal;
  const center = charaIrisCenter(time, w, h, mode);
  const radius = reveal ? charaIrisRadius(reveal.progress, w, h, center) : null;
  const border = Math.min(w, h) * 0.011;
  const credit = songCreditLayout(w, h, mode);
  // クレジットは影込みの保守的な矩形。白縁と重なる場合は両方に集計する。
  const creditTop = credit.y - credit.fontSize * 2 - Math.max(3, Math.round(credit.fontSize * 0.32));
  const regions = { whiteBorder: 0, formerShadowBand: 0, creditBox: 0, photo: 0 };
  const samples: { x: number; y: number; expected: number[]; actual: number[]; regions: string[] }[] = [];
  let count = 0, maxDiff = 0, left = w, right = -1, top = h, bottom = -1;
  for (let i = 0; i < actual.length; i += 4) {
    const delta = Math.max(...[0, 1, 2, 3].map((c) => Math.abs(expected[i + c]! - actual[i + c]!)));
    if (!delta) continue;
    const x = (i / 4) % w, y = Math.floor(i / 4 / w);
    count++; maxDiff = Math.max(maxDiff, delta);
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
    const areas: (keyof typeof regions)[] = [];
    if (radius !== null) {
      // AAの1pxを含む白縁と、削除した影の旧描画範囲を分ける。
      if (Math.abs(Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y) - radius) <= border / 2 + 1) areas.push("whiteBorder");
      else if (Math.abs(Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y - border * 0.15) - radius) <= border * 1.1 + 1) areas.push("formerShadowBand");
    }
    if (y >= creditTop) areas.push("creditBox");
    if (!areas.length) areas.push("photo");
    areas.forEach((area) => regions[area]++);
    if (samples.length < 8) samples.push({ x, y, expected: [...expected.slice(i, i + 4)], actual: [...actual.slice(i, i + 4)], regions: areas });
  }
  expect(false, `${label}: ${JSON.stringify({ mode, frame: time * 30, w, h, count, maxDiff,
    bbox: { left, top, right, bottom }, regions, center, radius, border, samples })}`).toBe(true);
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
  it(`${mode}: draws a white arc at every cut from S-2 through S+2 and clears it at S+3`, async () => {
    const w = mode === "landscape" ? 640 : 360, h = mode === "landscape" ? 360 : 640;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const black = await photo(2, 2, "#000");
    try {
      for (const cut of cuts.slotFrames.slice(1)) {
        for (let offset = -2; offset <= 3; offset++) {
          const time = (cut + offset) / 30;
          ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
          drawCharaIris(ctx, black.bitmap, w, h, swapFx(time, cuts.slots, "charairis", mode).reveal!.progress, charaIrisCenter(time, w, h, mode));
          const data = pixels(canvas);
          if (offset === 3) {
            // 最終フレームは白縁・影・AAも残らず通常写真と全面一致。
            expect(data.every((v, i) => v === (i % 4 === 3 ? 255 : 0)), `cut ${cut}`).toBe(true);
          } else {
            let white = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) white++;
            }
            expect(white, `cut ${cut}, offset ${offset}`).toBeGreaterThan(Math.min(w, h) * 0.1);
          }
        }
      }
    } finally { black.bitmap.close(); }
  });

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
          let lastReveal: Uint8ClampedArray | undefined;
          for (let k = -3; k <= 4; k++) {
            const time = (cut + k) / 30;
            a.draw(video, photos, cuts, time, "charairis");
            const expected = capture();
            if (k === 3) lastReveal = expected;
            if (k === 4) expectSamePixels(lastReveal!, expected, a.canvas, time, mode, `terminal cut ${cut}`);
            expect(opaqueAndBright(expected), `cut ${cut}, k=${k}`).toBe(true);
            expect(edgeLine(expected, a.canvas.width, a.canvas.height), `edge at ${cut + k}`).toBeLessThanOrEqual(3);
            // 両面を同じ回数・同じ範囲で読む。読み戻し履歴によるバックエンド選択を
            // テストの変数にしない。描画も各3回だが、0へのシークはaだけに残す。
            b.draw(video, photos, cuts, time, "charairis");
            expectSamePixels(expected, pixels(b.canvas), b.canvas, time, mode, `instance ${cut + k}`);
            a.draw(video, photos, cuts, 0, "charairis");
            capture();
            b.draw(video, photos, cuts, time, "charairis");
            expectSamePixels(expected, pixels(b.canvas), b.canvas, time, mode, `repeat ${cut + k}`);
            a.draw(video, photos, cuts, time, "charairis");
            expectSamePixels(expected, capture(), a.canvas, time, mode, `seek ${cut + k}`);
            b.draw(video, photos, cuts, time, "charairis");
            expectSamePixels(expected, pixels(b.canvas), b.canvas, time, mode, `instance after seek ${cut + k}`);
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
        const fx = swapFx(frame / 30, cuts.slots, "charairis", mode);
        compositor.draw(video, photos, cuts, frame / 30, "charairis");
        const data = pixels(compositor.canvas);
        const { width: w, height: h } = compositor.canvas;
        const point = charaIrisCenter(frame / 30, w, h, mode);
        const center = (Math.floor(point.y) * w + Math.floor(point.x)) * 4;
        // cut 59 のスロットは4。旧 slot3 は緑、新 slot4 は赤。
        expect([...data.slice(center, center + 3)]).toEqual([160, 100, 100]);
        if (frame <= 57) expect([...data.slice(0, 3)]).toEqual([100, 160, 100]);
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
      drawCharaIris(ctx, photos[0]!.bitmap, canvas.width, canvas.height, 1, charaIrisCenter(63 / 30, canvas.width, canvas.height, mode));
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
  const resizeWidth = vi.spyOn(HTMLCanvasElement.prototype, "width", "set");
  const resizeHeight = vi.spyOn(HTMLCanvasElement.prototype, "height", "set");
  try {
    for (let n = 0; n < 470; n++) {
      draw.mockClear(); clip.mockClear(); stroke.mockClear();
      resizeWidth.mockClear(); resizeHeight.mockClear();
      compositor.draw(video, [p], cuts, n / 30, "charairis");
      const active = swapFx(n / 30, cuts.slots, "charairis").reveal !== undefined;
      expect(draw).toHaveBeenCalledTimes(active ? 3 : 2);
      expect(clip).toHaveBeenCalledTimes(active ? 1 : 0);
      // 不透明な白縁1本だけ。影用の作業面や極小alphaの帯は使わない。
      expect(stroke).toHaveBeenCalledTimes(active ? 1 : 0);
      // mainの初期化だけを許し、未描画の全面FX作業面の確保・リサイズも検出する。
      const main = (draw.mock.contexts[0] as CanvasRenderingContext2D).canvas;
      expect(resizeWidth.mock.contexts).toEqual([main]);
      expect(resizeHeight.mock.contexts).toEqual([main]);
    }
    expect(read).not.toHaveBeenCalled();
    expect(allocate).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks(); p.bitmap.close(); compositor.destroy();
  }
});

it("keeps the opaque character in front of the iris at every character size and aspect", async () => {
  const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
  const photos = [await photo(301, 203, "#aaa"), await photo(203, 301, "#bbb")];
  const source = document.createElement("canvas"); source.width = 320; source.height = 180;
  const ctx = source.getContext("2d")!;
  ctx.fillStyle = "#20d03a"; ctx.fillRect(0, 0, 320, 180);
  ctx.fillStyle = "#000"; ctx.fillRect(130, 90, 50, 90);
  const character = { source, width: 320, height: 180 };
  const video = document.createElement("video");
  try {
    for (const mode of ["landscape", "portrait"] as const) {
      compositor.setAspect(mode);
      for (const size of ["standard", "1.2", "1.4"] as const) {
        compositor.draw(video, photos, { slots: [0] }, 0, "charairis", "none", character, size);
        const normal = pixels(compositor.canvas);
        for (let frame = 27; frame <= 33; frame++) {
          compositor.draw(video, photos, { slots: [0, 1] }, frame / 30, "charairis", "none", character, size);
          const actual = pixels(compositor.canvas);
          let compared = 0;
          for (let i = 0; i < normal.length; i += 4) {
            if (normal[i] === 0 && normal[i + 1] === 0 && normal[i + 2] === 0) {
              if (actual[i] !== 0 || actual[i + 1] !== 0 || actual[i + 2] !== 0 || actual[i + 3] !== 255) {
                throw new Error(`character changed at ${mode}/${size}/${frame}/${i}`);
              }
              compared++;
            }
          }
          expect(compared).toBeGreaterThan(100);
        }
      }
    }
  } finally { photos.forEach((p) => p.bitmap.close()); compositor.destroy(); }
});
