import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES, t } from "./i18n.ts";
import makerSrc from "./components/MakerApp.tsx?raw";
import privacySrc from "./components/PrivacyArticle.tsx?raw";
import termsSrc from "./components/TermsArticle.tsx?raw";
import legalLogoSrc from "./components/LegalHeroLogo.tsx?raw";
import headerLockupSrc from "./components/HeaderLockup.tsx?raw";
import {
  MAKER_LOGO_HORIZONTAL_EN_SIZE,
  MAKER_LOGO_HORIZONTAL_EN_SRC,
  MAKER_LOGO_HORIZONTAL_SIZE,
  MAKER_LOGO_HORIZONTAL_SRC,
  MAKER_LOGO_STACKED_EN_SIZE,
  MAKER_LOGO_STACKED_EN_SRC,
  MAKER_LOGO_STACKED_SIZE,
  MAKER_LOGO_STACKED_SRC,
  makerLogoHorizontalSize,
  makerLogoHorizontalSrc,
  makerLogoStackedSize,
  makerLogoStackedSrc,
} from "./brand.ts";

const logoSrc = readFileSync(new URL("../public/brand/anone-logo-stacked.svg", import.meta.url), "utf8");
const logoEnSrc = readFileSync(new URL("../public/brand/anone-logo-stacked-en.svg", import.meta.url), "utf8");
const horizontalSrc = readFileSync(new URL("../public/brand/anone-logo-horizontal.svg", import.meta.url), "utf8");
const horizontalEnSrc = readFileSync(new URL("../public/brand/anone-logo-horizontal-en.svg", import.meta.url), "utf8");
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

  it("replaces the maker hero h1 text with the logo and localized alt", () => {
    expect(makerSrc).toContain('id="makerTitle"');
    expect(makerSrc).toContain("className=\"hero-logo\"");
    expect(makerSrc).toContain("makerLogoStackedSrc(locale)");
    expect(makerSrc).toContain("makerLogoStackedSize(locale)");
    expect(makerSrc).toContain("width={logoSize.width}");
    expect(makerSrc).toContain("height={logoSize.height}");
    expect(makerSrc).toContain('alt={t(locale, "makerTitle")}');
    expect(makerSrc).not.toContain("eyebrow");
    expect(privacySrc).not.toContain("eyebrow");
    expect(termsSrc).not.toContain("eyebrow");
    expect(makerSrc).not.toMatch(/<h1 id="makerTitle">\{t\(locale, "makerTitle"\)\}<\/h1>/);
    const landing = makerSrc.slice(makerSrc.indexOf('id="makerView"'), makerSrc.indexOf('id="studioView"'));
    const studio = makerSrc.slice(makerSrc.indexOf('id="studioView"'), makerSrc.indexOf('id="communityView"'));
    expect(landing.indexOf('id="makerTitle"')).toBeLessThan(landing.indexOf("<JumpLoop"));
    expect(landing.indexOf("<JumpLoop")).toBeLessThan(landing.indexOf('id="toStudio"'));
    expect(landing.indexOf('id="toStudio"')).toBeLessThan(landing.indexOf('id="toCommunity"'));
    expect(landing).not.toContain('id="picker"');
    expect(studio.indexOf('id="onDeviceNote"')).toBeLessThan(studio.indexOf('id="picker"'));
    expect(studio.indexOf('id="picker"')).toBeLessThan(studio.indexOf('id="stage"'));
    expect(studio.indexOf('id="stage"')).toBeLessThan(studio.indexOf('id="previewSeek"'));
    expect(studio).toContain('id="studioEmpty"');
    expect(studio).toContain('id="studioHome"');
    expect(studio).toContain("<HeaderLockup");
    expect(studio).not.toContain("hero-logo");
    expect(studio).not.toContain("anone-logo-stacked");
    expect(studio).not.toContain('id="toLanding"');
    expect(studio).not.toContain("studioBack");
    expect(studio.indexOf('id="studioTitle"')).toBeLessThan(studio.indexOf("<LanguageNav"));
    expect(makerSrc).not.toContain("samplePhotosBtn");
    expect(makerSrc).not.toContain("makerTrySamples");
    expect(makerSrc).not.toContain("<JaLede");
    expect(makerSrc).not.toContain("makerLede");
    expect(makerSrc).toMatch(/<LanguageNav[\s\S]*id="makerTitle"/);
    expect(makerSrc).toContain('className="make-cta"');
    expect(makerSrc).toContain('<footer className="notes">');
    for (const locale of LOCALES) {
      expect(t(locale, "makerTitle").length).toBeGreaterThan(0);
    }
  });

  it("keeps the logo from overflowing the hero column", () => {
    expect(stylesSrc).toMatch(/\.hero-logo\s*\{[^}]*max-width:\s*100%/);
    expect(stylesSrc).toMatch(/\.hero-logo\s*\{[^}]*height:\s*auto/);
    expect(stylesSrc).toMatch(/\.hero-logo\s*\{[^}]*aspect-ratio:\s*640\s*\/\s*365/);
    expect(stylesSrc).toMatch(/\.hero-logo\[height="390"\]\s*\{[^}]*aspect-ratio:\s*640\s*\/\s*390/);
    expect(stylesSrc).toMatch(/\.hero-logo\s*\{[^}]*width:\s*min\(100%,\s*22rem\)/);
  });

  it("uses the horizontal wordmark on studio and legal headers", () => {
    expect(MAKER_LOGO_HORIZONTAL_SRC).toBe("/brand/anone-logo-horizontal.svg");
    expect(MAKER_LOGO_HORIZONTAL_EN_SRC).toBe("/brand/anone-logo-horizontal-en.svg");
    expect(MAKER_LOGO_HORIZONTAL_SIZE).toEqual({ width: 720, height: 165 });
    expect(MAKER_LOGO_HORIZONTAL_EN_SIZE).toEqual({ width: 720, height: 176 });
    expect(makerLogoHorizontalSrc("ja")).toBe(MAKER_LOGO_HORIZONTAL_SRC);
    expect(makerLogoHorizontalSrc("en")).toBe(MAKER_LOGO_HORIZONTAL_EN_SRC);
    expect(makerLogoHorizontalSrc("ko")).toBe(MAKER_LOGO_HORIZONTAL_EN_SRC);
    expect(makerLogoHorizontalSrc("zh")).toBe(MAKER_LOGO_HORIZONTAL_EN_SRC);
    expect(makerLogoHorizontalSize("ja")).toEqual(MAKER_LOGO_HORIZONTAL_SIZE);
    expect(makerLogoHorizontalSize("en")).toEqual(MAKER_LOGO_HORIZONTAL_EN_SIZE);
    expect(horizontalSrc).toContain('viewBox="0 0 720 165"');
    expect(horizontalSrc).toContain("<title id=\"title\">あのねジャンプメーカー</title>");
    expect(horizontalEnSrc).toContain('viewBox="0 0 720 176"');
    expect(horizontalEnSrc).toContain("<title id=\"title\">Anone Jump Maker</title>");
    for (const mark of [horizontalSrc, horizontalEnSrc]) {
      expect(mark).toContain('fill="#48B5D8"');
      expect(mark).toContain('fill="#78C8E4"');
      expect(mark).toContain('fill="#969DA3"');
      expect(mark).toContain('fill="#FFFFFF"');
      expect(mark).not.toContain("#A4DCF0");
    }
    expect(headerLockupSrc).toContain("makerLogoHorizontalSrc(locale)");
    expect(headerLockupSrc).toContain('className="header-lockup-logo"');
    expect(headerLockupSrc).toContain('alt={t(locale, "makerTitle")}');
    expect(headerLockupSrc).toContain('href={pathForApp(locale, "maker")}');
    expect(headerLockupSrc).not.toContain("HEADER_MARK_SRC");
    expect(headerLockupSrc).not.toContain("header-lockup-title");
    expect(headerLockupSrc).not.toContain("hero-logo");
    expect(headerLockupSrc).not.toContain("anone-logo-stacked");
    expect(legalLogoSrc).toContain("<HeaderLockup");
    expect(legalLogoSrc).toContain('id="legalHome"');
    expect(legalLogoSrc).toContain('locale="ja"');
    expect(legalLogoSrc).toContain("label={HOME_LABEL}");
    expect(legalLogoSrc).toContain('const HOME_LABEL = "トップへ戻る"');
    expect(legalLogoSrc).not.toContain("MAKER_LOGO_STACKED_SRC");
    expect(legalLogoSrc).not.toContain("hero-logo");
    expect(privacySrc).toContain("<LegalHeroLogo />");
    expect(termsSrc).toContain("<LegalHeroLogo />");
    expect(privacySrc).not.toContain("anone-logo-stacked");
    expect(termsSrc).not.toContain("anone-logo-stacked");
    expect(stylesSrc).toMatch(/\.header-lockup\s*\{[^}]*display:\s*inline-flex/);
    expect(stylesSrc).toMatch(/\.header-lockup-logo\s*\{[^}]*height:\s*2\.15rem/);
    expect(stylesSrc).toMatch(/\.hero,\s*\.studio-top\s*\{[^}]*text-align:\s*center/);
    expect(stylesSrc).toMatch(/\.studio-top \.header-lockup\s*\{[^}]*margin:\s*0\.15rem auto 0\.2rem/);
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
