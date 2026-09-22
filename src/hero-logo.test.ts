import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES, t } from "./i18n.ts";
import makerSrc from "./components/MakerApp.tsx?raw";
import { MAKER_LOGO_STACKED_SIZE, MAKER_LOGO_STACKED_SRC } from "./brand.ts";

const logoSrc = readFileSync(new URL("../public/brand/anone-logo-stacked.svg", import.meta.url), "utf8");
const stylesSrc = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("stacked maker hero logo", () => {
  it("ships the stacked wordmark only (600×335)", () => {
    expect(MAKER_LOGO_STACKED_SRC).toBe("/brand/anone-logo-stacked.svg");
    expect(MAKER_LOGO_STACKED_SIZE).toEqual({ width: 600, height: 335 });
    expect(logoSrc).toContain('viewBox="0 0 600 335"');
    expect(logoSrc).toContain("<title id=\"title\">あのねジャンプメーカー</title>");
    expect(logoSrc).toContain('fill="#BCE7F5"');
    expect(logoSrc).toContain('stroke="#000000"');
    expect(logoSrc).toContain('stroke="#FFFFFF"');
    expect(logoSrc).toContain('id="soft-shadow"');
    expect(logoSrc).toContain("feGaussianBlur");
    expect(logoSrc).not.toContain("#777F83");
    expect(logoSrc).toContain('stroke="#72BEDB"');
    expect(logoSrc).toContain('fill="#244A62"');
    expect(logoSrc).not.toContain("anone-logo-wide");
    expect(logoSrc).not.toContain("anone-logo-inline");
  });

  it("replaces the maker hero h1 text with the logo and localized alt", () => {
    expect(makerSrc).toContain('id="makerTitle"');
    expect(makerSrc).toContain("className=\"hero-logo\"");
    expect(makerSrc).toContain("MAKER_LOGO_STACKED_SRC");
    expect(makerSrc).toContain('alt={t(locale, "makerTitle")}');
    expect(makerSrc).not.toMatch(/<h1 id="makerTitle">\{t\(locale, "makerTitle"\)\}<\/h1>/);
    expect(makerSrc).toMatch(/<LanguageNav[\s\S]*id="makerTitle"[\s\S]*<JaLede\b/);
    expect(makerSrc).toMatch(/<JaLede\b[\s\S]*id="toCommunity"/);
    expect(makerSrc).toMatch(/<BrowsersNote\b[^/]*\/>\s*<Label className="file-btn">/);
    expect(makerSrc).toContain('<footer className="notes">');
    for (const locale of LOCALES) {
      expect(t(locale, "makerTitle").length).toBeGreaterThan(0);
    }
  });

  it("keeps the logo from overflowing the hero column", () => {
    expect(stylesSrc).toMatch(/\.hero-logo\s*\{[^}]*max-width:\s*100%/);
    expect(stylesSrc).toMatch(/\.hero-logo\s*\{[^}]*height:\s*auto/);
    expect(stylesSrc).toMatch(/\.hero-logo\s*\{[^}]*width:\s*min\(100%,\s*22rem\)/);
  });
});
