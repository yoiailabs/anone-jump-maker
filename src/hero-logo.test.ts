import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES, t } from "./i18n.ts";
import privacySrc from "./components/PrivacyArticle.tsx?raw";
import termsSrc from "./components/TermsArticle.tsx?raw";
import legalLogoSrc from "./components/LegalHeroLogo.tsx?raw";
import {
  MAKER_LOGO_STACKED_EN_SIZE,
  MAKER_LOGO_STACKED_EN_SRC,
  MAKER_LOGO_STACKED_SIZE,
  MAKER_LOGO_STACKED_SRC,
  makerLogoStackedSize,
  makerLogoStackedSrc,
} from "./brand.ts";

const logoSrc = readFileSync(new URL("../public/brand/anone-logo-stacked.svg", import.meta.url), "utf8");
const logoEnSrc = readFileSync(new URL("../public/brand/anone-logo-stacked-en.svg", import.meta.url), "utf8");
const stylesSrc = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const ogHtml = readFileSync(new URL("../scripts/og.html", import.meta.url), "utf8");
const renderOg = readFileSync(new URL("../scripts/render-og.mjs", import.meta.url), "utf8");

describe("stacked maker hero logo", () => {
  it("ships the stacked wordmark only (640×365)", () => {
    expect(MAKER_LOGO_STACKED_SRC).toBe("/brand/anone-logo-stacked.svg");
    expect(MAKER_LOGO_STACKED_SIZE).toEqual({ width: 640, height: 365 });
    expect(logoSrc).toContain('viewBox="0 0 640 365"');
    expect(logoSrc).toContain('width="640"');
    expect(logoSrc).toContain('height="365"');
    expect(logoSrc).toContain("<title id=\"title\">あのねジャンプメーカー</title>");
    expect(logoSrc).not.toContain("anone-logo-wide");
    expect(logoSrc).not.toContain("anone-logo-inline");
  });

  it("darkens only the ジャンプ fill toward the mid cyan", () => {
    expect(logoSrc).toContain('fill="#78C8E4"');
    expect(logoSrc).not.toContain("#A4DCF0");
    expect(logoSrc).toContain('fill="#48B5D8"');
    expect(logoSrc).toContain('fill="#969DA3"');
    expect(logoSrc).toContain('fill="#FFFFFF"');
    expect(logoSrc.match(/fill="#78C8E4"/g)?.length).toBe(4);
    expect(logoSrc.match(/fill="#48B5D8"/g)?.length).toBe(4);
  });



  it("keeps the logo from overflowing the hero column", () => {
    expect(stylesSrc).toMatch(/\.hero-logo\s*\{[^}]*max-width:\s*100%/);
    expect(stylesSrc).toMatch(/\.hero-logo\s*\{[^}]*height:\s*auto/);
    expect(stylesSrc).toMatch(/\.hero-logo\s*\{[^}]*aspect-ratio:\s*640\s*\/\s*365/);
    expect(stylesSrc).toMatch(/\.hero-logo\[height="390"\]\s*\{[^}]*aspect-ratio:\s*640\s*\/\s*390/);
    expect(stylesSrc).toMatch(/\.hero-logo\s*\{[^}]*width:\s*min\(100%,\s*22rem\)/);
  });

  it("links the Japanese stacked logo home on the legal pages", () => {
    expect(legalLogoSrc).toContain("MAKER_LOGO_STACKED_SRC");
    expect(legalLogoSrc).not.toContain("MAKER_LOGO_STACKED_EN_SRC");
    expect(legalLogoSrc).toContain('href={pathForApp("ja", "home")}');
    expect(legalLogoSrc).toContain('aria-label={HOME_LABEL}');
    expect(legalLogoSrc).toContain("alt={HOME_LABEL}");
    expect(legalLogoSrc).toContain('const HOME_LABEL = "トップへ戻る"');
    expect(legalLogoSrc).toContain('id="legalHome"');
    expect(privacySrc).toContain("<LegalHeroLogo />");
    expect(termsSrc).toContain("<LegalHeroLogo />");
    expect(privacySrc).not.toContain("anone-logo-stacked-en");
    expect(termsSrc).not.toContain("anone-logo-stacked-en");
  });

  it("uses the Japanese stacked mark on ja and the English mark on en/ko/zh", () => {
    expect(MAKER_LOGO_STACKED_EN_SRC).toBe("/brand/anone-logo-stacked-en.svg");
    expect(MAKER_LOGO_STACKED_EN_SIZE).toEqual({ width: 640, height: 390 });
    expect(makerLogoStackedSrc("ja")).toBe(MAKER_LOGO_STACKED_SRC);
    expect(makerLogoStackedSrc("en")).toBe(MAKER_LOGO_STACKED_EN_SRC);
    expect(makerLogoStackedSrc("ko")).toBe(MAKER_LOGO_STACKED_EN_SRC);
    expect(makerLogoStackedSrc("zh")).toBe(MAKER_LOGO_STACKED_EN_SRC);
    expect(makerLogoStackedSize("ja")).toEqual(MAKER_LOGO_STACKED_SIZE);
    expect(makerLogoStackedSize("en")).toEqual(MAKER_LOGO_STACKED_EN_SIZE);
    expect(existsSync(new URL("../public/brand/anone-logo-stacked-ko.svg", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../public/brand/anone-logo-stacked-zh.svg", import.meta.url))).toBe(false);
    expect(logoEnSrc).toContain('viewBox="0 0 640 390"');
    expect(logoEnSrc).toContain('width="640"');
    expect(logoEnSrc).toContain('height="390"');
    expect(logoEnSrc).toContain("<title id=\"title\">Anone Jump Maker</title>");
    expect(logoEnSrc).toContain('fill="#48B5D8"');
    expect(logoEnSrc).toContain('fill="#969DA3"');
    expect(logoEnSrc).toContain('fill="#FFFFFF"');
    expect(logoEnSrc).not.toContain("あのね");
    expect(logoEnSrc).not.toContain("#A4DCF0");
    expect(logoEnSrc).not.toContain("#78C8E4");
  });
});

describe("stacked OGP wordmark", () => {
  it("uses the production stacked SVG as the OGP title, not a text heading", () => {
    expect(ogHtml).toContain(`src="${MAKER_LOGO_STACKED_SRC}"`);
    expect(ogHtml).toContain(`"${MAKER_LOGO_STACKED_EN_SRC}"`);
    expect(ogHtml).toContain('class="hero-logo"');
    expect(ogHtml).toContain(`width="${MAKER_LOGO_STACKED_SIZE.width}"`);
    expect(ogHtml).toContain(`height="${MAKER_LOGO_STACKED_SIZE.height}"`);
    expect(ogHtml).toContain(`height: ${MAKER_LOGO_STACKED_EN_SIZE.height}`);
    expect(ogHtml).toMatch(/\.hero-logo\s*\{[^}]*aspect-ratio:\s*640\s*\/\s*365/);
    expect(ogHtml).toMatch(/\.hero-logo\[height="390"\]\s*\{[^}]*aspect-ratio:\s*640\s*\/\s*390/);
    expect(ogHtml).not.toMatch(/<h1 id="ogTitle">[^<]*<\/h1>/);
    expect(ogHtml).not.toContain("document.getElementById(\"ogTitle\").textContent");
    expect(renderOg).toContain("/brand/anone-logo-stacked.svg");
    expect(renderOg).toContain("/brand/anone-logo-stacked-en.svg");
    expect(renderOg).toContain("anone-logo-stacked-en.svg");
    for (const locale of LOCALES) {
      expect(ogHtml).toContain(t(locale, "makerTitle"));
    }
  });
});
