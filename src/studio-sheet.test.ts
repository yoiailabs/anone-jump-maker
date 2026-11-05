import { describe, expect, it } from "vitest";
import {
  SHEET_DRAG_PULL_LIMIT,
  SHEET_DRAG_THRESHOLD,
  STUDIO_TABS,
  sheetDragOffset,
  sheetOpenAfterDrag,
  studioStatusKey,
  tabForKey,
} from "./studio-sheet.ts";
import { LOCALES, t, type Locale } from "./i18n.ts";

describe("studio editor tabs", () => {
  it("orders photos, motion and look", () => {
    expect(STUDIO_TABS).toEqual(["photos", "motion", "look"]);
  });

  it("moves with arrow keys and wraps at both ends", () => {
    expect(tabForKey("ArrowRight", "photos")).toBe("motion");
    expect(tabForKey("ArrowRight", "look")).toBe("photos");
    expect(tabForKey("ArrowLeft", "photos")).toBe("look");
    expect(tabForKey("ArrowLeft", "motion")).toBe("photos");
  });

  it("jumps to the ends with Home and End and ignores other keys", () => {
    expect(tabForKey("Home", "look")).toBe("photos");
    expect(tabForKey("End", "photos")).toBe("look");
    expect(tabForKey("ArrowDown", "photos")).toBeNull();
    expect(tabForKey("Enter", "motion")).toBeNull();
  });
});

describe("studio editor sheet drag", () => {
  it("follows the finger only toward the other state", () => {
    expect(sheetDragOffset(true, 30)).toBe(30);
    expect(sheetDragOffset(true, -30)).toBe(0);
    expect(sheetDragOffset(false, 30)).toBe(0);
    expect(sheetDragOffset(false, -30)).toBe(-30);
    expect(sheetDragOffset(false, -500)).toBe(-SHEET_DRAG_PULL_LIMIT);
  });

  it("toggles only past the threshold", () => {
    expect(sheetOpenAfterDrag(true, SHEET_DRAG_THRESHOLD + 1)).toBe(false);
    expect(sheetOpenAfterDrag(true, SHEET_DRAG_THRESHOLD)).toBe(true);
    expect(sheetOpenAfterDrag(true, -200)).toBe(true);
    expect(sheetOpenAfterDrag(false, -(SHEET_DRAG_THRESHOLD + 1))).toBe(true);
    expect(sheetOpenAfterDrag(false, -SHEET_DRAG_THRESHOLD)).toBe(false);
    expect(sheetOpenAfterDrag(false, 200)).toBe(false);
  });
});

describe("studio status pill", () => {
  const status = (locale: Locale, n: number) => t(locale, studioStatusKey(n), { n, state: "Stopped" });

  it("uses the singular for one photo in English", () => {
    expect(status("en", 1)).toBe("1 photo · Stopped");
    expect(status("en", 2)).toBe("2 photos · Stopped");
    expect(status("en", 0)).toBe("0 photos · Stopped");
  });

  it("keeps the count words of the other locales", () => {
    for (const locale of LOCALES) {
      if (locale === "en") continue;
      expect(status(locale, 1)).toBe(t(locale, "studioStatus", { n: 1, state: "Stopped" }));
    }
    expect(status("ja", 1)).toBe("1枚 · Stopped");
  });
});
