import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompositor, plateDest } from "./compositor.ts";
import { OUTPUTS, swapFx, zoomTransitionScale, type AspectMode, type SwapFx } from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";

vi.mock("./layout.ts", { spy: true });
afterEach(() => vi.mocked(swapFx).mockReset());

const F = 1 / 30;
const S = 0.5;
const timeline = { slots: [0, S, 1] };

async function makePhoto(w: number, h: number, gradient: boolean): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const fill = ctx.createLinearGradient(0, 0, w, h);
  fill.addColorStop(0, "rgb(70, 100, 130)");
  fill.addColorStop(1, "rgb(170, 200, 230)");
  ctx.fillStyle = gradient ? fill : "rgb(96, 128, 160)";
  ctx.fillRect(0, 0, w, h);
  return { id: "fixture", name: "fixture.png", bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}

function pixels(canvas: HTMLCanvasElement): ImageData {
  return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
}

// 全高の縦線／全幅の横線を、各列／行の画素差の中央値で拾う。クレジットは中央値に影響しない。
function edgeGradient(image: ImageData, axis: "x" | "y"): { edge: number; inner: number } {
  const { width: w, height: h, data } = image;
  const along = axis === "x" ? w : h;
  const across = axis === "x" ? h : w;
  const medians: number[] = [];
  for (let p = 1; p < along; p++) {
    const diffs: number[] = [];
    for (let q = 0; q < across; q += 11) {
      const i = axis === "x" ? (q * w + p) * 4 : (p * w + q) * 4;
      const prev = i - (axis === "x" ? 4 : w * 4);
      diffs.push(Math.max(...[0, 1, 2].map((c) => Math.abs(data[i + c]! - data[prev + c]!))));
    }
    diffs.sort((a, b) => a - b);
    medians.push(diffs[Math.floor(diffs.length / 2)]!);
  }
  const edge = medians.filter((_, i) => i < along * 0.15 || i > along * 0.85);
  const inner = medians.slice(Math.ceil(along * 0.2), Math.floor(along * 0.8));
  return { edge: Math.max(...edge), inner: Math.max(...inner) };
}

describe("zoom plate edges", () => {
  for (const mode of ["landscape", "portrait"] as const) {
    for (const resolutionScale of [1 / 3, 1]) {
      it(`${mode} at ${resolutionScale}: keeps shrink / cut edges as smooth as the interior`, async () => {
        const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
        compositor.setAspect(mode);
        const video = document.createElement("video");
        const { width, height } = OUTPUTS[mode];
        const photo = await makePhoto(width, height, true);
        try {
          // τ=+0.5 は S..S+1 の縮み保持。縦の実フレーム S+1 も測る。
          for (const tau of [-2.9, -2.5, -2, -1, 0, 0.5, 0.99, 1, 1 / zoomTransitionScale(mode)]) {
            const time = S + tau * zoomTransitionScale(mode) * F;
            compositor.draw(video, [photo], timeline, time, "zoom");
            const frame = pixels(compositor.canvas);
            for (const axis of ["x", "y"] as const) {
              const measured = edgeGradient(frame, axis);
              console.info(`zoom-edge ${mode} scale=${resolutionScale} tau=${tau} ${axis}=${JSON.stringify(measured)}`);
              expect(measured.edge, `${axis} at τ=${tau}`).toBeLessThanOrEqual(measured.inner + 2);
              expect(measured.edge, `${axis} at τ=${tau}`).toBeLessThanOrEqual(3);
            }
          }
        } finally {
          photo.bitmap.close();
          compositor.destroy();
        }
      });
    }

    it.each([[1920, 1080], [1080, 1920], [960, 960]])(`${mode}: reflects a %i×%i photo at the plate boundary, including corners`, async (photoW, photoH) => {
      const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      compositor.setAspect(mode);
      const photo = await makePhoto(photoW, photoH, true);
      try {
        const time = S - 2 * zoomTransitionScale(mode) * F;
        const fx = swapFx(time, timeline.slots, "zoom", mode);
        // 写真層だけを検査し、全面 FX が境界を隠して合格するのを防ぐ。
        vi.mocked(swapFx).mockReturnValueOnce({ ...fx, scale: 0.866, blur: 0, rgb: 0, wave: 0, lift: 0, haze: 0 });
        compositor.draw(document.createElement("video"), [photo], timeline, time, "zoom");
        const { width: w, height: h } = compositor.canvas;
        const dest = plateDest(photo.bitmap.width, photo.bitmap.height, w, h, { ...fx, scale: 0.866 }, "zoom");
        const data = pixels(compositor.canvas).data;
        for (const axis of ["x", "y"] as const) {
          const measured = edgeGradient(pixels(compositor.canvas), axis);
          expect(measured.edge).toBeLessThanOrEqual(measured.inner + 2);
        }
        const sample = (x: number, y: number) => {
          const i = (Math.floor(y) * w + Math.floor(x)) * 4;
          return [data[i]!, data[i + 1]!, data[i + 2]!];
        };
        for (const x of [2, w / 2, w - 3]) {
          for (const y of [2, h / 2, h - 3]) {
            const reflect = (p: number, start: number, size: number) => {
              if (p < start) return 2 * start - p;
              if (p > start + size) return 2 * (start + size) - p;
              return p;
            };
            const actual = sample(x, y);
            const expected = sample(reflect(x, dest.x, dest.w), reflect(y, dest.y, dest.h));
            actual.forEach((value, c) => expect(Math.abs(value - expected[c]!)).toBeLessThanOrEqual(2));
          }
        }
      } finally {
        photo.bitmap.close();
        compositor.destroy();
      }
    });
  }
});

