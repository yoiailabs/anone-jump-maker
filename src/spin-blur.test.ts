import { describe, expect, it } from "vitest";
import { spinBlurPlan } from "./spin-blur.ts";

describe("spinBlurPlan", () => {
  it("keeps tap spacing within three output pixels throughout the spin curve", () => {
    for (const [w, h] of [[1920, 1080], [1080, 1920], [640, 360], [359, 638]] as const) {
      for (const degrees of [0.001, 1, 4, 12, 20.4545, 22.5]) {
        const angle = degrees * Math.PI / 180;
        const plan = spinBlurPlan(w, h, angle);
        expect(angle * Math.hypot(w, h) / 2 / (plan.taps - 1)).toBeLessThanOrEqual(3);
        expect(plan.taps).toBeLessThanOrEqual(192);
        expect(Math.max(plan.width, plan.height)).toBeLessThanOrEqual(Math.max(w, h));
      }
    }
  });

  it("preserves weak blur resolution and bounds strong blur work", () => {
    expect(spinBlurPlan(1920, 1080, 0)).toEqual({ width: 1920, height: 1080, taps: 1 });
    expect(spinBlurPlan(1920, 1080, 0.001)).toEqual({ width: 1920, height: 1080, taps: 2 });
    expect(spinBlurPlan(1920, 1080, 0.36)).toEqual({ width: 384, height: 216, taps: 134 });
    expect(spinBlurPlan(7680, 4320, Math.PI)).toEqual({ width: 384, height: 216, taps: 192 });
  });
});
