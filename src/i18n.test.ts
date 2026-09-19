import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  isDocumentCrawler,
  localeFromAcceptLanguage,
  localeRedirectLocation,
  parseAppPath,
  pathForApp,
  preferredLocale,
  songCreditLine,
  t,
} from "./i18n.ts";

describe("parseAppPath", () => {
  it("treats unprefixed paths as Japanese", () => {
    expect(parseAppPath("/")).toEqual({ locale: "ja", view: "maker", prefixed: false });
    expect(parseAppPath("/community")).toEqual({ locale: "ja", view: "community", prefixed: false });
    expect(parseAppPath("/community/")).toEqual({ locale: "ja", view: "community", prefixed: false });
  });

  it("reads locale prefixes and community subpaths", () => {
    expect(parseAppPath("/en")).toEqual({ locale: "en", view: "maker", prefixed: true });
    expect(parseAppPath("/ko/community")).toEqual({ locale: "ko", view: "community", prefixed: true });
    expect(parseAppPath("/zh/community/")).toEqual({ locale: "zh", view: "community", prefixed: true });
    expect(parseAppPath("/ja")).toEqual({ locale: "ja", view: "maker", prefixed: true });
  });

  it("ignores static assets and unknown segments", () => {
    expect(parseAppPath("/og.png")).toBeNull();
    expect(parseAppPath("/community-jumps")).toBeNull();
    expect(parseAppPath("/en/template/cuts.json")).toBeNull();
  });
});

describe("pathForApp", () => {
  it("omits a prefix for Japanese and prefixes other locales", () => {
    expect(pathForApp("ja", "maker")).toBe("/");
    expect(pathForApp("ja", "community")).toBe("/community");
    expect(pathForApp("en", "maker")).toBe("/en");
    expect(pathForApp("zh", "community")).toBe("/zh/community");
  });
});

describe("localeFromAcceptLanguage", () => {
  it("picks the highest-q supported language and defaults to Japanese", () => {
    expect(localeFromAcceptLanguage("en-US,en;q=0.9,ja;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("ja-JP,ja;q=0.9")).toBe("ja");
    expect(localeFromAcceptLanguage("ko-KR,ko;q=0.8,en;q=0.5")).toBe("ko");
    expect(localeFromAcceptLanguage("zh-CN,zh;q=0.9")).toBe("zh");
    expect(localeFromAcceptLanguage("zh-TW,zh-Hant;q=0.8")).toBe("zh");
    expect(localeFromAcceptLanguage("fr-FR,fr;q=0.9")).toBeNull();
    expect(preferredLocale(null, "fr")).toBe(DEFAULT_LOCALE);
  });

  it("lets the locale cookie override Accept-Language", () => {
    expect(preferredLocale("anone-locale=ko; Path=/", "en-US")).toBe("ko");
    expect(preferredLocale("anone-locale=ja", "en")).toBe("ja");
  });
});

describe("localeRedirectLocation", () => {
  it("redirects unprefixed paths when the browser language is not Japanese", () => {
    expect(localeRedirectLocation("/", "", null, "en-US")).toBe("/en");
    expect(localeRedirectLocation("/community", "?from=x", null, "ko")).toBe("/ko/community?from=x");
    expect(localeRedirectLocation("/", "", null, "ja-JP")).toBeNull();
    expect(localeRedirectLocation("/en", "", null, "ja")).toBeNull();
  });

  it("canonicalizes /ja onto the unprefixed default URLs", () => {
    expect(localeRedirectLocation("/ja", "", null, "en")).toBe("/");
    expect(localeRedirectLocation("/ja/community", "?q=1", null, null)).toBe("/community?q=1");
  });

  it("honors a language cookie on unprefixed paths", () => {
    expect(localeRedirectLocation("/", "", "anone-locale=zh", "ja")).toBe("/zh");
    expect(localeRedirectLocation("/", "", "anone-locale=ja", "en-US")).toBeNull();
  });

  it("does not language-redirect search or social crawlers", () => {
    expect(
      localeRedirectLocation("/", "", null, "en-US", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"),
    ).toBeNull();
    expect(
      localeRedirectLocation("/community", "", null, "ko", "facebookexternalhit/1.1"),
    ).toBeNull();
    expect(localeRedirectLocation("/ja", "", null, "en", "Googlebot/2.1")).toBe("/");
  });
});

describe("messages", () => {
  it("keeps Japanese as the default copy and translates titles", () => {
    expect(t("ja", "makerTitle")).toBe("あのねジャンプメーカー");
    expect(t("en", "makerTitle")).toBe("Anone Jump Maker");
    expect(t("ko", "makerTitle")).toBe("아노네 점프 메이커");
    expect(t("zh", "makerTitle")).toBe("あのね跳跃制作器");
    expect(t("en", "statusPhotosLoaded", { n: 3 })).toBe("Loaded 3 photos");
    expect(t("ja", "makerAddPhotos")).toBe("写真を追加");
    expect(t("en", "statusPhotosAdded", { n: 1, total: 3 })).toBe("Added 1 photos (3 total)");
    expect(t("ja", "statusPhotoRemoved", { n: 2 })).toBe("写真を外しました（残り 2 枚）");
  });

  it("uses the English store title in non-Japanese credits", () => {
    expect(t("ja", "songTitle")).toBe("あのね");
    expect(t("ja", "artistName")).toBe("ナナツカゼ");
    expect(songCreditLine("ja")).toBe("♪ あのね - ナナツカゼ");
    expect(t("en", "songTitle")).toBe("Anone(Connect the World)");
    expect(t("en", "artistName")).toBe("Nanatsukaze");
    expect(songCreditLine("en")).toBe("♪ Anone(Connect the World) - Nanatsukaze");
    expect(songCreditLine("ko")).toBe(songCreditLine("en"));
    expect(songCreditLine("zh")).toBe(songCreditLine("en"));
  });
});

describe("document crawlers", () => {
  it("recognizes Googlebot and social unfurlers", () => {
    expect(isDocumentCrawler("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(
      true,
    );
    expect(isDocumentCrawler("Twitterbot/1.0")).toBe(true);
    expect(
      isDocumentCrawler(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });
});
