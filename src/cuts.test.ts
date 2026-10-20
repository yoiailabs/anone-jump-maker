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
      for (let before = 3; before >= 1; before--) {
        const pre = frames[n - before]!;
        expect(pre.plateSlot).toBe(fx.plateSlot - 1);
        expect(pre.cutIndex).toBe(fx.plateSlot);
        expect(pre.glitch?.frame, `frame ${n - before} before cut ${n}`).toBe(-before);
        expect(hasFrameFx(pre)).toBe(true);
      }
      for (let after = 1; after <= 3; after++) {
        const post = frames[n + after]!;
        expect(post.plateSlot).toBe(fx.plateSlot);
        expect(post.cutIndex).toBe(fx.cutIndex);
        expect(post.glitch?.frame).toBe(after);
        expect(post.glitch!.amount).toBeLessThanOrEqual(0.35);
      }
      expect(hasFrameFx(frames[n + 4]!)).toBe(false);
    }
    expect(changes).toEqual(slotFrames.slice(1));
  });

  it.each(["landscape", "portrait"] as const)("%s: preview times use the same cut boundary for photo and glitch", (mode) => {
    for (let index = 1; index < landscapeCuts.slots.length; index++) {
      const cut = landscapeCuts.slots[index]!;
      // Locate the actual photo boundary at arbitrary rAF times, including the slot tolerance.
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
});
