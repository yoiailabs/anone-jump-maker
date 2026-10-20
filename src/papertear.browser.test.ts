import { expect, it, vi } from "vitest";
import type { CutTimeline } from "./timeline.ts";
import { createCompositor } from "./compositor.ts";
import { drawPaperTear } from "./papertear.ts";
import type { LoadedPhoto } from "./photos.ts";

vi.mock("./papertear.ts", { spy: true });
const cuts: CutTimeline & { slotFrames: number[] } = await fetch("/official-assets/template/landscape-cuts.json").then((r) => r.json());

// Fixed 303×227 RGBA fixtures: transparent, red (220, 40, 40, 128), blue (40, 80, 220, 128).
// Generated once with Pillow Image.new, saved as PNG (optimize=True) and WebP
// (lossless=True). Decoding must not depend on the browser's WebP encoder.
const transparentFixtures = {
  "image/png": {
    transparent: "iVBORw0KGgoAAAANSUhEUgAAAS8AAADjCAYAAADUg5KjAAABIklEQVR42u3BMQEAAADCoPVPbQhfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgNMAM9MAAa6FOaMAAAAASUVORK5CYII=",
    red: "iVBORw0KGgoAAAANSUhEUgAAAS8AAADjCAYAAADUg5KjAAACR0lEQVR42u3UQREAMAjAsDE1yEQoYrABd4mEPhqdWQ/gmC8BYF4A5gVgXoB5AZgXgHkB5gVgXgDmBWBegHkBmBeAeQHmBWBeAOYFmBeAeQGYF4B5AeYFYF4A5gWYF4B5AZgXYF4A5gVgXgDmBZgXgHkBmBdgXgDmBWBegHkBmBeAeQGYF2BeAOYFYF6AeQGYF4B5AeYFYF4A5gVgXoB5AZgXgHkB5gVgXgDmBZgXgHkBmBeAeQHmBWBeAOYFmBeAeQGYF4B5AeYFYF4A5gWYF4B5AZgXYF4A5gVgXgDmBZgXgHkBmBdgXgDmBWBegHkBmBeAeQGYF2BeAOYFYF6AeQGYF4B5AeYFYF4A5gVgXoB5AZgXgHkB5gVgXgDmBZgXgHkBmBeAeQHmBWBeAOYFmBeAeQGYF2BeAOYFYF4A5gWYF4B5AZgXYF4A5gVgXoB5AZgXgHkBmBdgXgDmBWBegHkBmBeAeQGYF2BeAOYFYF6AeQGYF4B5AeYFYF4A5gVgXoB5AZgXgHkB5gVgXgDmBZgXgHkBmBeAeQHmBWBeAOYFmBeAeQGYF2BeAOYFYF4A5gWYF4B5AZgXYF4A5gVgXoB5AZgXgHkBmBdgXgDmBWBegHkBmBeAeQHmBWBeAOYFYF6AeQGYF4B5AeYFYF4A5gWYF4B5AZgXgHkB5gVgXgDmBZgXgHkBmBeAeQHmBWBeAOYFmBeAeQGYF2BeAOYFYF4A5gWYF4B5AZgXYF4A5gVgXoB5AZgXgHkBmBdgXgDmBWBegHkBrDLQyANyyfpl0gAAAABJRU5ErkJggg==",
    blue: "iVBORw0KGgoAAAANSUhEUgAAAS8AAADjCAYAAADUg5KjAAACSUlEQVR42u3UQREAMAjAsDE1kzNJCEUMNuAukdBH4/3KA7DMlQAwLwDzAjAvwLwAzAvAvADzAjAvAPMCMC/AvADMC8C8APMCMC8A8wLMC8C8AMwLwLwA8wIwLwDzAswLwLwAzAswLwDzAjAvAPMCzAvAvADMCzAvAPMCMC/AvADMC8C8AMwLMC8A8wIwL8C8AMwLwLwA8wIwLwDzAjAvwLwAzAvAvADzAjAvAPMCzAvAvADMC8C8APMCMC8A8wLMC8C8AMwLwLwA8wIwLwDzAswLwLwAzAswLwDzAjAvAPMCzAvAvADMCzAvAPMCMC/AvADMC8C8AMwLMC8A8wIwL8C8AMwLwLwA8wIwLwDzAjAvwLwAzAvAvADzAjAvAPMCzAvAvADMC8C8APMCMC8A8wLMC8C8AMwLMC8A8wIwLwDzAswLwLwAzAswLwDzAjAvwLwAzAvAvADMCzAvAPMCMC/AvADMC8C8AMwLMC8A8wIwL8C8AMwLwLwA8wIwLwDzAjAvwLwAzAvAvADzAjAvAPMCzAvAvADMC8C8APMCMC8A8wLMC8C8AMwLMC8A8wIwLwDzAswLwLwAzAswLwDzAjAvwLwAzAvAvADMCzAvAPMCMC/AvADMC8C8APMCMC8A8wIwL8C8AMwLwLwA8wIwLwDzAswLwLwAzAvAvADzAjAvAPMCzAvAvADMC8C8APMCMC8A8wLMC8C8AMwLMC8A8wIwLwDzAswLwLwAzAswLwDzAjAvwLwAzAvAvADMCzAvAPMCMC/AvABGaeiAA5qb1TEVAAAAAElFTkSuQmCC",
  },
  "image/webp": {
    transparent: "UklGRiQAAABXRUJQVlA4TBcAAAAvLoE4EAcQEREQEiT+f28iov8Z//m/DAA=",
    red: "UklGRigAAABXRUJQVlA4TBsAAAAvLoE4EAdQlHIXpYABIUHi//cmIvqf8Z//ywAA",
    blue: "UklGRigAAABXRUJQVlA4TBsAAAAvLoE4EAdQqKKUu4ABIUHi//cmIvqf8Z//ywAA",
  },
} as const;

