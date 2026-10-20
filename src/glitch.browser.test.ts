import { describe, expect, it, vi } from "vitest";
import { createCompositor } from "./compositor.ts";
import { hasFrameFx, swapFx, TEMPLATE_FPS, type AspectMode } from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";

const F = 1 / TEMPLATE_FPS;
const timeline = { slots: [0, 0.5, 1] };
const activeFrames = [-3, -2, -1, 1, 2, 3];

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
        for (const cut of [0.5, 1]) {
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
      const hashes = new Map<number, string>();
      for (const frame of activeFrames) {
        const time = 0.5 + frame * F;
        preview.draw(video, [patterned], timeline, time, "glitch");
        hashes.set(frame, await digest(pixels(preview.canvas)));
      }
      expect(new Set(hashes.values()).size).toBe(activeFrames.length);
      for (const frame of [...activeFrames].reverse()) {
        const time = 0.5 + frame * F;
        preview.draw(video, [patterned], timeline, time, "glitch");
        saved.draw(video, [patterned], timeline, time, "glitch");
        expect(await digest(pixels(preview.canvas))).toBe(hashes.get(frame));
        expect(await digest(pixels(saved.canvas))).toBe(hashes.get(frame));
        saved.draw(video, [patterned], timeline, 1 + frame * F, "glitch");
        expect(await digest(pixels(saved.canvas))).not.toBe(hashes.get(frame));
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
      for (const frame of [-3, -1, 1, 3, 0, -4, 4]) {
        const time = 0.5 + frame * F;
        const fx = swapFx(time, timeline.slots, "glitch", mode);
        const reads = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
        const draws = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
        let drawCount: number;
        try {
          compositor.draw(video, [oldPhoto, newPhoto], timeline, time, "glitch");
          expect(reads).not.toHaveBeenCalled();
          drawCount = draws.mock.calls.length;
        } finally {
          reads.mockRestore();
          draws.mockRestore();
        }
        if (!hasFrameFx(fx)) {
          // 写真→本編、本編→出力の 2 回だけ。作業面へのコピー・色分解をしない。
          expect(drawCount).toBe(2);
        }
        if (frame === 0 || frame === 4) expect(await digest(pixels(compositor.canvas))).toBe(clean);
        if (frame === -4) {
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
});
