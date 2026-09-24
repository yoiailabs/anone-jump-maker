import { describe, expect, it } from "vitest";
import layoutSrc from "./layouts/Layout.astro?raw";
import { googleFontsHref } from "./fonts.ts";

describe("googleFontsHref", () => {
  it("loads only Zen Maru Gothic on Japanese and English pages", () => {
    for (const locale of ["ja", "en"] as const) {
      const href = googleFontsHref(locale);
      expect(href).toContain("Zen+Maru+Gothic");
      expect(href).toContain("wght@400;700");
      expect(href).toContain("display=swap");
      expect(href).not.toContain("500");
      expect(href).not.toContain("Noto+Sans+KR");
      expect(href).not.toContain("Noto+Sans+SC");
    }
  });

  it("adds Noto Sans KR only on Korean pages", () => {
    const href = googleFontsHref("ko");
    expect(href).toContain("Zen+Maru+Gothic");
    expect(href).toContain("Noto+Sans+KR");
    expect(href).toContain("wght@400;700");
    expect(href).not.toContain("500");
    expect(href).not.toContain("Noto+Sans+SC");
  });

  it("adds Noto Sans SC only on Chinese pages", () => {
    const href = googleFontsHref("zh");
    expect(href).toContain("Zen+Maru+Gothic");
    expect(href).toContain("Noto+Sans+SC");
    expect(href).toContain("wght@400;700");
    expect(href).not.toContain("500");
    expect(href).not.toContain("Noto+Sans+KR");
  });
});

describe("Google Fonts markup", () => {
  it("uses one plain stylesheet link so Cloudflare Fonts can remove it", () => {
    expect(layoutSrc).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
    expect(layoutSrc).toContain('rel="preconnect" href="https://fonts.gstatic.com" crossorigin');
    expect(layoutSrc).toContain('<link rel="stylesheet" href={fontHref} />');
    expect(layoutSrc.match(/fonts\.googleapis\.com\/css2|href=\{fontHref\}/g)).toHaveLength(1);
    expect(layoutSrc).not.toContain('media="print"');
    expect(layoutSrc).not.toContain("this.media='all'");
    expect(layoutSrc).not.toContain("<noscript>");
  });
});
