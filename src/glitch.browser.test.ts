import { describe, expect, it, vi } from "vitest";
import { createCompositor } from "./compositor.ts";
import { hasFrameFx, swapFx, TEMPLATE_FPS, type AspectMode } from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";
import { glitchEnvelope, glitchStyle } from "./glitch-style.ts";
import { drawGlitch } from "./glitch.ts";
import type { SlotTimeline } from "./timeline.ts";

const F = 1 / TEMPLATE_FPS;
const timeline = { slots: [0, 0.5, 1, 1.5, 2, 2.5] };
const activeFrames = [-5, -4, -3, -2, -1, 1, 2, 3, 4];

async function photo(pattern: boolean, id = "fixture"): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 303;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgb(96, 128, 160)";
  ctx.fillRect(0, 0, 303, 303);
  if (pattern) {
    // 斜めのグラデーションと細い線で、RGB ずれと横スライスの違いを検出する。
    const gradient = ctx.createLinearGradient(0, 0, 303, 303);
    gradient.addColorStop(0, "#507090");
    gradient.addColorStop(1, "#c0e0f0");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 303, 303);
    ctx.fillStyle = "#eddba9";
    for (let x = 0; x < 303; x += 19) ctx.fillRect(x, 0, 3, 303);
  }
  return { id, name: `${id}.png`, bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}

function pixels(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
}

