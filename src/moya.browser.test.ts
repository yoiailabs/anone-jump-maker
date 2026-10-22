import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompositor } from "./compositor.ts";
import { createMoyaMask, maskMoyaPhoto } from "./moya.ts";
import { swapFx, type AspectMode } from "./layout.ts";
import { applySoftwareBlur } from "./blur.ts";
import { applyColorFilter, COLOR_FILTERS } from "./color-filter.ts";
import type { LoadedPhoto } from "./photos.ts";

vi.mock("./layout.ts", { spy: true });
vi.mock("./blur.ts", { spy: true });
afterEach(() => vi.restoreAllMocks());
const F = 1 / 30;
const timeline = { slots: [0, 0.5, 1.966667] };
const activeFrames = Array.from({ length: 10 }, (_, i) => i - 5);

async function photo(color = "rgb(96, 128, 160)", pattern = false): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 303;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 303, 303);
  if (pattern) {
    const gradient = ctx.createLinearGradient(0, 0, 303, 303);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "#e0d0a0");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 303, 303);
    ctx.fillStyle = "#8ba9bd";
    for (let x = 0; x < 303; x += 19) ctx.fillRect(x, 0, 3, 303);
  }
  return { id: color, name: color, bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}

function pixels(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
}

async function digest(canvas: HTMLCanvasElement): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", pixels(canvas) as Uint8ClampedArray<ArrayBuffer>);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe.each(["landscape", "portrait"] as const)("%s moya rendering", (mode: AspectMode) => {
  for (const resolutionScale of [1 / 3, 0.31, 1]) {
    it(`leaves no dark or transparent pixel at scale ${resolutionScale}`, async () => {
      const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
      compositor.setAspect(mode);
      const flat = await photo();
      const credit = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(() => {});
      try {
        for (const cut of [15, 59]) {
          for (const frame of activeFrames) {
            compositor.draw(document.createElement("video"), [flat], timeline, (cut + frame) * F, "moya");
            const data = pixels(compositor.canvas);
            // マスクの乗算と補間による最大2階調の丸め差だけ許容する。
            let bad = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (Math.abs(data[i]! - 96) > 2 || Math.abs(data[i + 1]! - 128) > 2 || Math.abs(data[i + 2]! - 160) > 2 || data[i + 3] !== 255) bad++;
            }
            expect(bad, `cut ${cut}, frame ${frame}`).toBe(0);
          }
        }
      } finally {
        credit.mockRestore();
        flat.bitmap.close();
        compositor.destroy();
      }
    });
  }

  it("is pixel-identical on reseek and a separate compositor, with a cut-dependent cloud", async () => {
    const a = createCompositor({ resolutionScale: 0.2, createKeyer: () => null });
    const b = createCompositor({ resolutionScale: 0.2, createKeyer: () => null });
    a.setAspect(mode);
    b.setAspect(mode);
    const photos = [await photo("#406080", true), await photo("#a05060", true)];
    const video = document.createElement("video");
    try {
      for (const frame of activeFrames) {
        const t = (59 + frame) * F;
        a.draw(video, photos, timeline, t, "moya");
        const expected = await digest(a.canvas);
        a.draw(video, photos, timeline, 0.13, "moya");
        a.draw(video, photos, timeline, t, "moya");
        expect(await digest(a.canvas)).toBe(expected);
        b.draw(video, photos, timeline, t, "moya");
        expect(await digest(b.canvas)).toBe(expected);
      }
      // 同じ写真順・同じ相対フレームでもカットシードによって形が変わる。
      a.draw(video, [photos[0]!, photos[1]!, photos[0]!, photos[1]!], { slots: [0, 0.5, 1, 1.5] }, 0.5 - F, "moya");
      const first = await digest(a.canvas);
      a.draw(video, [photos[0]!, photos[1]!, photos[0]!, photos[1]!], { slots: [0, 0.5, 1, 1.5] }, 1.5 - F, "moya");
      expect(await digest(a.canvas)).not.toBe(first);
    } finally {
      photos.forEach((p) => p.bitmap.close());
      a.destroy(); b.destroy();
    }
  });

  it("makes mix endpoints equal the old/new photo, and intermediate mixes form clouds", async () => {
    const compositor = createCompositor({ resolutionScale: 0.2, createKeyer: () => null });
    compositor.setAspect(mode);
    const photos = [await photo("#406080", true), await photo("#a05060", true)];
    const video = document.createElement("video");
    try {
      for (const mix of [0, 1]) {
        compositor.draw(video, [photos[mix]!], { slots: [0] }, 0.2, "moya");
        const reference = await digest(compositor.canvas);
        const fx = swapFx(0.5, timeline.slots, "moya", mode);
        vi.mocked(swapFx).mockReturnValueOnce({ ...fx, moya: { frame: 0, amount: 0, mix } });
        compositor.draw(video, photos, timeline, 0.5, "moya");
        expect(await digest(compositor.canvas)).toBe(reference);
      }
      const flat = [await photo("#d04040"), await photo("#4060d0")];
      compositor.draw(video, flat, timeline, 0.5 - F, "moya");
      const data = pixels(compositor.canvas);
      const reds = new Set<number>();
      for (let y = 10; y < compositor.canvas.height * 0.8; y += 3) {
        for (let x = 10; x < compositor.canvas.width - 10; x += 3) reds.add(data[(y * compositor.canvas.width + x) * 4]!);
      }
      expect(Math.min(...reds)).toBeLessThan(125);
      expect(Math.max(...reds)).toBeGreaterThan(180);
      expect(reds.size).toBeGreaterThan(30);
      flat.forEach((p) => p.bitmap.close());
    } finally {
      photos.forEach((p) => p.bitmap.close());
      compositor.destroy();
    }
  });

  it("colors both dissolving photos before blending and applies blur once to the blend", async () => {
    const compositor = createCompositor({ resolutionScale: 0.2, createKeyer: () => null });
    const reference = createCompositor({ resolutionScale: 0.2, createKeyer: () => null });
    compositor.setAspect(mode);
    reference.setAspect(mode);
    const photos = [await photo("#d04040", true), await photo("#4060d0", true)];
    const video = document.createElement("video");
    const blur = vi.mocked(applySoftwareBlur);
    try {
      for (const color of COLOR_FILTERS.filter((value) => value !== "none")) {
        // 独立した参照: 元写真を先に色変換した bitmap として渡し、描画側の色指定は none。
        const colored = await Promise.all(photos.map(async (p) => {
          const source = document.createElement("canvas");
          source.width = p.bitmap.width; source.height = p.bitmap.height;
          const ctx = source.getContext("2d")!;
          ctx.drawImage(p.bitmap, 0, 0);
          const image = ctx.getImageData(0, 0, source.width, source.height);
          applyColorFilter(image.data, color);
          ctx.putImageData(image, 0, 0);
          return { ...p, bitmap: await createImageBitmap(source) };
        }));
        try {
          for (const filter of ["none", "blur-weak", "blur-strong"] as const) {
            for (const frame of activeFrames) {
              blur.mockClear();
              const time = 0.5 + frame * F;
              compositor.draw(video, photos, timeline, time, "moya", filter, undefined, "standard", color);
              expect(blur).toHaveBeenCalledTimes(filter === "none" ? 0 : 1);
              const actual = await digest(compositor.canvas);
              reference.draw(video, colored, timeline, time, "moya", filter);
              expect(await digest(reference.canvas), `${color}, ${filter}, frame ${frame}`).toBe(actual);
            }
          }
        } finally {
          colored.forEach((p) => p.bitmap.close());
        }
      }
    } finally {
      photos.forEach((p) => p.bitmap.close());
      compositor.destroy(); reference.destroy();
    }
  });

  it("reuses both color results throughout a window and releases the old photo at its end", async () => {
    const compositor = createCompositor({ resolutionScale: 0.2, createKeyer: () => null });
    compositor.setAspect(mode);
    const photos = [await photo("#d04040", true), await photo("#4060d0", true)];
    const video = document.createElement("video");
    const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
    const write = vi.spyOn(CanvasRenderingContext2D.prototype, "putImageData");
    const draws = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
    const colorCanvases = () => write.mock.contexts.filter((_, index) => write.mock.calls[index]![0].width === 303)
      .map((ctx) => (ctx as CanvasRenderingContext2D).canvas);
    const draw = (time: number, color: "dynamic" | "film" | "none" = "dynamic") =>
      compositor.draw(video, photos, timeline, time, "moya", "none", undefined, "standard", color);
    try {
      draw(0.2);
      expect(read).toHaveBeenCalledTimes(1);
      const oldCanvas = colorCanvases()[0]!;
      for (const frame of activeFrames) {
        draw(0.5 + frame * F);
        expect(read, `frame ${frame}`).toHaveBeenCalledTimes(frame > -4 ? 2 : 1);
      }
      const newCanvas = colorCanvases()[1]!;
      expect(oldCanvas.width).toBe(0);
      expect(newCanvas.width).toBe(photos[1]!.bitmap.width);
      draws.mockClear();
      draw(0.7);
      expect(read).toHaveBeenCalledTimes(2);
      expect(draws).toHaveBeenCalledTimes(2);
      // 直接窓内へシークしても初回の2枚だけを計算し、以降は再利用する。
      draw(0.5);
      const readsAfterSeek = read.mock.calls.length;
      expect(readsAfterSeek).toBe(3);
      for (const frame of [-2, -1, 0, 1, 2]) draw(0.5 + frame * F);
      expect(read).toHaveBeenCalledTimes(readsAfterSeek);
      draw(0.5, "film");
      expect(read).toHaveBeenCalledTimes(readsAfterSeek + 2);
      expect(newCanvas.width).toBe(0);
      draw(0.5, "film");
      expect(read).toHaveBeenCalledTimes(readsAfterSeek + 2);
      draw(0.5, "none");
      expect(read).toHaveBeenCalledTimes(readsAfterSeek + 2);
      expect(colorCanvases().every((canvas) => canvas.width === 0)).toBe(true);
      draw(0.5);
      expect(read).toHaveBeenCalledTimes(readsAfterSeek + 4);
      compositor.destroy();
      expect(colorCanvases().every((canvas) => canvas.width === 0)).toBe(true);
    } finally {
      read.mockRestore(); write.mockRestore(); draws.mockRestore();
      photos.forEach((p) => p.bitmap.close());
      compositor.destroy();
    }
  });

  it("uses no readback or new canvases, and keeps the existing two draws outside windows", async () => {
    const compositor = createCompositor({ resolutionScale: 0.2, createKeyer: () => null });
    compositor.setAspect(mode);
    const photos = [await photo(), await photo("#c0b090")];
    const video = document.createElement("video");
    const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
    const create = vi.spyOn(document, "createElement");
    const draws = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
    try {
      for (const t of [0, 0.2, 0.7, 2.3]) {
        draws.mockClear();
        compositor.draw(video, photos, timeline, t, "moya");
        expect(draws).toHaveBeenCalledTimes(2);
      }
      for (const frame of activeFrames) {
        draws.mockClear();
        compositor.draw(video, photos, timeline, 0.5 + frame * F, "moya");
        const sourceDraws = draws.mock.calls.filter(([source]) => photos.some((p) => p.bitmap === source));
        expect(sourceDraws.length).toBe(frame > -4 && frame < 3 ? 2 : 1);
      }
      expect(read).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    } finally {
      read.mockRestore(); create.mockRestore(); draws.mockRestore();
      photos.forEach((p) => p.bitmap.close());
      compositor.destroy();
    }
  });

  it("filters the blended photo once and leaves the character sharp", async () => {
    const compositor = createCompositor({ resolutionScale: 0.2, createKeyer: () => null });
    compositor.setAspect(mode);
    const photos = [await photo("#d04040"), await photo("#4060d0")];
    const video = document.createElement("video");
    const character = document.createElement("canvas");
    character.width = 1920; character.height = 1080;
    const ctx = character.getContext("2d")!;
    ctx.fillStyle = "#20d03a"; ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = "#111111"; ctx.fillRect(500, 400, 800, 200);
    const blur = vi.mocked(applySoftwareBlur);
    const before: string[] = [];
    const { applySoftwareBlur: original } = await vi.importActual<typeof import("./blur.ts")>("./blur.ts");
    // フィルター呼出時に旧・新の双方が既に同じ写真面に存在することを調べる。
    blur.mockImplementation((target, ...args) => {
      const data = pixels(target);
      let red = 0; let blue = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! > 160 && data[i + 2]! < 120) red++;
        if (data[i]! < 130 && data[i + 2]! > 140) blue++;
      }
      before.push(`${red > 0}:${blue > 0}`);
      original(target, ...args);
    });
    try {
      compositor.draw(video, photos, timeline, 0.5 - F, "moya", "blur-strong", { source: character, width: 1920, height: 1080 });
      expect(before).toEqual(["true:true"]);
      const actual = pixels(compositor.canvas);
      compositor.draw(video, photos, { slots: [0] }, 0.2, "moya", "none", { source: character, width: 1920, height: 1080 });
      const reference = pixels(compositor.canvas);
      let black = 0; let white = 0;
      for (let i = 0; i < reference.length; i += 4) {
        if (reference[i] === 17 && reference[i + 1] === 17 && reference[i + 2] === 17) {
          black++;
          expect(Array.from(actual.slice(i, i + 4))).toEqual(Array.from(reference.slice(i, i + 4)));
        }
        if (reference[i] === 255 && reference[i + 1] === 255 && reference[i + 2] === 255) {
          white++;
          expect(Array.from(actual.slice(i, i + 4))).toEqual(Array.from(reference.slice(i, i + 4)));
        }
      }
      expect(black).toBeGreaterThan(100);
      expect(white).toBeGreaterThan(20);
    } finally {
      blur.mockRestore();
      photos.forEach((p) => p.bitmap.close());
      compositor.destroy();
    }
  });
});

