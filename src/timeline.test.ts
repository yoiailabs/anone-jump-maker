import { describe, expect, it } from "vitest";
import templateCuts from "../public/official-assets/template/landscape-cuts.json" with { type: "json" };
import {
  TEMPLATE_PHOTO_COUNT,
  TEMPLATE_SLOT_COUNT,
  TEMPLATE_SLOT_PHOTO_ORDER,
  photoForSlot,
  photoIndexForSlot,
  playbackPositions,
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

/** ユーザー報告の 32 枚再生（1 始まり）。テンプレの再登場枠に後ろの写真を詰めた並び。 */
const REPORTED_SCRAMBLED_PLAYBACK = [
  1, 2, 3, 4, 5, 6, 7, 11, 12, 13, 8, 14, 15, 9, 16, 17, 18, 19, 20, 21, 22, 23, 10, 24, 25, 26, 27,
  28, 29, 30, 31, 32,
];

function playbackNames(photoCount: number, slots = TEMPLATE_SLOT_PHOTO_ORDER.length): string[] {
  const photos = [...Array(photoCount).keys()].map((i) => `p${i}`);
  return Array.from({ length: slots }, (_, slot) => photoForSlot(photos, slot)!);
}

describe("template photo order (colour-coded Short utNIG60-li0)", () => {
  it("records 10 colours over 32 slots in the measured reference sequence", () => {
    expect(TEMPLATE_PHOTO_COUNT).toBe(10);
    expect(TEMPLATE_SLOT_PHOTO_ORDER).toHaveLength(32);
    expect(new Set(TEMPLATE_SLOT_PHOTO_ORDER).size).toBe(10);
    const letters = TEMPLATE_SLOT_PHOTO_ORDER.map((i) => "ABCDEFGHIJ"[i]).join("");
    expect(letters).toBe("ABCDEFGBEAHBAIFIBDHIGHJCHFIJGDAI");
    for (let i = 1; i < TEMPLATE_SLOT_PHOTO_ORDER.length; i += 1) {
      expect(TEMPLATE_SLOT_PHOTO_ORDER[i]).not.toBe(TEMPLATE_SLOT_PHOTO_ORDER[i - 1]);
    }
  });

  it("plays selected photos in order for every count, including the 10-colour case", () => {
    expect(playbackNames(10).slice(0, 12)).toEqual([
      "p0",
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p8",
      "p9",
      "p0",
      "p1",
    ]);
    expect(photoForSlot(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"], 7)).toBe("h");
  });

  it("does not pull later photos forward when there are more than 10", () => {
    const seq = playbackNames(12);
    expect(seq.slice(0, 14)).toEqual([
      "p0",
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p8",
      "p9",
      "p10",
      "p11",
      "p0",
      "p1",
    ]);
    expect(new Set(seq).size).toBe(12);
  });

  it("plays 32 photos once each in selection order, not the reported scramble", () => {
    const oneIndexed = playbackNames(32).map((name) => Number(name.slice(1)) + 1);
    expect(oneIndexed).toEqual([...Array(32).keys()].map((i) => i + 1));
    expect(oneIndexed).not.toEqual(REPORTED_SCRAMBLED_PLAYBACK);
  });

  it("cycles in selection order when there are fewer photos than cuts", () => {
    const photos = ["a", "b", "c"];
    const seq = TEMPLATE_SLOT_PHOTO_ORDER.map((_, slot) => photoForSlot(photos, slot));
    expect(seq.slice(0, 6)).toEqual(["a", "b", "c", "a", "b", "c"]);
    for (let i = 1; i < seq.length; i += 1) expect(seq[i]).not.toBe(seq[i - 1]);
    expect(photoIndexForSlot(32, 3)).toBe(2);
    expect(photoIndexForSlot(33, 3)).toBe(0);
  });

  it("lists every 1-based cut a photo is shown on", () => {
    expect(TEMPLATE_SLOT_COUNT).toBe(32);
    expect(templateCuts.slots).toHaveLength(TEMPLATE_SLOT_COUNT);
    expect(playbackPositions(0, 3)).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31]);
    expect(playbackPositions(1, 3)).toEqual([2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32]);
    expect(playbackPositions(2, 3)).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
    expect(playbackPositions(0, 1)).toEqual([...Array(TEMPLATE_SLOT_COUNT).keys()].map((slot) => slot + 1));
    expect(playbackPositions(0, 32)).toEqual([1]);
    expect(playbackPositions(31, 32)).toEqual([32]);
    expect(playbackPositions(-1, 3)).toEqual([]);
    expect(playbackPositions(3, 3)).toEqual([]);
    expect(playbackPositions(0, 0)).toEqual([]);
    for (let photo = 0; photo < 3; photo += 1) {
      const fromCuts = templateCuts.slots
        .map((_, slot) => (photoIndexForSlot(slot, 3) === photo ? slot + 1 : 0))
        .filter((position) => position > 0);
      expect(playbackPositions(photo, 3, templateCuts.slots.length)).toEqual(fromCuts);
    }
  });

  it("wraps past the cut list and treats an empty selection as photo 0", () => {
    expect(photoIndexForSlot(40, 10)).toBe(0);
    expect(photoIndexForSlot(5, 10)).toBe(5);
    expect(photoIndexForSlot(11, 10)).toBe(1);
    expect(photoIndexForSlot(3, 0)).toBe(0);
    expect(photoIndexForSlot(-1, 4)).toBe(0);
  });

  it("returns undefined when empty", () => {
    expect(photoForSlot([], 3)).toBeUndefined();
  });
});