async function digest(data: Uint8ClampedArray): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data as Uint8ClampedArray<ArrayBuffer>);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe.each(["landscape", "portrait"] as const)("%s glitch", (mode: AspectMode) => {
  for (const resolutionScale of [1 / 3, 0.31, 1]) {
    it(`fills every pixel and both edges at scale ${resolutionScale}`, async () => {
      const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
      compositor.setAspect(mode);
      const flat = await photo(false);
      // クレジットの影を除き、最下行・右下も含む全画素の下地漏れを検出する。
      const credit = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(() => {});
      try {
        // 等倍は斜め RGB・縦ジッター、縮小時は全プリセットを検査する。
        const cuts = timeline.slots.slice(1).filter((_, i) => resolutionScale !== 1 || ["diagonal", "vertical"].includes(glitchStyle(i + 1).preset));
        for (const cut of cuts) {
          for (const frame of activeFrames) {
            compositor.draw(document.createElement("video"), [flat], timeline, cut + frame * F, "glitch");
            const data = pixels(compositor.canvas);
            let dark = 0;
            let transparent = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i]! < 95 || data[i + 1]! < 127 || data[i + 2]! < 159) dark++;
              if (data[i + 3] !== 255) transparent++;
            }
            expect(dark, `cut ${cut}, frame ${frame}`).toBe(0);
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

  it("repeats identical pixels after seeking, in another compositor, and uses both seed inputs", async () => {
    const preview = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    const saved = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    preview.setAspect(mode);
    saved.setAspect(mode);
    const patterned = await photo(true);
    const video = document.createElement("video");
    try {
      const cutHashes = new Map<number, Set<string>>();
      for (let cut = 1; cut <= 5; cut++) {
        const hashes = new Map<number, string>();
        for (const frame of activeFrames) {
          preview.draw(video, [patterned], timeline, cut * 0.5 + frame * F, "glitch");
          const hash = await digest(pixels(preview.canvas));
          hashes.set(frame, hash);
          const others = cutHashes.get(frame) ?? new Set<string>();
          expect(others.has(hash), `cut ${cut}, frame ${frame}`).toBe(false);
          others.add(hash);
          cutHashes.set(frame, others);
        }
        expect(new Set(hashes.values()).size).toBe(activeFrames.length);
        for (const frame of [...activeFrames].reverse()) {
          const time = cut * 0.5 + frame * F;
          preview.draw(video, [patterned], timeline, time, "glitch");
          saved.draw(video, [patterned], timeline, time, "glitch");
          expect(await digest(pixels(preview.canvas))).toBe(hashes.get(frame));
          expect(await digest(pixels(saved.canvas))).toBe(hashes.get(frame));
        }
      }
    } finally {
      patterned.bitmap.close();
      preview.destroy();
      saved.destroy();
    }
  });

  it("shows the new photo cleanly on the cut and skips all FX work outside the window", async () => {
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    compositor.setAspect(mode);
    const oldPhoto = await photo(false, "old");
    const newPhoto = await photo(true, "new");
    const video = document.createElement("video");
    try {
      compositor.draw(video, [newPhoto], { slots: [0] }, 0.2, "zoom");
      const clean = await digest(pixels(compositor.canvas));
      for (const frame of [...activeFrames, 0, -6, 5]) {
        const time = 0.5 + frame * F;
        const fx = swapFx(time, timeline.slots, "glitch", mode);
        const reads = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
        const draws = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
        const creates = vi.spyOn(document, "createElement");
        let drawCount: number;
        try {
          compositor.draw(video, [oldPhoto, newPhoto], timeline, time, "glitch");
          expect(reads).not.toHaveBeenCalled();
          expect(creates).not.toHaveBeenCalled();
          drawCount = draws.mock.calls.length;
        } finally {
          reads.mockRestore();
          draws.mockRestore();
          creates.mockRestore();
        }
        if (!hasFrameFx(fx)) {
          // 写真→本編、本編→出力の 2 回だけ。作業面へのコピー・色分解をしない。
          expect(drawCount).toBe(2);
        }
        if (frame === 0 || frame === 5) expect(await digest(pixels(compositor.canvas))).toBe(clean);
        if (frame === -6) {
          const actual = await digest(pixels(compositor.canvas));
          compositor.draw(video, [oldPhoto], { slots: [0] }, 0.2, "zoom");
          expect(actual).toBe(await digest(pixels(compositor.canvas)));
        }
      }
    } finally {
      oldPhoto.bitmap.close();
      newPhoto.bitmap.close();
      compositor.destroy();
    }
  });

  it("renders a clean new photo at exported frame 59 and arbitrary preview times around the rounded cut", async () => {
    const realCuts: SlotTimeline = await (await fetch("/official-assets/template/landscape-cuts.json")).json();
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    compositor.setAspect(mode);
    const oldPhoto = await photo(false, "old");
    const newPhoto = await photo(true, "new");
    const video = document.createElement("video");
    // 選択順で写真を配置。スロット 3 は旧写真、4 は新写真。
    const photos = [oldPhoto, oldPhoto, oldPhoto, oldPhoto, newPhoto];
    try {
      compositor.draw(video, [oldPhoto], { slots: [0] }, 0.2, "glitch");
      const oldClean = await digest(pixels(compositor.canvas));
      compositor.draw(video, [newPhoto], { slots: [0] }, 0.2, "glitch");
      const newClean = await digest(pixels(compositor.canvas));
      for (let n = 53; n <= 64; n++) {
        compositor.draw(video, photos, realCuts, n / TEMPLATE_FPS, "glitch");
        const actual = await digest(pixels(compositor.canvas));
        if (n === 59 || n === 64) expect(actual).toBe(newClean);
        else if (n === 53) expect(actual).toBe(oldClean);
        else expect(actual).not.toBe(n < 59 ? oldClean : newClean);
      }
      for (const time of [1.9666, 1.966667, 1.975, 1.9998]) {
        compositor.draw(video, photos, realCuts, time, "glitch");
        expect(await digest(pixels(compositor.canvas))).toBe(newClean);
      }
    } finally {
      oldPhoto.bitmap.close();
      newPhoto.bitmap.close();
      compositor.destroy();
    }
  });

  it("renders each preset's slice geometry, direction, RGB channels and wrapped vertical jitter", () => {
    const { width, height } = mode === "landscape" ? { width: 640, height: 360 } : { width: 360, height: 640 };
    const canvas = () => Object.assign(document.createElement("canvas"), { width, height });
    const main = canvas();
    const fxA = canvas();
    const fxB = canvas();
    const ctx = main.getContext("2d")!;
    const fxACtx = fxA.getContext("2d")!;
    const fxBCtx = fxB.getContext("2d")!;
    const short = Math.min(width, height);
    const draws = vi.spyOn(fxBCtx, "drawImage");
    const fragments = vi.spyOn(fxBCtx, "fillRect");
    const rgbDraws = vi.spyOn(ctx, "drawImage");
    const sourceDraws = vi.spyOn(fxACtx, "drawImage");
    try {
      for (let cut = 1; cut <= 5; cut++) {
        const style = glitchStyle(cut);
        for (const frame of activeFrames) {
          const amount = glitchEnvelope(frame, style.peak);
          const power = amount * style.strength;
          // source x=0 の先頭片だけ数える。移動が丸めで 0px でも本数は正しく検査する。
          const slices: number[][] = [];
          draws.mockImplementation(function (this: CanvasRenderingContext2D, ...args: unknown[]) {
            if (this.globalAlpha === 1 && args[0] === fxA && args.length === 9 && args[1] === 0) slices.push(args.slice(1) as number[]);
          });
          rgbDraws.mockClear();
          fragments.mockClear();
          sourceDraws.mockClear();
          drawGlitch(main, ctx, { fxA, fxACtx, fxB, fxBCtx }, cut, { amount, frame });
          expect(fragments).toHaveBeenCalledTimes(frame < 0 ? style.fragments : 0);
          if (frame < 0) {
            expect(slices).toHaveLength(Math.round(2 + (style.slices - 2) * amount));
          } else {
            expect(slices.length).toBeGreaterThanOrEqual(2);
            expect(slices.length).toBeLessThanOrEqual(3);
          }
          for (const [i, slice] of slices.entries()) {
            const thickness = frame < 0 ? style.thickness.map((v) => Math.max(1, Math.round(short * v * power))) : [1, Math.round(short * 0.009)];
            expect(slice[3]).toBeGreaterThanOrEqual(thickness[0]!);
            expect(slice[3]).toBeLessThanOrEqual(thickness[1]!);
            const shift = Math.min(slice[4]!, width - slice[4]!);
            expect(shift).toBeGreaterThanOrEqual(Math.round(short * (frame < 0 ? 0.1 : 0.03) * power));
            expect(shift).toBeLessThanOrEqual(Math.round(short * (frame < 0 ? 0.18 : 0.03) * power));
            if (shift > 0) expect(slice[4]! < width / 2 ? 1 : -1).toBe(style.direction || (i % 2 === 0 ? -1 : 1));
          }
          const rgb = Math.max(1, Math.round(short * (frame < 0 ? 0.016 : 0.004) * power * style.rgbScale));
          const channels = rgbDraws.mock.calls.filter((args) => args[1] === 0 && args[2] === 0);
          expect(channels).toHaveLength(3);
          for (const [channel, args] of channels.entries()) {
            const displacement = [1, 0, -1][(channel - style.rgbLead + 3) % 3]!;
            expect(args[5]).toBe(((rgb * style.rgbDirection * displacement) % width + width) % width);
            expect(args[6]).toBe(((Math.round(rgb * style.rgbVertical) * displacement) % height + height) % height);
          }
          const jitter = frame < 0 ? Math.round(short * style.jitter * power) * (frame % 2 === 0 ? -1 : 1) : 0;
          expect(sourceDraws.mock.calls[0]![6]).toBe((jitter % height + height) % height);
        }
      }
    } finally {
      draws.mockRestore();
      fragments.mockRestore();
      rgbDraws.mockRestore();
      sourceDraws.mockRestore();
    }
  });
});
