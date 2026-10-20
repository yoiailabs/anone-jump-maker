import { describe, expect, it } from "vitest";
import cuts from "../public/official-assets/template/landscape-cuts.json";
import { frameTimes } from "./export.ts";
import { t } from "./i18n.ts";
import { DEFAULT_SWAP_STYLE, SWAP_STYLES, SWAP_STYLE_LABELS, hasFrameFx, isSwapStyle, swapFx } from "./layout.ts";
import { paperTearSeam } from "./papertear.ts";

it("appends papertear while preserving zoom as the default and all saved values", () => {
  expect(SWAP_STYLES).toEqual(["zoom", "jump", "papertear"]);
  expect(DEFAULT_SWAP_STYLE).toBe("zoom");
  for (const style of SWAP_STYLES) expect(isSwapStyle(style)).toBe(true);
  expect(isSwapStyle("paper-tear")).toBe(false);
  expect(SWAP_STYLE_LABELS.papertear).toBe("紙ちぎり");
  for (const [locale, label] of [["ja", "紙ちぎり"], ["en", "Paper tear"], ["ko", "종이 찢기"], ["zh", "撕纸"]] as const) {
    expect(t(locale, "makerPaperTear")).toBe(label);
  }
});

describe.each(["landscape", "portrait"] as const)("%s papertear window", (mode) => {
  it("leaves the two audio-tail export frames on the final still photo", () => {
    // 現行テンプレのコンテナは音声込みで15.722667秒。映像470枚の後の2枚も静止する。
    const times = frameTimes(15.722667, 30);
    expect(times).toHaveLength(472);
    for (const time of times.slice(470)) {
      const fx = swapFx(time, cuts.slots, "papertear", mode);
      expect(fx.plateSlot).toBe(cuts.slots.length - 1);
      expect(fx).not.toHaveProperty("reveal");
      expect(hasFrameFx(fx)).toBe(false);
    }
  });

  it("aligns every one of the 470 export frames to the rounded cut table", () => {
    const times = frameTimes(cuts.duration, 30);
    expect(times).toHaveLength(470);
    const progress = new Map<number, number>();
    times.forEach((time, frame) => {
      const cutIndex = cuts.slotFrames.findIndex((start, i) => i > 0 && frame >= start - 1 && frame < start + 6);
      const fx = swapFx(time, cuts.slots, "papertear", mode);
      const slot = cuts.slotFrames.findLastIndex((start) => frame >= start);
      expect(fx.scale).toBe(1);
      expect(fx.dy).toBe(0);
      // 写真層だけで完結し、全面 FX の作業面は窓内でも使わない。
      expect(hasFrameFx(fx)).toBe(false);
      if (cutIndex < 0) {
        expect(fx).not.toHaveProperty("reveal");
        expect(fx.plateSlot, `frame ${frame}`).toBe(slot);
      } else {
        expect(fx.cutIndex, `frame ${frame}`).toBe(cutIndex);
        expect(fx.plateSlot).toBe(cutIndex - 1);
        expect(fx.reveal?.nextSlot).toBe(cutIndex);
        const p = fx.reveal!.progress;
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
        expect(p).toBeGreaterThan(progress.get(cutIndex) ?? -1);
        expect(Math.abs(p - Math.min(1, (frame - cuts.slotFrames[cutIndex]! + 1) / 6))).toBeLessThan(0.00051);
        progress.set(cutIndex, p);
      }
      for (const style of ["zoom", "jump"] as const) {
        expect(swapFx(time, cuts.slots, style, mode)).not.toHaveProperty("reveal");
      }
    });
    expect(progress.size).toBe(cuts.slots.length - 1);
  });

  it("uses the slot tolerance for arbitrary preview times and leaves the opening still", () => {
    const S = cuts.slots[4]!;
    for (const tau of [-1.1, -1, -0.5, 0, 0.5, 4.9, 5.5, 6, 6.1]) {
      const fx = swapFx(S + tau / 30 - 1e-4, cuts.slots, "papertear", mode);
      if (tau >= -1 && tau < 6) {
        expect(fx.reveal!.progress).toBeCloseTo(Math.min(1, (tau + 1) / 6), 8);
      } else {
        expect(fx).not.toHaveProperty("reveal");
      }
    }
    for (const slots of [[], [0], cuts.slots]) {
      expect(swapFx(0, slots, "papertear", mode)).not.toHaveProperty("reveal");
    }
  });
});

it("keeps a two-scale seam deterministic by cut, independent of playback order and resolution", () => {
  const first = paperTearSeam(4, 1920, 1080);
  paperTearSeam(7, 1920, 1080);
  expect(paperTearSeam(4, 1920, 1080)).toEqual(first);
  expect(paperTearSeam(5, 1920, 1080)).not.toEqual(first);
  expect(paperTearSeam(4, 960, 540)).toEqual(first.map(({ u, v, fiber }) => ({ u: u / 2, v: v / 2, fiber: fiber / 2 })));
  for (const { v, fiber } of first) {
    expect(v / 1080).toBeGreaterThan(0.35);
    expect(v / 1080).toBeLessThan(0.65);
    expect(fiber / 1080).toBeGreaterThanOrEqual(0.006);
    expect(fiber / 1080).toBeLessThanOrEqual(0.015);
  }
});
