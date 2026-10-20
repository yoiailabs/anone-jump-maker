import { describe, expect, it } from "vitest";
import { createCompositor } from "./compositor.ts";
import { TEMPLATE_FPS, swapFx } from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";

const F = 1 / TEMPLATE_FPS;
const timeline = { slots: [0, 15 * F, 28 * F] };
const samples = [-3, -2.99, -2.5, -2, -1.5, -1, -0.5, 0, 0.25, 0.5, 1, 1.5, 2, 2.5, 2.99, 3];

async function makePhoto(w: number, h: number, color: string, gradient = false): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const fill = ctx.createLinearGradient(0, 0, 0, h);
  fill.addColorStop(0, "rgb(70, 100, 130)");
  fill.addColorStop(1, "rgb(170, 200, 230)");
  ctx.fillStyle = gradient ? fill : color;
  ctx.fillRect(0, 0, w, h);
  return { id: color, name: "fixture.png", bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}

// 全高／全幅の線を列／行ごとの画素差の中央値で測る。クレジットは中央値に影響しない。
function gradients(image: ImageData, axis: "x" | "y"): number[] {
  const { width: w, height: h, data } = image;
  const along = axis === "x" ? w : h;
  const across = axis === "x" ? h : w;
  const result: number[] = [];
  for (let p = 1; p < along; p++) {
    const diffs: number[] = [];
    for (let q = 0; q < across; q += 11) {
      const i = axis === "x" ? (q * w + p) * 4 : (p * w + q) * 4;
      const prev = i - (axis === "x" ? 4 : w * 4);
      diffs.push(Math.max(...[0, 1, 2].map((c) => Math.abs(data[i + c]! - data[prev + c]!))));
    }
    diffs.sort((a, b) => a - b);
    result.push(diffs[Math.floor(diffs.length / 2)]!);
  }
  return result;
}

// 帯の行間差を測る。クレジットを避け、横縞が最も強い行を採用する。
function rowContrast(image: ImageData, from: number, to: number): number {
  const { width: w, height: h, data } = image;
  const start = Math.floor(from * w);
  const end = Math.floor(to * w);
  let peak = 0;
  for (let y = Math.ceil(h * 0.1); y < h * 0.7; y++) {
    let sum = 0;
    for (let x = start; x < end; x++) {
      const i = (y * w + x) * 4;
      sum += Math.abs(data[i]! - data[i - w * 4]!);
    }
    peak = Math.max(peak, sum / (end - start));
  }
  return peak;
}

