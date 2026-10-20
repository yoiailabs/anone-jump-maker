import { describe, expect, it } from "vitest";
import landscapeCuts from "../public/official-assets/template/landscape-cuts.json" with { type: "json" };
import { hasFrameFx, swapFx, TEMPLATE_FPS, TEMPLATES } from "./layout.ts";
import { TEMPLATE_PHOTO_COUNT, TEMPLATE_SLOT_PHOTO_ORDER } from "./timeline.ts";

describe("template cut tables", () => {
  it("uses one landscape beat table for portrait and landscape", () => {
    expect(TEMPLATES.portrait.cuts).toBe(TEMPLATES.landscape.cuts);
    expect(TEMPLATES.portrait.video).toBe(TEMPLATES.landscape.video);
    expect(TEMPLATES.portrait.audio).toBe(TEMPLATES.landscape.audio);
    expect(landscapeCuts.source).toBe("public/official-assets/template/landscape.mp4");
    expect(landscapeCuts.fps).toBe(30);
    expect(landscapeCuts.slots).toHaveLength(32);
    expect(landscapeCuts.slotFrames).toHaveLength(32);
    expect(landscapeCuts.photoCount).toBe(TEMPLATE_PHOTO_COUNT);
    expect(landscapeCuts.slotPhotoOrder).toEqual([...TEMPLATE_SLOT_PHOTO_ORDER]);
    expect(landscapeCuts.duration).toBeGreaterThan(15);
    expect(landscapeCuts.slots[0]).toBe(0);
    for (let i = 0; i < landscapeCuts.slots.length; i += 1) {
      expect(landscapeCuts.slots[i]).toBeCloseTo(landscapeCuts.slotFrames[i]! / 30, 5);
      if (i > 0) expect(landscapeCuts.slots[i]!).toBeGreaterThan(landscapeCuts.slots[i - 1]!);
    }
  });

  it.each(["landscape", "portrait"] as const)("%s: keeps every exported photo's first frame clean with rounded real cuts", (mode) => {
    const { slots, slotFrames, duration } = landscapeCuts;
    const frames = Array.from({ length: Math.round(duration * TEMPLATE_FPS) }, (_, n) =>
      swapFx(n / TEMPLATE_FPS, slots, "glitch", mode));
    const changes: number[] = [];
    for (let n = 1; n < frames.length; n++) {
      const fx = frames[n]!;
      if (fx.plateSlot === frames[n - 1]!.plateSlot) continue;
      changes.push(n);
      expect(hasFrameFx(fx), `first new photo at frame ${n}`).toBe(false);
      expect(fx.glitch).toBeUndefined();
      expect(fx.cutIndex).toBe(fx.plateSlot);
      expect(fx.flashAdd + fx.flashScreen + fx.flashGlobal).toBe(0);
      for (let before = 5; before >= 1; before--) {
        const pre = frames[n - before]!;
        expect(pre.plateSlot).toBe(fx.plateSlot - 1);
        expect(pre.cutIndex).toBe(fx.plateSlot);
        expect(pre.glitch?.frame, `frame ${n - before} before cut ${n}`).toBe(-before);
        expect(pre.glitch?.amount).toBe([1, 0.8, 0.6, 0.4, 0.2][before - 1]);
        expect(hasFrameFx(pre)).toBe(true);
      }
      for (let after = 1; after <= 4; after++) {
        const post = frames[n + after]!;
        expect(post.plateSlot).toBe(fx.plateSlot);
        expect(post.cutIndex).toBe(fx.cutIndex);
        expect(post.glitch?.frame).toBe(after);
        expect(post.glitch!.amount).toBe([0.45, 0.3, 0.18, 0.08][after - 1]);
      }
      expect(hasFrameFx(frames[n + 5]!)).toBe(false);
    }
    expect(changes).toEqual(slotFrames.slice(1));
    // 全フレームを独立した実カットの整数表と照合し、窓外の漏れや別カットへの誤帰属も検出する。
    const amounts = [0.2, 0.4, 0.6, 0.8, 1, 0, 0.45, 0.3, 0.18, 0.08];
    for (let n = 0; n < frames.length; n++) {
      const owners = slotFrames.slice(1).flatMap((cut, i) => {
        const relative = n - cut;
        return relative >= -5 && relative <= 4 && relative !== 0 ? [{ index: i + 1, relative }] : [];
      });
      expect(owners.length, `owners at frame ${n}`).toBeLessThanOrEqual(1);
      const owner = owners[0];
      expect(frames[n]!.glitch, `glitch at frame ${n}`).toEqual(owner
        ? { amount: amounts[owner.relative + 5], frame: owner.relative }
        : undefined);
      expect(hasFrameFx(frames[n]!)).toBe(owner !== undefined);
      if (owner) expect(frames[n]!.cutIndex).toBe(owner.index);
    }
  });

  it.each(["landscape", "portrait"] as const)("%s: preview times use the same cut boundary for photo and glitch", (mode) => {
    for (let index = 1; index < landscapeCuts.slots.length; index++) {
      const cut = landscapeCuts.slots[index]!;
      // スロットの許容幅も含め、任意の rAF 時刻で実際の写真境界を探す。
      let oldTime = cut - 0.001;
      let newTime = cut + 0.001;
      for (let i = 0; i < 40; i++) {
        const mid = (oldTime + newTime) / 2;
        if (swapFx(mid, landscapeCuts.slots, "glitch", mode).plateSlot === index) newTime = mid;
        else oldTime = mid;
      }
      for (const dt of [0, 0.000001, 0.009, 0.025, 1 / TEMPLATE_FPS - 0.000001]) {
        const fx = swapFx(newTime + dt, landscapeCuts.slots, "glitch", mode);
        expect(fx.plateSlot).toBe(index);
        expect(fx.cutIndex).toBe(index);
        expect(hasFrameFx(fx)).toBe(false);
      }
      for (const dt of [0, 0.009, 0.025]) {
        const fx = swapFx(oldTime - dt, landscapeCuts.slots, "glitch", mode);
        expect(fx.plateSlot).toBe(index - 1);
        expect(fx.cutIndex).toBe(index);
        expect(fx.glitch?.frame).toBe(-1);
      }
    }
  });

  it.each(["landscape", "portrait"] as const)("%s: leaves a clean gap at the shortest real cut interval", (mode) => {
    const { slots, slotFrames } = landscapeCuts;
    const intervals = slotFrames.slice(1).map((cut, i) => cut - slotFrames[i]!);
    const shortest = Math.min(...intervals);
    expect(shortest).toBe(13);
    for (let i = 1; i < slotFrames.length - 1; i++) {
      if (intervals[i] !== shortest) continue;
      const cut = slotFrames[i]!;
      const next = slotFrames[i + 1]!;
      for (let n = cut; n <= next + 4; n++) {
        const fx = swapFx(n / TEMPLATE_FPS, slots, "glitch", mode);
        if (n > cut && n <= cut + 4) {
          expect(fx.cutIndex).toBe(i);
          expect(fx.glitch?.frame).toBe(n - cut);
        } else if (n >= next - 5 && n < next) {
          expect(fx.cutIndex).toBe(i + 1);
          expect(fx.glitch?.frame).toBe(n - next);
        } else if (n <= next) {
          expect(hasFrameFx(fx)).toBe(false);
        }
      }
    }
  });

  it.each(["landscape", "portrait"] as const)("%s: gives overlapping windows one owner and preserves clean photo arrivals", (mode) => {
    // 実テンプレより短い合成ケース。切替直後の 1 枚を除き、重なりは次カットが所有する。
    const cutFrames = [0, 15, 18, 21];
    const slots = cutFrames.map((n) => n / TEMPLATE_FPS);
    for (let n = 10; n <= 26; n++) {
      const fx = swapFx(n / TEMPLATE_FPS, slots, "glitch", mode);
      const current = cutFrames.findLastIndex((cut) => n >= cut);
      expect(fx.plateSlot).toBe(current);
      if (n === cutFrames[current] || n === 26) {
        expect(hasFrameFx(fx)).toBe(false);
        expect(fx.cutIndex).toBe(current);
      } else {
        const next = cutFrames[current + 1];
        const owner = next !== undefined && n >= next - 5 ? current + 1 : current;
        expect(fx.cutIndex).toBe(owner);
        expect(fx.glitch?.frame).toBe(n - cutFrames[owner]!);
      }
      expect(swapFx(n / TEMPLATE_FPS, slots, "glitch", mode)).toEqual(fx);
    }
  });
});
