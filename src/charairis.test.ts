import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import track from "./generated/chara-iris-track.json";
import { characterDest, characterScale, characterShiftY } from "./layout.ts";
import { describe, expect, it } from "vitest";
import cuts from "../public/official-assets/template/landscape-cuts.json" with { type: "json" };
import { charaIrisCenter, charaIrisPlateCenter, charaIrisRadius } from "./charairis.ts";
import { DEFAULT_SWAP_STYLE, hasFrameFx, isSwapStyle, OUTPUTS, SWAP_STYLES, SWAP_STYLE_LABELS, swapFx } from "./layout.ts";
import { t } from "./i18n.ts";
import { videoEventParams } from "./analytics.ts";
import { pickTraceAttributes } from "./sentry.ts";
import { exportFileName } from "./modes.ts";
import { slotForTime } from "./timeline.ts";

it("appends charairis and preserves existing values and the default", () => {
  expect(SWAP_STYLES).toEqual(["zoom", "jump", "charairis"]);
  expect(DEFAULT_SWAP_STYLE).toBe("zoom");
  for (const value of SWAP_STYLES) expect(isSwapStyle(value)).toBe(true);
  for (const value of ["CharaIris", "chara-iris", ""]) expect(isSwapStyle(value)).toBe(false);
  expect(SWAP_STYLE_LABELS.charairis).toBe("キャラアイリス");
  for (const [locale, label] of [["ja", "キャラアイリス"], ["en", "Character iris"], ["ko", "캐릭터 아이리스"], ["zh", "角色光圈"]] as const) {
    expect(t(locale, "makerCharaIris")).toBe(label);
  }
});

it.each(["landscape", "portrait"] as const)("%s: passes analytics, Sentry tags and filenames", (mode) => {
  expect(videoEventParams(mode, "charairis")).toEqual({ aspect: mode, effect: "charairis", swap: "charairis" });
  expect(pickTraceAttributes({ aspect: mode, effect: "charairis" })).toEqual({ aspect: mode, effect: "charairis" });
  expect(exportFileName(mode, "charairis", "mp4")).toBe(`anone-charairis-${mode === "landscape" ? "16x9" : "9x16"}.mp4`);
});

describe.each(["landscape", "portrait"] as const)("%s charairis", (mode) => {
  it("matches independent integer windows at all 470 exported timestamps", () => {
    expect(Math.round(cuts.duration * 30)).toBe(470);
    for (let n = 0; n < 470; n++) {
      const owners = cuts.slotFrames.slice(1).flatMap((s, i) => n >= s - 3 && n < s + 4 ? [i + 1] : []);
      expect(owners.length).toBeLessThanOrEqual(1);
      const owner = owners[0];
      const fx = swapFx(n / 30, cuts.slots, "charairis", mode);
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
        const fx = swapFx(time, cuts.slots, "charairis", mode);
        expect(fx.plateSlot).toBe(index - 1);
        expect(fx.reveal?.nextSlot).toBe(index);
        expect(fx.reveal!.progress).toBeGreaterThan(previous);
        previous = fx.reveal!.progress;
        swapFx(0, cuts.slots, "charairis", mode);
        expect(swapFx(time, cuts.slots, "charairis", mode)).toEqual(fx);
      }
      const end = swapFx(s - 1e-4 + (4 + 1e-8) / 30, cuts.slots, "charairis", mode);
      expect(end.plateSlot).toBe(index);
      expect(end).not.toHaveProperty("reveal");
      expect(hasFrameFx(end)).toBe(false);
    }
  });

  it("eases out from the character and sends the border and shadow past every corner", () => {
    const { width: w, height: h } = OUTPUTS[mode];
    for (const frame of cuts.slotFrames.slice(1)) {
      for (const size of ["standard", "1.2", "1.4"] as const) {
        const center = charaIrisCenter(frame / 30, w, h, mode, size);
        const radius = (p: number) => charaIrisRadius(p, w, h, center);
        const margin = Math.min(w, h) * 0.011 * (0.5 + 3 * 0.45 + 0.15) + 2;
        expect(radius(0)).toBeCloseTo(Math.min(w, h) * 0.035);
        expect(radius(2 / 7) - radius(1 / 7)).toBeLessThan(radius(1 / 7) - radius(0));
        for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
          expect(radius(6 / 7) - margin).toBeGreaterThan(Math.hypot(x! - center.x, y! - center.y));
        }
      }
    }
  });

  it("keeps a visible arc inside the screen at S-2 through S+2 at every cut", () => {
    const { width: w, height: h } = OUTPUTS[mode];
    const borderHalf = Math.min(w, h) * 0.011 / 2;
    for (const cut of cuts.slotFrames.slice(1)) {
      for (let offset = -2; offset <= 2; offset++) {
        const time = (cut + offset) / 30;
        const center = charaIrisCenter(time, w, h, mode);
        const radius = charaIrisRadius(swapFx(time, cuts.slots, "charairis", mode).reveal!.progress, w, h, center);
        // 半径/Fだけでは中心や画面形状を保証できない。実際の円周上に、
        // 白縁の太さまで画面内に入る点が連続してあることを検査する。
        const inside = Array.from({ length: 720 }, (_, i) => {
          const angle = i * Math.PI / 360;
          const x = center.x + radius * Math.cos(angle), y = center.y + radius * Math.sin(angle);
          return x > borderHalf && x < w - borderHalf && y > borderHalf && y < h - borderHalf;
        });
        const arcLength = inside.filter(Boolean).length * Math.PI / 360 * radius;
        expect(arcLength, `cut ${cut}, offset ${offset}`).toBeGreaterThan(Math.min(w, h) * 0.1);
      }
    }
  });
});

