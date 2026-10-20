import { describe, expect, it } from "vitest";
import { DEFAULT_SWAP_STYLE, FLIP_FLASH_GLOBAL, FLIP_HALF_FRAMES, JUMP_FLASH_GLOBAL, SWAP_STYLES, SWAP_STYLE_LABELS, isSwapStyle, jumpFlashEnvelope, swapFx } from "./layout.ts";
import { exportFileName } from "./modes.ts";
import { t } from "./i18n.ts";
import { videoEventParams } from "./analytics.ts";
import { pickTraceAttributes } from "./sentry.ts";

const F = 1 / 30;
const S = 0.5;
const slots = [0, S, 1];

describe("flip", () => {
  it("adds the last option with localized labels, filenames, analytics and tracing", () => {
    expect(SWAP_STYLES).toEqual(["zoom", "jump", "flip"]);
    expect(DEFAULT_SWAP_STYLE).toBe("zoom");
    expect(isSwapStyle("flip")).toBe(true);
    expect(isSwapStyle("Flip")).toBe(false);
    expect(SWAP_STYLE_LABELS.flip).toBe("フリップ");
    expect(t("ja", "makerFlip")).toBe("フリップ");
    expect(t("en", "makerFlip")).toBe("Flip");
    for (const aspect of ["landscape", "portrait"] as const) {
      expect(exportFileName(aspect, "flip", "webm")).toBe(`anone-flip-${aspect === "landscape" ? "16x9" : "9x16"}.webm`);
      expect(videoEventParams(aspect, "flip")).toEqual({ aspect, effect: "flip", swap: "flip" });
      expect(pickTraceAttributes({ aspect, effect: "flip" })).toEqual({ aspect, effect: "flip" });
    }
  });

  for (const aspect of ["landscape", "portrait"] as const) {
    it(`${aspect}: rotates 1 → 0 → 1 in eight frames and swaps at edge-on`, () => {
      expect(FLIP_HALF_FRAMES * 2).toBe(8);
      const widths = Array.from({ length: 9 }, (_, i) => swapFx(S + (i - 4) * F, slots, "flip", aspect).flipWidth);
      expect(widths[0]).toBe(1);
      expect(widths[4]).toBe(0);
      expect(widths[8]).toBe(1);
      for (let i = 1; i <= 4; i++) {
        expect(widths[i]).toBeLessThan(widths[i - 1]!);
        expect(widths[8 - i]).toBeCloseTo(widths[i]!, 12);
      }
      for (const k of [-4, -3, -1, -0.001, 0, 0.001, 1, 3, 4]) {
        const fx = swapFx(S + k * F, slots, "flip", aspect);
        expect(fx.plateSlot).toBe(k < 0 ? 0 : 1);
        expect(fx.scale).toBe(1);
        expect(fx.dy).toBe(0);
        expect(fx.flashAdd + fx.flashScreen).toBe(0);
        expect(fx.flipPerspective).toBeGreaterThanOrEqual(-0.12);
        expect(fx.flipPerspective).toBeLessThanOrEqual(0.12);
      }
      expect(swapFx(S - F, slots, "flip", aspect).flipPerspective).toBeGreaterThan(0);
      expect(swapFx(S + F, slots, "flip", aspect).flipPerspective).toBeLessThan(0);
      expect(swapFx(S + 4 * F, slots, "flip", aspect).flipShade).toBe(0);
    });

    it(`${aspect}: softly flashes only around edge-on using the unchanged jump envelope`, () => {
      expect(FLIP_FLASH_GLOBAL).toBeLessThan(JUMP_FLASH_GLOBAL);
      for (const k of [-6, -4, -3, -2.5, -2, -1, 0, 1, 2, 3, 4, 6, 10]) {
        const fx = swapFx(S + k * F, slots, "flip", aspect);
        expect(fx.flashGlobal).toBeCloseTo(FLIP_FLASH_GLOBAL * jumpFlashEnvelope(k), 12);
        if (k > -3 && k < 4) expect(fx.flashGlobal).toBeGreaterThan(0);
        else expect(fx.flashGlobal).toBe(0);
        expect(fx.flashAdd).toBe(0);
        expect(fx.flashScreen).toBe(0);
      }
      expect(swapFx(S, slots, "flip", aspect).flashGlobal).toBe(FLIP_FLASH_GLOBAL);
    });

    it(`${aspect}: switches on the export frame even when the cut JSON rounds seconds`, () => {
      const roundedSlots = [0, 1.966667, 2.466667];
      expect(swapFx(59 / 30, roundedSlots, "flip", aspect)).toMatchObject({
        plateSlot: 1, flipWidth: 0, flashGlobal: FLIP_FLASH_GLOBAL,
      });
      expect(swapFx((59 - 0.001) / 30, roundedSlots, "flip", aspect).plateSlot).toBe(0);
    });

    it(`${aspect}: leaves the opening, empty timeline and final still neutral`, () => {
      for (const [time, timeline] of [[0, slots], [0.2, [0]], [0, []], [2, slots]] as const) {
        expect(swapFx(time, timeline, "flip", aspect)).toMatchObject({ flipWidth: 1, flipPerspective: 0, flipShade: 0, scale: 1, dy: 0, flashGlobal: 0 });
      }
      // 最短 13 フレでも前後の回転が重ならない。
      expect(swapFx(S + 6 * F, [0, S, S + 13 * F], "flip", aspect).flipWidth).toBe(1);
    });

    it(`${aspect}: keeps new fields neutral for every zoom / jump phase`, () => {
      for (const style of ["jump", "zoom"] as const) {
        for (let k = -6; k <= 12; k++) {
          expect(swapFx(S + k * F, slots, style, aspect)).toMatchObject({ flipWidth: 1, flipPerspective: 0, flipShade: 0 });
        }
      }
    });
  }
});