// 旧来の2フレームの斑点ワイプに戻らないよう、実カット全てで半透明の面積を測る。
it.each(["landscape", "portrait"] as const)("%s keeps both photos visible for at least four frames on every real cut", async (mode) => {
  const cuts: { slots: number[]; slotFrames: number[] } = await fetch("/official-assets/template/landscape-cuts.json").then((response) => response.json());
  const mask = createMoyaMask();
  const canvas = document.createElement("canvas");
  canvas.width = mode === "landscape" ? 192 : 108;
  canvas.height = mode === "landscape" ? 108 : 192;
  const ctx = canvas.getContext("2d")!;
  for (let cut = 1; cut < cuts.slots.length; cut++) {
    let mixedFrames = 0;
    for (let frame = -3; frame <= 2; frame++) {
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const mix = swapFx((cuts.slotFrames[cut]! + frame) / 30, cuts.slots, "moya").moya!.mix;
      maskMoyaPhoto(canvas, ctx, mask, cut, mix);
      const data = mask.image.data;
      let translucent = 0;
      let alpha = 0;
      for (let i = 3; i < data.length; i += 4) {
        alpha += data[i]! / 255;
        if (data[i]! > 25 && data[i]! < 230) translucent++;
      }
      // 面積の1/4以上で両方の写真が10%以上寄与するフレームを数える。
      if (translucent / (data.length / 4) > 0.25) mixedFrames++;
      if (frame === 0) expect(alpha / (data.length / 4)).toBeGreaterThan(0.3);
      if (frame === 0) expect(alpha / (data.length / 4)).toBeLessThan(0.7);
    }
    expect(mixedFrames, `cut ${cut}`).toBeGreaterThanOrEqual(4);
  }
  const key = `1:${canvas.width / canvas.height}`;
  const cached = mask.clouds.get(key);
  expect(cached).toBeDefined();
  expect(Math.min(...cached!)).toBeCloseTo(0);
  expect(Math.max(...cached!)).toBeCloseTo(1);
  maskMoyaPhoto(canvas, ctx, mask, 1, 0.5);
  expect(mask.clouds.size).toBe(cuts.slots.length - 1);
  expect(mask.clouds.get(key)).toBe(cached);
});
