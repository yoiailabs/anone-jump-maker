import { describe, expect, it } from "vitest";
import { linkBannersHtml, OFFICIAL_LINKS } from "./links.ts";

describe("official link banners", () => {
  it("covers the four services once each", () => {
    expect(OFFICIAL_LINKS.map((link) => link.id)).toEqual([
      "x",
      "youtube",
      "spotify",
      "apple-music",
    ]);
  });

  it("points at https URLs only", () => {
    for (const link of OFFICIAL_LINKS) {
      expect(link.href.startsWith("https://")).toBe(true);
    }
  });

  it("opens every banner in a new tab without leaking the referrer window", () => {
    const html = linkBannersHtml();
    for (const link of OFFICIAL_LINKS) {
      expect(html).toContain(`href="${link.href}"`);
      expect(html).toContain(`data-service="${link.id}"`);
    }
    expect(html.match(/target="_blank"/g)).toHaveLength(OFFICIAL_LINKS.length);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(OFFICIAL_LINKS.length);
  });
});
