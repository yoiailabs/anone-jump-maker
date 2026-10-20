import { describe, expect, it } from "vitest";
import cuts from "../public/official-assets/template/landscape-cuts.json" with { type: "json" };
import { catIrisRadius, easeOutBack } from "./catiris.ts";
import { DEFAULT_SWAP_STYLE, hasFrameFx, isSwapStyle, OUTPUTS, SWAP_STYLES, SWAP_STYLE_LABELS, swapFx } from "./layout.ts";
import { t } from "./i18n.ts";
import { videoEventParams } from "./analytics.ts";
import { pickTraceAttributes } from "./sentry.ts";
import { exportFileName } from "./modes.ts";
import { slotForTime } from "./timeline.ts";

it("appends catiris and preserves existing values and the default", () => {
  expect(SWAP_STYLES).toEqual(["zoom", "jump", "catiris"]);
  expect(DEFAULT_SWAP_STYLE).toBe("zoom");
  for (const value of SWAP_STYLES) expect(isSwapStyle(value)).toBe(true);
  for (const value of ["CatIris", "cat-iris", ""]) expect(isSwapStyle(value)).toBe(false);
  expect(SWAP_STYLE_LABELS.catiris).toBe("ネコアイリス");
  for (const [locale, label] of [["ja", "ネコアイリス"], ["en", "Cat iris"], ["ko", "고양이 아이리스"], ["zh", "猫咪光圈"]] as const) {
    expect(t(locale, "makerCatIris")).toBe(label);
  }
});

it.each(["landscape", "portrait"] as const)("%s: passes analytics, Sentry tags and filenames", (mode) => {
  expect(videoEventParams(mode, "catiris")).toEqual({ aspect: mode, effect: "catiris", swap: "catiris" });
  expect(pickTraceAttributes({ aspect: mode, effect: "catiris" })).toEqual({ aspect: mode, effect: "catiris" });
  expect(exportFileName(mode, "catiris", "mp4")).toBe(`anone-catiris-${mode === "landscape" ? "16x9" : "9x16"}.mp4`);
});

describe.each(["landscape", "portrait"] as const)("%s catiris", (mode) => {
  it("matches independent integer windows at all 470 exported timestamps", () => {
    expect(Math.round(cuts.duration * 30)).toBe(470);
    for (let n = 0; n < 470; n++) {
      const owners = cuts.slotFrames.slice(1).flatMap((s, i) => n >= s - 3 && n < s + 4 ? [i + 1] : []);
      expect(owners.length).toBeLessThanOrEqual(1);
      const owner = owners[0];
      const fx = swapFx(n / 30, cuts.slots, "catiris", mode);
      expect(fx.scale).toBe(1);
      expect(fx.dy).toBe(0);
      expect(hasFrameFx(fx), `frame ${n}`).toBe(false);
      expect(fx.flashAdd + fx.flashScreen + fx.flashGlobal + fx.blur + fx.rgb + fx.wave + fx.lift + fx.haze).toBe(0);
      if (owner !== undefined) {
        expect(fx.plateSlot).toBe(owner - 1);
        expect(fx.cutIndex).toBe(owner);
        expect(fx.reveal?.nextSlot).toBe(owner);
        expect(fx.reveal!.progress).toBeCloseTo((n - cuts.slotFrames[owner]! + 3) / 7, 3);
      } else {
        expect(fx).not.toHaveProperty("reveal");
        expect(fx.plateSlot).toBe(slotForTime(n / 30, cuts.slots));
      }
      for (const style of ["zoom", "jump"] as const) expect(swapFx(n / 30, cuts.slots, style, mode)).not.toHaveProperty("reveal");
    }
  });

  it("keeps continuous progress monotonic through rounded boundaries and seeking", () => {
    for (let index = 1; index < cuts.slots.length; index++) {
      const s = cuts.slots[index]!;
      let previous = -1;
      for (let tick = 0; tick < 700; tick++) {
        const time = s - 1e-4 + (-3 + tick / 100 + 1e-8) / 30;
        const fx = swapFx(time, cuts.slots, "catiris", mode);
        expect(fx.plateSlot).toBe(index - 1);
        expect(fx.reveal?.nextSlot).toBe(index);
        expect(fx.reveal!.progress).toBeGreaterThan(previous);
        previous = fx.reveal!.progress;
        swapFx(0, cuts.slots, "catiris", mode);
        expect(swapFx(time, cuts.slots, "catiris", mode)).toEqual(fx);
      }
      const end = swapFx(s - 1e-4 + (4 + 1e-8) / 30, cuts.slots, "catiris", mode);
      expect(end.plateSlot).toBe(index);
      expect(end).not.toHaveProperty("reveal");
      expect(hasFrameFx(end)).toBe(false);
    }
  });

  it("bounces at a visible middle size then covers the diagonal including the border", () => {
    const { width: w, height: h } = OUTPUTS[mode];
    const radius = (k: number) => catIrisRadius((k + 3) / 7, w, h);
    expect(easeOutBack(0)).toBeCloseTo(0);
    expect(easeOutBack(1)).toBe(1);
    expect(easeOutBack(0.7)).toBeGreaterThan(1);
    expect(radius(-3)).toBeCloseTo(Math.min(w, h) * 0.035);
    expect(radius(-1)).toBeGreaterThan(radius(1));
    expect(radius(-1) / radius(1)).toBeGreaterThan(1.12);
    expect(radius(2)).toBeGreaterThan(radius(1));
    expect(radius(4) - Math.min(w, h) * 0.10).toBeGreaterThan(Math.hypot(w, h) / 2);
  });

  it("centers and contains the entire middle silhouette including its peak, border and shadow", () => {
    const { width: w, height: h } = OUTPUTS[mode];
    const short = Math.min(w, h);
    // 耳先〜あごの正規化寸法は2×2.35。白縁半分＋影のぼかし3倍＋影のずれを余白に含める。
    const padding = short * 0.025 * (0.5 + 3 * 0.45 + 0.15);
    // S-1〜S+1を連続走査し、書き出しフレーム間のオーバーシュートも検査する。
    for (let tick = 0; tick <= 2000; tick++) {
      const progress = (2 + tick / 1000) / 7;
      const radius = catIrisRadius(progress, w, h);
      const halfHeight = radius * 1.175;
      expect(halfHeight * 2 / short).toBeGreaterThanOrEqual(0.60 - 1e-12);
      expect(halfHeight * 2 / short).toBeLessThanOrEqual(0.70);
      expect(w / 2 - radius - padding).toBeGreaterThan(short * 0.10);
      expect(w / 2 + radius + padding).toBeLessThan(w - short * 0.10);
      expect(h / 2 - halfHeight - padding).toBeGreaterThan(short * 0.10);
      expect(h / 2 + halfHeight + padding).toBeLessThan(h - short * 0.10);
    }
  });
});

it("keeps reveal independent from composited frame effects", () => {
  const fx = swapFx(58 / 30, cuts.slots, "catiris");
  expect(fx.reveal).toBeDefined();
  expect(hasFrameFx(fx)).toBe(false);
  for (const field of ["blur", "rgb", "lift", "haze", "wave"] as const) {
    expect(hasFrameFx({ ...fx, [field]: 0.1 })).toBe(true);
  }
});

it("does not reveal at the beginning or without real cuts", () => {
  for (const slots of [[], [0], cuts.slots]) {
    for (const time of [0, 1 / 30, 2 / 30]) {
      const fx = swapFx(time, slots, "catiris");
      expect(fx).not.toHaveProperty("reveal");
      expect(hasFrameFx(fx)).toBe(false);
    }
  }
});
