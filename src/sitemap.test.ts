import { describe, expect, it } from "vitest";
import { sitemapXml } from "./sitemap.ts";

describe("sitemapXml", () => {
  it("lists every locale page with hreflang alternates", () => {
    const xml = sitemapXml();
    expect(xml).toContain("https://anone.yoiailabs.com/");
    expect(xml).toContain("https://anone.yoiailabs.com/en");
    expect(xml).toContain("https://anone.yoiailabs.com/ko/community");
    expect(xml).toContain("https://anone.yoiailabs.com/zh");
    expect(xml).toContain('hreflang="ja"');
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).toContain("xmlns:xhtml=");
  });
});
