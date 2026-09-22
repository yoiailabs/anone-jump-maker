import { describe, expect, it } from "vitest";
import { LOCALES, t } from "./i18n.ts";


describe("verified browsers notice", () => {
  it("uses a short 動作確認済み line in every locale", () => {
    expect(t("ja", "makerBrowsersNote")).toBe("動作確認済みブラウザ: Safari, Chrome");
    expect(t("en", "makerBrowsersNote")).toBe("Verified browsers: Safari, Chrome");
    expect(t("ko", "makerBrowsersNote")).toBe("동작 확인된 브라우저: Safari, Chrome");
    expect(t("zh", "makerBrowsersNote")).toBe("已确认可运行的浏览器：Safari, Chrome");
  });

  it("names only Safari and Chrome, without a support guarantee", () => {
    for (const locale of LOCALES) {
      const copy = t(locale, "makerBrowsersNote");
      expect(copy).toContain("Safari");
      expect(copy).toContain("Chrome");
      expect(copy).not.toMatch(/iOS|Android|iPad|Linux|Mac|サポート|support|지원|支持|Edge/i);
    }
  });


});
