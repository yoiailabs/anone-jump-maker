import { describe, expect, it } from "vitest";
import cuts from "../public/official-assets/template/landscape-cuts.json" with { type: "json" };
import { DEFAULT_SWAP_STYLE, hasFrameFx, isSwapStyle, MIST_WINDOW_FRAMES, SWAP_STYLE_LABELS, swapFx, TEMPLATE_FPS } from "./layout.ts";
import { t } from "./i18n.ts";
import { exportFileName } from "./modes.ts";

const F = 1 / TEMPLATE_FPS;

it("accepts mist, preserves the default and names it in all four locales", () => {
  expect(isSwapStyle("mist")).toBe(true);
  expect(isSwapStyle("Mist")).toBe(false);
  expect(DEFAULT_SWAP_STYLE).toBe("zoom");
  expect(SWAP_STYLE_LABELS.mist).toBe("白いモヤ");
  for (const [locale, label] of [["ja", "白いモヤ"], ["en", "Mist"], ["ko", "안개"], ["zh", "白雾"]] as const) {
    expect(t(locale, "makerMist")).toBe(label);
  }
  expect(exportFileName("portrait", "mist", "mp4")).toBe("anone-mist-9x16.mp4");
  expect(exportFileName("landscape", "mist", "webm")).toBe("anone-mist-16x9.webm");
});

describe.each(["landscape", "portrait"] as const)("%s mist", (mode) => {
  it("has a short smooth window, an opaque cut and unchanged legacy fields", () => {
    const slots = [0, 1, 2];
    for (const cut of [1, 2]) {
      let previous = 0;
      for (let frame = -8; frame <= 8; frame++) {
        const fx = swapFx(cut + frame * F, slots, "mist", mode);
        const active = Math.abs(frame) < MIST_WINDOW_FRAMES;
        expect(hasFrameFx(fx)).toBe(active);
        expect(fx.plateSlot).toBe(frame < 0 ? cut - 1 : cut);
        expect(fx).toMatchObject({ scale: 1, dy: 0, flashAdd: 0, flashScreen: 0, flashGlobal: 0, blur: 0, rgb: 0, lift: 0, haze: 0, wave: 0, backdrop: false });
        const amount = fx.mist?.amount ?? 0;
        if (frame <= 0) expect(amount).toBeGreaterThanOrEqual(previous);
        else expect(amount).toBeLessThanOrEqual(previous);
        if (frame === 0) expect(amount).toBe(1);
        previous = amount;
      }
      expect(swapFx(cut + 0.001, slots, "mist", mode).plateSlot).toBe(cut);
    }
    for (const slots of [[], [0], [0, 1]]) {
      expect(hasFrameFx(swapFx(0, slots, "mist", mode))).toBe(false);
    }
  });

  it("uses deterministic template frames at every real photo boundary", () => {
    for (let index = 1; index < cuts.slots.length; index++) {
      const cut = cuts.slots[index]!;
      for (let frame = -8; frame <= 8; frame++) {
        const time = (cuts.slotFrames[index]! + frame) * F;
        const expected = swapFx(time, cuts.slots, "mist", mode);
        swapFx(time + 0.17, cuts.slots, "mist", mode);
        expect(swapFx(time, cuts.slots, "mist", mode)).toEqual(expected);
        expect(swapFx(time + 1e-9, cuts.slots, "mist", mode)).toEqual(expected);
        expect(expected.plateSlot).toBe(frame < 0 ? index - 1 : index);
        if (frame === 0) expect(expected.mist?.amount).toBe(1);
      }
      // rAF の任意時刻でも、写真と霧は同じカットの境界を使う。
      expect(swapFx(cut - 0.00011, cuts.slots, "mist", mode).mist?.frame).toBe(-1);
      expect(swapFx(cut - 0.00009, cuts.slots, "mist", mode).mist?.frame).toBe(0);
    }
  });
});
