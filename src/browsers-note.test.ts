import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES, t, type Locale } from "./i18n.ts";
import makerSrc from "./components/MakerApp.tsx?raw";
import noteSrc from "./components/BrowsersNote.tsx?raw";

const stylesSrc = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

const BROWSER_NOTE_KEYS = [
  "makerBrowsersHeading",
  "makerBrowsersIos",
  "makerBrowsersAndroid",
  "makerBrowsersDesktop",
  "makerBrowsersMacSafari",
] as const;

function noteCopy(locale: Locale): string {
  return BROWSER_NOTE_KEYS.map((key) => t(locale, key)).join("\n");
}

describe("verified browsers notice", () => {
  it("uses 動作確認済み-style wording in every locale", () => {
    expect(t("ja", "makerBrowsersHeading")).toBe("動作確認済み");
    expect(t("en", "makerBrowsersHeading")).toBe("Verified on");
    expect(t("ko", "makerBrowsersHeading")).toBe("동작 확인됨");
    expect(t("zh", "makerBrowsersHeading")).toBe("已确认可运行");
  });

  it("lists the verified browsers without a support guarantee", () => {
    for (const locale of LOCALES) {
      const copy = noteCopy(locale);
      expect(copy).toContain("iOS / iPad");
      expect(copy).toContain("Safari");
      expect(copy).toContain("Android");
      expect(copy).toContain("Chrome");
      expect(copy).toContain("PC / Mac / Linux");
      expect(copy).toMatch(/Safari も可|Safari also OK|Safari도 가능|Safari 也可以/);
      expect(copy).not.toMatch(/サポート|support|지원|支持|Edge/i);
    }
  });

  it("renders in the maker hero after the unofficial lede", () => {
    expect(noteSrc).toContain('id="browsersNote"');
    expect(noteSrc).toContain("makerBrowsersHeading");
    expect(makerSrc).toMatch(/<JaLede\b[^/]*\/>\s*<BrowsersNote\b/);
    expect(makerSrc).not.toMatch(/id="browsersNote"[^>]*translate="no"|translate="no"[^>]*id="browsersNote"/);
    expect(stylesSrc).toMatch(/\.browsers-note\s*\{/);
  });
});
