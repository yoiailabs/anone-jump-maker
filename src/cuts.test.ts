import { describe, expect, it } from "vitest";
import landscapeCuts from "../public/official-assets/template/landscape-cuts.json" with { type: "json" };
import { TEMPLATES } from "./layout.ts";
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
});