describe("frame FX edge sampling", () => {
  it("clamps each RGB channel without changing the channel shift in the interior", async () => {
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(640, 360);
    for (let y = 0; y < 360; y++) {
      for (let x = 0; x < 640; x++) {
        const i = (y * 640 + x) * 4;
        image.data.set([40 + x % 160, 60 + x % 120, 80 + x % 100, 255], i);
      }
    }
    ctx.putImageData(image, 0, 0);
    const photo = { id: "channels", name: "channels.png", bitmap: await createImageBitmap(canvas), thumbUrl: "" };
    try {
      const fx = swapFx(0.2, timeline.slots, "zoom");
      const shift = 4;
      vi.mocked(swapFx).mockReturnValueOnce({ ...fx, rgb: shift / 640 });
      compositor.draw(document.createElement("video"), [photo], timeline, 0.2, "zoom");
      const actual = pixels(compositor.canvas).data;
      for (let x = 0; x < 640; x++) {
        for (const [c, dx] of [[0, shift], [1, 0], [2, -shift]] as const) {
          const sx = Math.max(0, Math.min(639, x - dx));
          const expected = image.data[(180 * 640 + sx) * 4 + c]!;
          expect(actual[(180 * 640 + x) * 4 + c], `x=${x}, channel=${c}`).toBe(expected);
        }
      }
    } finally {
      photo.bitmap.close();
      compositor.destroy();
    }
  });

  it.each([
    { wave: 0.004 },
    { blur: 0.027 },
    { rgb: 0.0065 },
    { wave: 0.004, blur: 0.027, rgb: 0.0065 },
  ])("preserves a uniform opaque frame with %j", async (effects) => {
    // 640×360 は 24 行帯の整数境界、638×359 は小数境界も検査する。
    for (const resolutionScale of [1 / 3, 0.3325]) {
      const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
      const photo = await makePhoto(64, 36, false);
      try {
        const fx: SwapFx = { ...swapFx(0.2, timeline.slots, "zoom"), ...effects };
        vi.mocked(swapFx).mockReturnValueOnce(fx);
        compositor.draw(document.createElement("video"), [photo], timeline, 0.2, "zoom");
        const image = pixels(compositor.canvas);
        let maxError = 0;
        let minAlpha = 255;
        // クレジット以外の全画素。端だけでなく波打ちの行境界も検査する。
        for (let i = 0; i < image.width * Math.floor(image.height * 0.8) * 4; i += 4) {
          maxError = Math.max(maxError, ...[96, 128, 160].map((value, c) => Math.abs(value - image.data[i + c]!)));
          minAlpha = Math.min(minAlpha, image.data[i + 3]!);
        }
        console.info(`fx-edge ${JSON.stringify(effects)} scale=${resolutionScale} maxError=${maxError} minAlpha=${minAlpha}`);
        expect(maxError).toBeLessThanOrEqual(2);
        expect(minAlpha).toBe(255);
      } finally {
        photo.bitmap.close();
        compositor.destroy();
      }
    }
  });
});

it.each(["landscape", "portrait"] as const)("%s: restores identical still pixels after zoom / jump frames", async (mode: AspectMode) => {
  const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
  compositor.setAspect(mode);
  const photo = await makePhoto(960, 640, true);
  const video = document.createElement("video");
  try {
    for (const style of ["zoom", "jump"] as const) {
      const frames: string[] = [];
      for (const time of [0.2, S - 2 * F, S - F, S, S + F, 0.2]) {
        compositor.draw(video, [photo], timeline, time, style);
        const buffer = pixels(compositor.canvas).data;
        const hash = await crypto.subtle.digest("SHA-256", buffer);
        frames.push([...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, "0")).join(""));
      }
      expect(frames.at(-1)).toBe(frames[0]);
      // 修正前後の全画素比較用。ジャンプ全区間と FX なしのハッシュを記録する。
      console.info(`pixel-regression ${mode} ${style} ${frames.join(",")}`);
    }
  } finally {
    photo.bitmap.close();
    compositor.destroy();
  }
});
