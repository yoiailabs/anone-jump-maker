import { describe, expect, it } from "vitest";
import { LOCALES } from "./i18n";
import { pageMeta, pageUrl, APP_ORIGIN } from "./page-meta";
import { sitemapXml } from "./sitemap";
describe("page metadata", () => {
  it("gives home and maker separate canonical URLs in all locales", () => {
    for (const locale of LOCALES) {
      const home = pageMeta(locale, "home"), maker = pageMeta(locale, "maker");
      expect(home.url).not.toBe(maker.url); expect(maker.url).toBe(`${APP_ORIGIN}${locale === "ja" ? "" : `/${locale}`}/make`);
      expect(maker.lang).toBe(locale); expect(maker.title.length).toBeGreaterThan(0);
      expect(pageUrl(locale, "privacy")).toBe(`${APP_ORIGIN}/privacy`);
      expect(pageUrl(locale, "terms")).toBe(`${APP_ORIGIN}/terms`);
    }
    expect(sitemapXml()).not.toContain("community");
    expect(sitemapXml().match(/<loc>/g)).toHaveLength(10);
  });
});
