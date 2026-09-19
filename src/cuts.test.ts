import { describe, expect, it } from "vitest";
import landscapeCuts from "../public/template/landscape-cuts.json" with { type: "json" };
import portraitCuts from "../public/template/cuts.json" with { type: "json" };
import { TEMPLATE_BAND_H, TEMPLATE_BAND_Y } from "./layout.ts";
import { TEMPLATE_PHOTO_COUNT, TEMPLATE_SLOT_PHOTO_ORDER } from "./timeline.ts";

describe("template cut tables", () => {
  it("keeps the same 32 beats for portrait and landscape", () => {
    expect(portraitCuts.fps).toBe(30);
    expect(landscapeCuts.fps).toBe(30);
    expect(portraitCuts.slots).toHaveLength(32);
    expect(landscapeCuts.slots).toEqual(portraitCuts.slots);
    expect(portraitCuts.slotFrames).toEqual(landscapeCuts.slotFrames);
    expect(portraitCuts.photoCount).toBe(TEMPLATE_PHOTO_COUNT);
    expect(portraitCuts.slotPhotoOrder).toEqual([...TEMPLATE_SLOT_PHOTO_ORDER]);
    expect(landscapeCuts.slotPhotoOrder).toEqual(portraitCuts.slotPhotoOrder);
    expect(portraitCuts.duration).toBeGreaterThan(15);
    expect(portraitCuts.slots[0]).toBe(0);
    for (let i = 1; i < portraitCuts.slots.length; i += 1) {
      expect(portraitCuts.slots[i]!).toBeGreaterThan(portraitCuts.slots[i - 1]!);
    }
  });

  it("records the portrait 16:9 band that skips the letterbox antialias row", () => {
    expect(portraitCuts.band).toEqual({ y: TEMPLATE_BAND_Y, h: TEMPLATE_BAND_H });
    expect(landscapeCuts.band).toEqual({ y: 0, h: 1080 });
  });
});