async function transparentPhoto(
  mime: keyof typeof transparentFixtures,
  color: keyof (typeof transparentFixtures)["image/png"],
): Promise<LoadedPhoto> {
  const bytes = Uint8Array.from(atob(transparentFixtures[mime][color]), (char) => char.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  expect([bitmap.width, bitmap.height]).toEqual([303, 227]);
  expect(ctx.getImageData(151, 113, 1, 1).data[3]).toBe(color === "transparent" ? 0 : 128);
  return { id: color, name: mime, bitmap, thumbUrl: "" };
}

async function photo(color: string, gradient = false): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = 303;
  canvas.height = 227;
  const ctx = canvas.getContext("2d")!;
  const fill = ctx.createLinearGradient(0, 0, 303, 227);
  fill.addColorStop(0, color);
  fill.addColorStop(1, "#eef2d8");
  ctx.fillStyle = gradient ? fill : color;
  ctx.fillRect(0, 0, 303, 227);
  return { id: color, name: color, bitmap: await createImageBitmap(canvas), thumbUrl: "" };
}

function pixels(canvas: HTMLCanvasElement): Uint8ClampedArray<ArrayBuffer> {
  return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
}

async function hash(canvas: HTMLCanvasElement): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", pixels(canvas));
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
}

for (const mode of ["landscape", "portrait"] as const) {
  for (const filter of ["blur-weak", "blur-strong"] as const) {
    for (const resolutionScale of [1 / 3, 1]) {
      it(`${mode} ${filter} ${resolutionScale}: keeps fibers and shadows sharp without mixing colors across the seam`, async () => {
        const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
        compositor.setAspect(mode);
        const photos = [await photo("#e02020"), await photo("#2040e0")];
        const video = document.createElement("video");
        const create = vi.spyOn(document, "createElement");
        try {
          let filteredMs = 0;
          for (let frame = 14; frame <= 20; frame++) {
            // 単色の写真はぼかしても同色。縁・影を含め、描画元の補間差2階調以外は一致する。
            compositor.draw(video, photos, cuts, frame / 30, "papertear");
            const expected = pixels(compositor.canvas);
            const start = performance.now();
            compositor.draw(video, photos, cuts, frame / 30, "papertear", filter);
            filteredMs += performance.now() - start;
            const actual = pixels(compositor.canvas);
            let error = 0;
            for (let i = 0; i < actual.length; i++) {
              const d = Math.abs(actual[i]! - expected[i]!);
              error = Math.max(error, d);
            }
            expect(error, `frame ${frame}`).toBeLessThanOrEqual(2);
          }
          console.info(`papertear ${mode} ${filter} scale=${resolutionScale}: mean draw ${(filteredMs / 7).toFixed(2)}ms, no canvas allocation`);
          expect(create).not.toHaveBeenCalled();
        } finally {
          create.mockRestore();
          photos.forEach((p) => p.bitmap.close());
          compositor.destroy();
        }
      });
    }

    it(`${mode} ${filter}: blurs photo detail while the revealed photo matches filtered still cover`, async () => {
      const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      compositor.setAspect(mode);
      const photos = [await photo("#d02020", true), await photo("#2040d0", true)];
      const video = document.createElement("video");
      try {
        compositor.draw(video, photos, cuts, 18 / 30, "papertear", filter);
        const filtered = pixels(compositor.canvas);
        compositor.draw(video, photos, cuts, 18 / 30, "papertear");
        const plain = pixels(compositor.canvas);
        compositor.draw(video, photos, cuts, 21 / 30, "papertear", filter);
        const still = pixels(compositor.canvas);
        const { width: w, height: h } = compositor.canvas;
        let changed = 0;
        let error = 0;
        for (let y = Math.floor(h * 0.4); y < h * 0.6; y++) {
          for (let x = Math.floor(w * 0.4); x < w * 0.6; x++) {
            const i = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
              changed += Math.abs(filtered[i + c]! - plain[i + c]!);
              error = Math.max(error, Math.abs(filtered[i + c]! - still[i + c]!));
            }
          }
        }
        expect(changed).toBeGreaterThan(0);
        expect(error).toBe(0);
      } finally {
        photos.forEach((p) => p.bitmap.close());
        compositor.destroy();
      }
    });
  }

  for (const mime of ["image/png", "image/webp"] as const) {
    it(`${mode} ${mime}: transparent and translucent old/new plates stay continuous at both window ends`, async () => {
      const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
      compositor.setAspect(mode);
      const video = document.createElement("video");
      try {
        for (const [oldAlpha, nextAlpha] of [[0, 0.5], [0.5, 0], [0.5, 0.5]]) {
          const photos: LoadedPhoto[] = [];
          try {
            photos.push(await transparentPhoto(mime, oldAlpha === 0 ? "transparent" : "red"));
            photos.push(await transparentPhoto(mime, nextAlpha === 0 ? "transparent" : "blue"));
            for (const filter of ["none", "blur-weak", "blur-strong"] as const) {
              compositor.draw(video, photos, cuts, 13 / 30, "papertear", filter);
              const before = pixels(compositor.canvas);
              compositor.draw(video, photos, cuts, 21 / 30, "papertear", filter);
              const after = pixels(compositor.canvas);
              const afterHash = await hash(compositor.canvas);
              compositor.draw(video, photos, cuts, 14 / 30, "papertear", filter);
              const start = pixels(compositor.canvas);
              const { width: w, height: h } = compositor.canvas;
              // 窓の最初で両半分の内部と四隅が通常の旧写真と一致する。
              for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
                [Math.floor(w * 0.2), Math.floor(h * 0.2)], [Math.floor(w * 0.8), Math.floor(h * 0.8)]]) {
                const i = (y! * w + x!) * 4;
                expect(Array.from(start.slice(i, i + 4)), `${filter} old alpha=${oldAlpha}`).toEqual(Array.from(before.slice(i, i + 4)));
              }
              compositor.draw(video, photos, cuts, 18 / 30, "papertear", filter);
              const middle = pixels(compositor.canvas);
              const center = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
              expect(Array.from(middle.slice(center, center + 4))).toEqual(Array.from(after.slice(center, center + 4)));
              compositor.draw(video, photos, cuts, 20 / 30, "papertear", filter);
              expect(await hash(compositor.canvas), `${filter} next alpha=${nextAlpha}`).toBe(afterHash);
            }
          } finally {
            photos.forEach((p) => p.bitmap.close());
          }
        }
      } finally {
        compositor.destroy();
      }
    });
  }

  for (const resolutionScale of [1 / 3, 0.3325, 1]) {
    it(`${mode} ${resolutionScale}: covers every window pixel including fractional canvas edges`, async () => {
      const compositor = createCompositor({ resolutionScale, createKeyer: () => null });
      compositor.setAspect(mode);
      const uniform = await photo("rgb(112,152,184)");
      const video = document.createElement("video");
      try {
        compositor.draw(video, [uniform], cuts, 0, "papertear");
        const baseline = pixels(compositor.canvas);
        let minAlpha = 255;
        let maxDarkening = 0;
        let maxEdgeDarkening = 0;
        let checked = 0;
        for (let frame = 0; frame < 470; frame++) {
          // 等倍は離れた2カットの全窓、プレビュー2解像度は全470フレームを走査する。
          if (resolutionScale === 1 && ![4, 19].some((i) => frame >= cuts.slotFrames[i]! - 1 && frame <= cuts.slotFrames[i]! + 6)) continue;
          compositor.draw(video, [uniform], cuts, frame / 30, "papertear");
          const data = pixels(compositor.canvas);
          const { width: w, height: h } = compositor.canvas;
          for (let i = 0; i < data.length; i += 4) {
            minAlpha = Math.min(minAlpha, data[i + 3]!);
            // クレジット自身の影は検査対象から外す。下端・右端の写真画素も含める。
            if (baseline[i] !== 112 || baseline[i + 1] !== 152 || baseline[i + 2] !== 184) continue;
            const dark = Math.max(112 - data[i]!, 152 - data[i + 1]!, 184 - data[i + 2]!);
            maxDarkening = Math.max(maxDarkening, dark);
            const x = (i / 4) % w;
            const y = Math.floor(i / 4 / w);
            if (x === 0 || x === w - 1 || y === 0 || y === h - 1) maxEdgeDarkening = Math.max(maxEdgeDarkening, dark);
          }
          checked++;
        }
        console.info(`papertear coverage ${mode} scale=${resolutionScale} frames=${checked} alpha=${minAlpha} dark=${maxDarkening} edgeDark=${maxEdgeDarkening}`);
        expect(minAlpha).toBe(255);
        // 薄い紙の影は許容するが、暗い下地や端の線は許容しない。
        expect(maxDarkening).toBeLessThanOrEqual(30);
        expect(maxEdgeDarkening).toBeLessThanOrEqual(30);
      } finally {
        uniform.bitmap.close();
        compositor.destroy();
      }
    });
  }

  it(`${mode}: all pixels match after seeking and in another compositor`, async () => {
    const a = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    const b = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    a.setAspect(mode);
    b.setAspect(mode);
    const photos = [await photo("#609090", true), await photo("#d0a060", true)];
    const video = document.createElement("video");
    try {
      const frames = [14, 15, 16, 17, 18, 19, 20, 21, 58, 59, 60, 61, 62, 63, 64, 65];
      const expected = new Map<number, string>();
      for (const frame of frames) {
        a.draw(video, photos, cuts, frame / 30, "papertear");
        expected.set(frame, await hash(a.canvas));
      }
      for (const frame of [...frames].reverse()) {
        a.draw(video, photos, cuts, frame / 30, "papertear");
        b.draw(video, photos, cuts, frame / 30, "papertear");
        expect(await hash(a.canvas), `seek frame ${frame}`).toBe(expected.get(frame));
        expect(await hash(b.canvas), `new compositor frame ${frame}`).toBe(expected.get(frame));
      }
      // S+5 は旧紙が完全に画面外。写真層以外の条件を揃え、静止 cover と全画素比較。
      a.draw(video, photos, cuts, 20 / 30, "papertear");
      b.draw(video, photos, cuts, 21 / 30, "papertear");
      expect(await hash(a.canvas)).toBe(await hash(b.canvas));
      // 開いた中央で、グラデーション写真の座標・倍率も静止 cover と一致する。
      a.draw(video, photos, cuts, 18 / 30, "papertear");
      const revealed = pixels(a.canvas);
      const still = pixels(b.canvas);
      const { width: w, height: h } = a.canvas;
      let error = 0;
      for (let y = Math.floor(h * 0.4); y < h * 0.6; y++) {
        for (let x = Math.floor(w * 0.4); x < w * 0.6; x++) {
          const i = (y * w + x) * 4;
          for (let c = 0; c < 4; c++) error = Math.max(error, Math.abs(revealed[i + c]! - still[i + c]!));
        }
      }
      expect(error).toBe(0);
    } finally {
      photos.forEach((p) => p.bitmap.close());
      a.destroy();
      b.destroy();
    }
  });

  it(`${mode}: first tear frame covers the outside and leaves the new photo stationary underneath`, async () => {
    const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
    compositor.setAspect(mode);
    const photos = [await photo("#706060"), await photo("#60a0d0")];
    const video = document.createElement("video");
    try {
      compositor.draw(video, photos, cuts, 14 / 30, "papertear");
      const data = pixels(compositor.canvas);
      const { width: w, height: h } = compositor.canvas;
      // 四隅に次の写真の細い隙間がない。
      for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
        const i = (y! * w + x!) * 4;
        expect(Array.from(data.slice(i, i + 4))).toEqual([112, 96, 96, 255]);
      }
      compositor.draw(video, photos, cuts, 18 / 30, "papertear");
      const center = pixels(compositor.canvas);
      const i = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
      expect(Array.from(center.slice(i, i + 4))).toEqual([96, 160, 208, 255]);
    } finally {
      photos.forEach((p) => p.bitmap.close());
      compositor.destroy();
    }
  });
}

it("does no tear drawing, clipping, rotation or canvas allocation outside the windows", async () => {
  const compositor = createCompositor({ resolutionScale: 1 / 3, createKeyer: () => null });
  const uniform = await photo("#8090a0");
  const video = document.createElement("video");
  const tear = vi.mocked(drawPaperTear);
  const clip = vi.spyOn(CanvasRenderingContext2D.prototype, "clip");
  const rotate = vi.spyOn(CanvasRenderingContext2D.prototype, "rotate");
  const create = vi.spyOn(document, "createElement");
  const draw = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
  try {
    tear.mockClear();
    for (const frame of [0, 7, 21, 57, 65, 469, 470, 471]) compositor.draw(video, [uniform], cuts, frame / 30, "papertear");
    expect(tear).not.toHaveBeenCalled();
    expect(clip).not.toHaveBeenCalled();
    expect(rotate).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(draw).toHaveBeenCalledTimes(16); // 写真→本編と本編→出力の各1回だけ。
  } finally {
    vi.restoreAllMocks();
    uniform.bitmap.close();
    compositor.destroy();
  }
});
