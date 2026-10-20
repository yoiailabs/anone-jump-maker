import { describe, expect, it } from "vitest";
import cuts from "../public/official-assets/template/landscape-cuts.json" with { type: "json" };
import {
  hasFrameFx, isSwapStyle, SWAP_STYLE_LABELS, swapFx, TEMPLATE_FPS,
  MOYA_BEFORE_FRAMES, MOYA_AFTER_FRAMES, MOYA_DISSOLVE_START, MOYA_DISSOLVE_END,
} from "./layout.ts";
import { slotForTime } from "./timeline.ts";
import moyaSource from "./moya.ts?raw";
import { MOYA_AMPLITUDE, MOYA_BANDS } from "./moya.ts";

it("accepts only the public moya value and Japanese label", () => {
  expect(isSwapStyle("moya")).toBe(true);
  expect(isSwapStyle("Moya")).toBe(false);
  expect(SWAP_STYLE_LABELS.moya).toBe("モヤモヤ");
  expect(MOYA_AMPLITUDE).toBe(0.022);
  expect(MOYA_BANDS).toBe(32);
  expect(moyaSource).not.toMatch(/Math\.random|getImageData/);
});

describe.each(["landscape", "portrait"] as const)("%s moya clock", (mode) => {
  it("fixes a ten-frame window, five-frame dissolve, and clean photos across all 470 frames", () => {
    expect([MOYA_BEFORE_FRAMES, MOYA_AFTER_FRAMES, MOYA_DISSOLVE_START, MOYA_DISSOLVE_END]).toEqual([5, 5, -3, 2]);
    const clean = new Array(cuts.slots.length).fill(0);
    const frames = Math.round(cuts.duration * TEMPLATE_FPS);
    expect(frames).toBe(470);
    for (let n = 0; n < frames; n++) {
      const fx = swapFx(n / TEMPLATE_FPS, cuts.slots, "moya", mode);
      const windows = cuts.slotFrames.flatMap((cut, index) => index > 0 && n - cut >= -5 && n - cut < 5 ? [index] : []);
      expect(windows.length).toBeLessThanOrEqual(1);
      expect(hasFrameFx(fx), `frame ${n}`).toBe(windows.length === 1);
      const slot = cuts.slotFrames.filter((start) => start <= n).length - 1;
      expect(fx.plateSlot).toBe(slot);
      expect(fx.plateSlot).toBe(slotForTime(n / TEMPLATE_FPS, cuts.slots));
      expect(fx.scale).toBe(1);
      expect(fx.dy).toBe(0);
      expect(fx.flashAdd + fx.flashScreen + fx.flashGlobal).toBe(0);
      if (windows.length) {
        expect(fx.cutIndex).toBe(windows[0]);
        expect(fx.moya!.frame).toBe(n - cuts.slotFrames[fx.cutIndex]!);
        expect(fx.moya!.amount).toBeGreaterThan(0);
        expect(fx.moya!.amount).toBeLessThanOrEqual(1);
      } else {
        expect(fx.moya).toBeUndefined();
        clean[slot]++;
      }
    }
    expect(Math.min(...clean)).toBeGreaterThanOrEqual(2);
    expect(Math.min(...cuts.slotFrames.slice(1).map((f, i) => f - cuts.slotFrames[i]!))).toBe(13);
    // 最短間隔でも3枚のクリーンなフレームを確保する。
    expect(13 - MOYA_BEFORE_FRAMES - MOYA_AFTER_FRAMES).toBe(3);
    for (const cut of cuts.slotFrames.slice(1)) {
      const at = (frame: number) => swapFx((cut + frame) / TEMPLATE_FPS, cuts.slots, "moya", mode).moya!;
      expect(at(-3).mix).toBe(0);
      expect(at(2).mix).toBe(1);
      expect(at(0).amount).toBe(1);
      for (let f = -4; f <= 0; f++) expect(at(f).amount).toBeGreaterThan(at(f - 1).amount);
      for (let f = 1; f < 5; f++) expect(at(f).amount).toBeLessThan(at(f - 1).amount);
      for (let f = -2; f <= 2; f++) expect(at(f).mix).toBeGreaterThan(at(f - 1).mix);
    }
  });

  it("aligns rounded cuts and arbitrary preview times with the slot tolerance", () => {
    for (let index = 1; index < cuts.slots.length; index++) {
      const cut = cuts.slots[index]!;
      for (const offset of [-5.01, -5, -4.4, -3, -0.1, 0, 0.1, 0.99, 1, 2, 4.99, 5, 5.1]) {
        // 同じ境界から数えた整数フレームを独立に確認する。
        const time = cut - 1e-4 + (offset + 1e-7) / TEMPLATE_FPS;
        const fx = swapFx(time, cuts.slots, "moya", mode);
        const frame = Math.floor(offset + 1e-7);
        expect(fx.plateSlot).toBe(index - (offset < 0 ? 1 : 0));
        expect(fx.moya?.frame).toBe(frame >= -5 && frame < 5 ? frame : undefined);
        expect(swapFx(time, cuts.slots, "moya", mode)).toEqual(fx);
      }
    }
    const rounded = [0, 1.966667];
    expect(swapFx(59 / 30, rounded, "moya", mode).moya!.frame).toBe(0);
    expect(swapFx(59 / 30, rounded, "moya", mode).plateSlot).toBe(1);
  });

  it("does nothing without a real transition and ignores call history", () => {
    for (const slots of [[], [0], [0, 1]]) {
      for (const time of [0, 0.1, 0.2]) expect(hasFrameFx(swapFx(time, slots, "moya", mode))).toBe(false);
    }
    const expected = swapFx(0.99, [0, 1], "moya", mode);
    swapFx(3, [0, 1], "moya", mode);
    expect(swapFx(0.99, [0, 1], "moya", mode)).toEqual(expected);
  });
});
