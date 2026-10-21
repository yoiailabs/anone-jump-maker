import { describe, expect, it } from "vitest";
import cuts from "../public/official-assets/template/landscape-cuts.json" with { type: "json" };
import { frameTimes, EXPORT_FPS } from "./export.ts";
import { hasFrameFx, isSwapStyle, LIGHT_LEAK_AMOUNTS, SWAP_STYLE_LABELS, swapFx } from "./layout.ts";
import { slotForTime } from "./timeline.ts";

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
