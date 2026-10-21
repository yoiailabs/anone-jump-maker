import { describe, expect, it } from "vitest";
import cuts from "../public/official-assets/template/landscape-cuts.json" with { type: "json" };
import { frameTimes, EXPORT_FPS } from "./export.ts";
import { hasFrameFx, isSwapStyle, LIGHT_LEAK_AMOUNTS, SWAP_STYLE_LABELS, swapFx } from "./layout.ts";
import { slotForTime } from "./timeline.ts";
import { LIGHT_LEAK_FALLBACK, lightLeakSource, prepareLightLeakPhoto } from "./lightleak.ts";

const amounts = [0.15, 0.35, 0.65, 0.9, 1, 0.75, 0.45, 0.22, 0.08];

it("accepts only the exact public value with its Japanese label", () => {
  expect(isSwapStyle("lightleak")).toBe(true);
  expect(isSwapStyle("LightLeak")).toBe(false);
  expect(SWAP_STYLE_LABELS.lightleak).toBe("光漏れ");
  expect(LIGHT_LEAK_AMOUNTS).toEqual(amounts);
});

describe.each(["portrait", "landscape"] as const)("%s light leak timing", (mode) => {
  it("matches all real rounded cuts and exported photo slots, including frame 59", () => {
    for (const [n, time] of frameTimes(cuts.duration, EXPORT_FPS).entries()) {
      const fx = swapFx(time, cuts.slots, "lightleak", mode);
      const owner = cuts.slotFrames.findIndex((cut, i) => i > 0 && n >= cut - 4 && n <= cut + 4);
      const frame = n - (cuts.slotFrames[owner] ?? 0);
      expect(fx.plateSlot, `photo at ${n}`).toBe(slotForTime(time, cuts.slots));
      expect(fx.lightleak, `FX at ${n}`).toEqual(owner < 0 ? undefined : { frame, amount: amounts[frame + 4] });
      expect(hasFrameFx(fx)).toBe(owner >= 0);
      if (owner >= 0) expect(fx.cutIndex).toBe(owner);
      expect(fx.scale).toBe(1);
      expect(fx.dy + fx.flashAdd + fx.flashScreen + fx.flashGlobal).toBe(0);
    }
    expect(swapFx(59 / 30, cuts.slots, "lightleak", mode).lightleak).toEqual({ frame: 0, amount: 1 });
  });

  it("uses the actual photo boundary at arbitrary preview times", () => {
    for (const [index, cut] of cuts.slots.entries()) {
      if (index === 0) continue;
      let before = cut - 0.001;
      let after = cut + 0.001;
      for (let i = 0; i < 40; i++) {
        const mid = (before + after) / 2;
        if (slotForTime(mid, cuts.slots) === index) after = mid;
        else before = mid;
      }
      for (const dt of [0, 0.009, 0.025, 1 / 30 - 0.000001]) {
        const fx = swapFx(after + dt, cuts.slots, "lightleak", mode);
        expect(fx.plateSlot).toBe(index);
        expect(fx.lightleak).toEqual({ frame: 0, amount: 1 });
      }
      expect(swapFx(before - 0.000001, cuts.slots, "lightleak", mode).lightleak?.frame).toBe(-1);
    }
  });

  it("has no initial cut and leaves four clean frames at the shortest real interval", () => {
    for (const slots of [[], [0], [0, 1]]) {
      for (const time of [0, 1 / 30, 0.2]) expect(hasFrameFx(swapFx(time, slots, "lightleak", mode))).toBe(false);
    }
    const intervals = cuts.slotFrames.slice(1).map((cut, i) => cut - cuts.slotFrames[i]!);
    expect(Math.min(...intervals)).toBe(13);
    const i = intervals.indexOf(13);
    for (let n = cuts.slotFrames[i]! + 5; n < cuts.slotFrames[i + 1]! - 4; n++) {
      expect(hasFrameFx(swapFx(n / 30, cuts.slots, "lightleak", mode))).toBe(false);
    }
  });

  it("assigns overlapping synthetic windows one owner and keeps cut peaks", () => {
    const slots = [0, 0.5, 0.6, 0.7];
    for (let n = 10; n < 27; n++) {
      const fx = swapFx(n / 30, slots, "lightleak", mode);
      expect(fx.plateSlot).toBe(slotForTime(n / 30, slots));
      if ([15, 18, 21].includes(n)) {
        expect(fx.cutIndex).toBe(fx.plateSlot);
        expect(fx.lightleak).toEqual({ frame: 0, amount: 1 });
      }
      if (fx.lightleak) expect(n - Math.round(slots[fx.cutIndex]! * 30)).toBe(fx.lightleak.frame);
    }
  });
});