describe("whip shared preview / export compositor", () => {
  for (const mode of ["landscape", "portrait"] as const) {
    for (const resolutionScale of [1 / 3, 1]) {
      it(`${mode} at ${resolutionScale}: blurs alternating edge rows without stretching them into horizontal stripes`, async () => {
        const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
        compositor.setAspect(mode);
        const { width: w, height: h } = compositor.canvas;
        const fixture = document.createElement("canvas");
        fixture.width = w;
        fixture.height = h;
        const ctx = fixture.getContext("2d")!;
        const video = document.createElement("video");
        let maxEdge = 0;
        try {
          for (const tau of [-2, -1, 0, 1, 2]) {
            const time = timeline.slots[1]! + tau * F;
            const progress = swapFx(time, timeline.slots, "whip", mode).pan!.progress;
            // パン後の左右端に来る各1列だけを行交互の白黒にする。鏡映なら周囲の灰色と平均される。
            const edgeX = Math.round(progress * w);
            const photos: LoadedPhoto[] = [];
            try {
              for (const x of [edgeX, edgeX - 1]) {
                ctx.fillStyle = "#808080";
                ctx.fillRect(0, 0, w, h);
                for (let y = 0; y < h; y++) {
                  ctx.fillStyle = y % 2 === 0 ? "#000000" : "#ffffff";
                  ctx.fillRect(x, y, 1, 1);
                }
                photos.push({ id: `edge-${x}`, name: "edge-stripes.png", bitmap: await createImageBitmap(fixture), thumbUrl: "" });
              }
              compositor.draw(video, photos, timeline, time, "whip");
              const frame = compositor.canvas.getContext("2d")!.getImageData(0, 0, w, h);
              const inner = rowContrast(frame, 0.4, 0.6);
              // 1列の模様が残す差を帯の画素数に合わせて換算し、8bit 平均の丸めに1階調を許容する。
              const tolerance = 3 / resolutionScale + 1;
              for (const [side, from, to] of [["left", 0, 0.1], ["right", 0.9, 1]] as const) {
                const edge = rowContrast(frame, from, to);
                maxEdge = Math.max(maxEdge, edge);
                expect(edge, `${side} rows at τ=${tau}, inner=${inner}`).toBeLessThanOrEqual(inner + tolerance);
                expect(edge, `${side} rows at τ=${tau}`).toBeLessThanOrEqual(tolerance);
              }
            } finally {
              photos.forEach((photo) => photo.bitmap.close());
            }
          }
          console.info(`whip-row-contrast ${mode} scale=${resolutionScale}: max=${maxEdge}`);
        } finally {
          compositor.destroy();
        }
      });

      it(`${mode} at ${resolutionScale}: keeps all four edges and the join smooth`, async () => {
        const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
        compositor.setAspect(mode);
        // 奇数の縦長・横長写真を同じ縦勾配で作る。境界でも本来は横線／縦線が出ない。
        const photos = await Promise.all([makePhoto(303, 607, "a", true), makePhoto(607, 303, "b", true)]);
        const video = document.createElement("video");
        try {
          for (const tau of samples) {
            compositor.draw(video, photos, timeline, timeline.slots[1]! + tau * F, "whip");
            const { width: w, height: h } = compositor.canvas;
            const frame = compositor.canvas.getContext("2d")!.getImageData(0, 0, w, h);
            for (const axis of ["x", "y"] as const) {
              const values = gradients(frame, axis);
              const edge = Math.max(...values.slice(0, Math.ceil(values.length * 0.15)), ...values.slice(Math.floor(values.length * 0.85)));
              expect(edge, `${axis} edge at τ=${tau}`).toBeLessThanOrEqual(3);
              // 縦勾配は切り抜きによって写真間で異なるが、黒い線・鋭い継ぎ目はない。
              expect(Math.max(...values), `${axis} join at τ=${tau}`).toBeLessThanOrEqual(8);
            }
            let minAlpha = 255;
            for (let i = 3; i < frame.data.length; i += 4) minAlpha = Math.min(minAlpha, frame.data[i]!);
            expect(minAlpha).toBe(255);
          }
        } finally {
          photos.forEach((photo) => photo.bitmap.close());
          compositor.destroy();
        }
      });

      it(`${mode} at ${resolutionScale}: introduces no dark band even for one repeated translucent photo`, async () => {
        const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
        compositor.setAspect(mode);
        const photo = await makePhoto(303, 303, "rgba(96, 128, 160, 0.5)");
        const video = document.createElement("video");
        try {
          compositor.draw(video, [photo], timeline, 0.2, "whip");
          const { width: w, height: h } = compositor.canvas;
          const expected = compositor.canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
          for (const tau of samples) {
            compositor.draw(video, [photo], timeline, timeline.slots[1]! + tau * F, "whip");
            const actual = compositor.canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
            let maxError = 0;
            for (let i = 0; i < actual.length; i++) maxError = Math.max(maxError, Math.abs(actual[i]! - expected[i]!));
            expect(maxError, `τ=${tau}`).toBeLessThanOrEqual(2);
          }
        } finally {
          photo.bitmap.close();
          compositor.destroy();
        }
      });
    }

    it(`${mode}: slides adjacent photos left, cycles the input order, and restores still pixels after seeking`, async () => {
      const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      compositor.setAspect(mode);
      const photos = await Promise.all([makePhoto(303, 607, "rgb(200, 40, 40)"), makePhoto(607, 303, "rgb(40, 40, 200)")]);
      const video = document.createElement("video");
      const pixel = (x: number) => {
        const { width: w, height: h } = compositor.canvas;
        return [...compositor.canvas.getContext("2d")!.getImageData(Math.floor(x * w), Math.floor(h / 2), 1, 1).data];
      };
      const hash = async () => [...new Uint8Array(await crypto.subtle.digest("SHA-256", compositor.canvas.getContext("2d")!.getImageData(0, 0, compositor.canvas.width, compositor.canvas.height).data))];
      try {
        compositor.draw(video, photos, timeline, 0.2, "whip");
        const before = await hash();
        for (const cut of [1, 2]) {
          const time = timeline.slots[cut]!;
          expect(swapFx(time, timeline.slots, "whip", mode).pan?.progress).toBe(0.5);
          compositor.draw(video, photos, timeline, time, "whip");
          expect(pixel(0.1)).toEqual(cut === 1 ? [200, 40, 40, 255] : [40, 40, 200, 255]);
          expect(pixel(0.9)).toEqual(cut === 1 ? [40, 40, 200, 255] : [200, 40, 40, 255]);
          compositor.draw(video, photos, timeline, time + 4 * F, "whip", "blur-weak");
          expect(pixel(0.5)).toEqual(cut === 1 ? [40, 40, 200, 255] : [200, 40, 40, 255]);
        }
        compositor.draw(video, photos, timeline, 0.2, "whip");
        expect(await hash()).toEqual(before);
        compositor.draw(video, [], timeline, 0.5, "whip");
        expect(pixel(0.5)).toEqual([10, 8, 6, 255]);
      } finally {
        photos.forEach((photo) => photo.bitmap.close());
        compositor.destroy();
      }
    });
  }
});
