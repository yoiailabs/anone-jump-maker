import { describe, expect, it } from "vitest";
import {
  TEMPLATE_PHOTO_COUNT,
  TEMPLATE_SLOT_PHOTO_ORDER,
  photoForSlot,
  photoIndexForSlot,
  slotForTime,
} from "./timeline.ts";

const slots = [0, 0.467, 0.933, 1.467];

describe("slotForTime", () => {
  it("starts at the first slot", () => {
    expect(slotForTime(0, slots)).toBe(0);
  });

  it("advances at each cut", () => {
    expect(slotForTime(0.466, slots)).toBe(0);
    expect(slotForTime(0.467, slots)).toBe(1);
    expect(slotForTime(1.2, slots)).toBe(2);
    expect(slotForTime(2, slots)).toBe(3);
  });
});

describe("template photo order (colour-coded Short utNIG60-li0)", () => {
  it("uses 10 photos over 32 slots in the measured sequence", () => {
    expect(TEMPLATE_PHOTO_COUNT).toBe(10);
    expect(TEMPLATE_SLOT_PHOTO_ORDER).toHaveLength(32);
    expect(new Set(TEMPLATE_SLOT_PHOTO_ORDER).size).toBe(10);
    const letters = TEMPLATE_SLOT_PHOTO_ORDER.map((i) => "ABCDEFGHIJ"[i]).join("");
    expect(letters).toBe("ABCDEFGBEAHBAIFIBDHIGHJCHFIJGDAI");
    // no photo is shown twice in a row in the reference
    for (let i = 1; i < TEMPLATE_SLOT_PHOTO_ORDER.length; i += 1) {
      expect(TEMPLATE_SLOT_PHOTO_ORDER[i]).not.toBe(TEMPLATE_SLOT_PHOTO_ORDER[i - 1]);
    }
  });

  it("follows the template exactly with 10 photos", () => {
    const photos = [...Array(10).keys()].map((i) => `p${i}`);
    const seq = TEMPLATE_SLOT_PHOTO_ORDER.map((_, slot) => photoForSlot(photos, slot));
    expect(seq).toEqual(TEMPLATE_SLOT_PHOTO_ORDER.map((i) => `p${i}`));
    expect(photoForSlot(photos, 7)).toBe("p1"); // slot 8 shows photo 2 again (B)
  });

  it("puts extra photos where the template repeats one, keeping first appearances", () => {
    const photos = [...Array(12).keys()].map((i) => `p${i}`);
    // first 7 slots are distinct photos in order
    for (let slot = 0; slot < 7; slot += 1) expect(photoForSlot(photos, slot)).toBe(`p${slot}`);
    // slot 8 (B again) takes the 11th photo, slot 9 (E again) the 12th
    expect(photoForSlot(photos, 7)).toBe("p10");
    expect(photoForSlot(photos, 8)).toBe("p11");
    // slot 10 (A again) has no extra left -> template repeat
    expect(photoForSlot(photos, 9)).toBe("p0");
    // first appearances of H/I/J are untouched
    expect(photoForSlot(photos, 10)).toBe("p7");
    expect(photoForSlot(photos, 13)).toBe("p8");
    expect(photoForSlot(photos, 22)).toBe("p9");
    const shown = new Set(TEMPLATE_SLOT_PHOTO_ORDER.map((_, slot) => photoForSlot(photos, slot)));
    expect(shown.size).toBe(12);
  });

  it("cycles in slot order with fewer than 10 photos so cuts never show the same photo twice in a row", () => {
    const photos = ["a", "b", "c"];
    const seq = TEMPLATE_SLOT_PHOTO_ORDER.map((_, slot) => photoForSlot(photos, slot));
    expect(seq.slice(0, 6)).toEqual(["a", "b", "c", "a", "b", "c"]);
    for (let i = 1; i < seq.length; i += 1) expect(seq[i]).not.toBe(seq[i - 1]);
    expect(photoIndexForSlot(32, 3)).toBe(2);
    expect(photoIndexForSlot(33, 3)).toBe(0);
  });

  it("falls back to cycling past the template order or without one", () => {
    expect(photoIndexForSlot(40, 10)).toBe(0);
    expect(photoIndexForSlot(5, 10, [])).toBe(5);
    expect(photoIndexForSlot(11, 10, [])).toBe(1);
    expect(photoIndexForSlot(3, 0)).toBe(0);
  });

  it("returns undefined when empty", () => {
    expect(photoForSlot([], 3)).toBeUndefined();
  });
});