describe("prepareLightLeakPhoto の失敗時", () => {
  it("Canvas2D が使えなくても例外を投げず、光源はフォールバックになる", () => {
    const original = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    };
    try {
      const bitmap = { width: 64, height: 36 } as ImageBitmap;
      expect(() => prepareLightLeakPhoto(bitmap)).not.toThrow();
      expect(lightLeakSource(bitmap, { x: 0, y: 0, w: 64, h: 36 }, 64, 36)).toEqual(LIGHT_LEAK_FALLBACK);
    } finally {
      (globalThis as { document?: unknown }).document = original;
    }
  });
});

describe("cover のクロップ境界", () => {
  it("見えない行の明部をぼかしで可視セルに混ぜず、平坦な可視部分はフォールバックする", () => {
    // 32×32 の写真を 640×360 へ cover。可視は行 7〜24、直上の非表示行 6 だけ真っ白。
    const data = new Uint8ClampedArray(32 * 32 * 4);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const v = y === 6 ? 255 : 64;
        data.set([v, v, v, 255], (y * 32 + x) * 4);
      }
    }
    const original = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => {}, getImageData: () => ({ data }) }),
      }),
    };
    try {
      const bitmap = { width: 32, height: 32 } as ImageBitmap;
      prepareLightLeakPhoto(bitmap);
      const dest = { x: 0, y: -140, w: 640, h: 640 };
      expect(lightLeakSource(bitmap, dest, 640, 360)).toEqual(LIGHT_LEAK_FALLBACK);
      // 同じ写真でも、白い行が見える配置ならそこが光源になる。
      const shown = lightLeakSource(bitmap, { x: 0, y: 0, w: 640, h: 640 }, 640, 640);
      expect(shown.y).toBeCloseTo((6 + 0.5) / 32, 5);
    } finally {
      (globalThis as { document?: unknown }).document = original;
    }
  });
});

describe("光源のキャッシュ", () => {
  it("同じ写真・同じ表示配置では再計算せず同じ結果を返し、配置が変われば選び直す", () => {
    const data = new Uint8ClampedArray(32 * 18 * 4);
    for (let i = 0; i < 32 * 18; i++) data.set([40, 40, 40, 255], i * 4);
    data.set([255, 255, 255, 255], (4 * 32 + 26) * 4);
    const original = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => {}, getImageData: () => ({ data }) }),
      }),
    };
    try {
      const bitmap = { width: 32, height: 18 } as ImageBitmap;
      prepareLightLeakPhoto(bitmap);
      const dest = { x: 0, y: 0, w: 640, h: 360 };
      const first = lightLeakSource(bitmap, dest, 640, 360);
      expect(first).not.toEqual(LIGHT_LEAK_FALLBACK);
      expect(lightLeakSource(bitmap, dest, 640, 360)).toBe(first);
      // 右端を切り落とす配置では、明るいセルが見えないのでフォールバックへ変わる。
      expect(lightLeakSource(bitmap, { x: 0, y: 0, w: 640, h: 360 }, 480, 360)).toEqual(LIGHT_LEAK_FALLBACK);
    } finally {
      (globalThis as { document?: unknown }).document = original;
    }
  });
});
