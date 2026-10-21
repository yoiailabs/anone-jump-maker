import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { characterAlphaCenter } from "../scripts/lightleak-character-center.ts";
import { describe, expect, it } from "vitest";
import cuts from "../public/official-assets/template/landscape-cuts.json" with { type: "json" };
import { frameTimes, EXPORT_FPS } from "./export.ts";
import { hasFrameFx, isSwapStyle, LIGHT_LEAK_AMOUNTS, SWAP_STYLE_LABELS, swapFx } from "./layout.ts";
import { slotForTime } from "./timeline.ts";
import { lightLeakCharacterPoint, lightLeakCharacterSource, LIGHT_LEAK_RADII } from "./lightleak.ts";
import centers from "./generated/lightleak-character.json";
import { characterDest, characterScale, characterShiftY } from "./layout.ts";

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

it("カット前の光の半径が単調に育つ", () => {
  for (let i = 1; i <= 4; i++) expect(LIGHT_LEAK_RADII[i]).toBeGreaterThan(LIGHT_LEAK_RADII[i - 1]!);
  expect(LIGHT_LEAK_RADII[4]! / LIGHT_LEAK_RADII[0]!).toBeGreaterThan(10);
});

it("生成表は実カットと一致し、キャラ本体の位置はポーズで変わる", () => {
  expect(centers.cuts.map((cut) => cut.frame)).toEqual(cuts.slotFrames);
  expect(new Set(centers.cuts.map((cut) => JSON.stringify(cut.landscape))).size).toBeGreaterThan(20);
  for (const mode of ["landscape", "portrait"] as const) {
    for (const cut of cuts.slotFrames) {
      const point = lightLeakCharacterPoint(cut, mode)!;
      expect(point.x).toBeGreaterThan(0.2); expect(point.x).toBeLessThan(0.8);
      expect(point.y).toBeGreaterThan(0.5); expect(point.y).toBeLessThan(1);
    }
    expect(lightLeakCharacterPoint(999, mode)).toBeUndefined();
  }
});

it.each(["landscape", "portrait"] as const)("%s: 本体位置を実際の配置へ写し、透明・キャラなしは矩形中央やや上へ戻る", (mode) => {
  const [w, h] = mode === "landscape" ? [1920, 1080] : [1080, 1920];
  const dest = characterDest(w, h, characterScale(mode), characterShiftY(h, mode), mode);
  for (const point of [{ x: 0.3, y: 0.6 }, { x: 0.5, y: 0.8 }, { x: 0.65, y: 0.7 }]) {
    const source = lightLeakCharacterSource(point, dest, w, h);
    expect(source.x).toBeCloseTo((dest.x + point.x * dest.w) / w);
    expect(source.y).toBeCloseTo((dest.y + point.y * dest.h) / h);
  }
  for (const point of [null, undefined]) {
    expect(lightLeakCharacterSource(point, dest, w, h)).toEqual({ x: (dest.x + dest.w * 0.5) / w, y: (dest.y + dest.h * 0.42) / h });
  }
});

it("生成表は現在のテンプレ素材から作られている", () => {
  const source = readFileSync(new URL("../" + centers.source, import.meta.url));
  expect(createHash("sha256").update(source).digest("hex")).toBe(centers.sha256);
});

it("事前解析は異なる3位置の合成キャラを見つけ、透明／緑のみならフォールバック用のnullを返す", () => {
  const width = 160, height = 90;
  for (const [cx, cy] of [[40, 30], [80, 60], [120, 50]]) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) data.set([32, 208, 58, 255], i);
    expect(characterAlphaCenter(data, width, height)).toBeNull();
    for (let y = cy! - 10; y < cy! + 10; y++) for (let x = cx! - 10; x < cx! + 10; x++) {
      data.set([32, 32, 32, 255], (y * width + x) * 4);
    }
    expect(characterAlphaCenter(data, width, height)).toEqual({ x: cx! / width, y: +(cy! / height).toFixed(6) });
    for (let i = 3; i < data.length; i += 4) data[i] = 0;
    expect(characterAlphaCenter(data, width, height)).toBeNull();
  }
});