it("keeps reveal independent from composited frame effects", () => {
  const fx = swapFx(58 / 30, cuts.slots, "charairis");
  expect(fx.reveal).toBeDefined();
  expect(hasFrameFx(fx)).toBe(false);
  for (const field of ["blur", "rgb", "lift", "haze", "wave"] as const) {
    expect(hasFrameFx({ ...fx, [field]: 0.1 })).toBe(true);
  }
});

it("does not reveal at the beginning or without real cuts", () => {
  for (const slots of [[], [0], cuts.slots]) {
    for (const time of [0, 1 / 30, 2 / 30]) {
      const fx = swapFx(time, slots, "charairis");
      expect(fx).not.toHaveProperty("reveal");
      expect(hasFrameFx(fx)).toBe(false);
    }
  }
});

it("binds the complete 30fps track to the exact template video", () => {
  expect(track.sha256, "テンプレ映像を変更したら node scripts/analyze-chara-iris-track.ts で追跡表を再生成してください").toBe(createHash("sha256").update(readFileSync(new URL("../" + track.source, import.meta.url))).digest("hex"));
  expect(track.fps).toBe(30);
  for (const mode of ["landscape", "portrait"] as const) {
    expect(track[mode]).toHaveLength(470);
    expect(track[mode].every((p) => p.length === 2 && p.every((v) => v >= 0 && v <= 1))).toBe(true);
    expect(charaIrisPlateCenter(-1, mode)).toEqual(charaIrisPlateCenter(0, mode));
    expect(charaIrisPlateCenter(100, mode)).toEqual(charaIrisPlateCenter(469 / 30, mode));
    expect(charaIrisPlateCenter(NaN, mode)).toEqual(charaIrisPlateCenter(0, mode));
    for (const cut of cuts.slotFrames.slice(1)) {
      const points = Array.from({ length: 7 }, (_, i) => charaIrisPlateCenter((cut - 3 + i) / 30, mode));
      expect(new Set(points.map((p) => JSON.stringify(p))).size, `cut ${cut}`).toBeGreaterThan(1);
      for (let i = 0; i < 7; i++) {
        const raw = track[mode][cut - 3 + i]!;
        expect(Math.hypot(points[i]!.x - raw[0]!, points[i]!.y - raw[1]!)).toBeLessThan(0.055);
      }
    }
  }
});

it.each(["landscape", "portrait"] as const)("%s: maps each tracked frame through the actual character destination at every size", (mode) => {
  for (const resolution of [0.1, 0.3325, 1]) {
    const w = Math.round(OUTPUTS[mode].width * resolution), h = Math.round(OUTPUTS[mode].height * resolution);
    for (const size of ["standard", "1.2", "1.4"] as const) {
      const dest = characterDest(w, h, characterScale(mode, size), characterShiftY(h, mode), mode);
      for (const cut of cuts.slotFrames.slice(1)) {
        for (let frame = cut - 3; frame <= cut + 3; frame++) {
          const center = charaIrisCenter(frame / 30, w, h, mode, size);
          const plate = charaIrisPlateCenter(frame / 30, mode);
          expect((center.x - dest.x) / dest.w).toBeCloseTo(plate.x, 12);
          expect((center.y - dest.y) / dest.h).toBeCloseTo(plate.y, 12);
        }
      }
    }
  }
});

it("falls back to the latest measured plate point, or the plate center when the track is empty", () => {
  const original = track.landscape;
  try {
    track.landscape = [[0.4, 0.7], [], []];
    const point = charaIrisPlateCenter(2 / 30, "landscape");
    expect(point.x).toBeCloseTo(0.4, 12);
    expect(point.y).toBeCloseTo(0.7, 12);
    track.landscape = [];
    expect(charaIrisPlateCenter(2 / 30, "landscape")).toEqual({ x: 0.5, y: 0.5 });
  } finally { track.landscape = original; }
});
