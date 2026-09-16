import { describe, expect, it } from "vitest";
import { photoForSlot, slotForTime } from "./timeline.ts";

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

describe("photoForSlot", () => {
  it("cycles when there are fewer photos than slots", () => {
    const photos = ["a", "b"];
    expect(photoForSlot(photos, 0)).toBe("a");
    expect(photoForSlot(photos, 1)).toBe("b");
    expect(photoForSlot(photos, 32)).toBe("a");
    expect(photoForSlot(photos, 33)).toBe("b");
  });

  it("returns undefined when empty", () => {
    expect(photoForSlot([], 3)).toBeUndefined();
  });
});
