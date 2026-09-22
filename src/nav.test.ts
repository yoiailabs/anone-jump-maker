import { describe, expect, it } from "vitest";
import { legacyHome, parseAppView, pathForView } from "./nav";
describe("site routes", () => {
  it("separates home and editor in every locale", () => {
    expect(parseAppView("/")).toBe("home"); expect(parseAppView("/en/make")).toBe("maker");
    expect(pathForView("maker", "ko")).toBe("/ko/make");
  });
  it("retires gallery routes to their matching home", () => {
    expect(legacyHome("/community")).toBe("/");
    expect(legacyHome("/ja/community/")).toBe("/");
    for (const locale of ["en", "ko", "zh"]) expect(legacyHome(`/${locale}/community/`)).toBe(`/${locale}`);
    expect(legacyHome("/make")).toBeNull(); expect(legacyHome("/community/other")).toBeNull();
  });
});
