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
    expect(parseAppPath("/make")).toEqual({ locale: "ja", view: "studio", prefixed: false });
    expect(parseAppPath("/make/")).toEqual({ locale: "ja", view: "studio", prefixed: false });
    expect(parseAppPath("/community")).toEqual({ locale: "ja", view: "community", prefixed: false });
    expect(parseAppPath("/community/")).toEqual({ locale: "ja", view: "community", prefixed: false });
    expect(parseAppPath("/privacy")).toEqual({ locale: "ja", view: "privacy", prefixed: false });
    expect(parseAppPath("/privacy/")).toEqual({ locale: "ja", view: "privacy", prefixed: false });
    expect(parseAppPath("/terms")).toEqual({ locale: "ja", view: "terms", prefixed: false });
    expect(parseAppPath("/terms/")).toEqual({ locale: "ja", view: "terms", prefixed: false });
  });

  it("reads locale prefixes and community subpaths", () => {
    expect(parseAppPath("/en")).toEqual({ locale: "en", view: "maker", prefixed: true });
    expect(parseAppPath("/en/make")).toEqual({ locale: "en", view: "studio", prefixed: true });
    expect(parseAppPath("/ko/make/")).toEqual({ locale: "ko", view: "studio", prefixed: true });
    expect(parseAppPath("/ko/community")).toEqual({ locale: "ko", view: "community", prefixed: true });
    expect(parseAppPath("/zh/community/")).toEqual({ locale: "zh", view: "community", prefixed: true });
    expect(parseAppPath("/en/privacy")).toEqual({ locale: "en", view: "privacy", prefixed: true });
    expect(parseAppPath("/en/terms")).toEqual({ locale: "en", view: "terms", prefixed: true });
    expect(parseAppPath("/ja")).toEqual({ locale: "ja", view: "maker", prefixed: true });
    expect(parseAppPath("/ja/privacy")).toEqual({ locale: "ja", view: "privacy", prefixed: true });
    expect(parseAppPath("/ja/terms")).toEqual({ locale: "ja", view: "terms", prefixed: true });
  });

  it("ignores static assets and unknown segments", () => {
    expect(parseAppPath("/og.png")).toBeNull();
    expect(parseAppPath("/sw.js")).toBeNull();
    expect(parseAppPath("/manifest.webmanifest")).toBeNull();
    expect(parseAppPath("/icons/icon-192.png")).toBeNull();
    expect(parseAppPath("/community-jumps")).toBeNull();
    expect(parseAppPath("/en/template/cuts.json")).toBeNull();
  });
});

describe("pathForApp", () => {
  it("omits a prefix for Japanese and prefixes other locales", () => {
    expect(pathForApp("ja", "maker")).toBe("/");
    expect(pathForApp("ja", "studio")).toBe("/make");
    expect(pathForApp("en", "studio")).toBe("/en/make");
    expect(pathForApp("ja", "community")).toBe("/community");
    expect(pathForApp("ja", "privacy")).toBe("/privacy");
    expect(pathForApp("ja", "terms")).toBe("/terms");
    expect(pathForApp("en", "maker")).toBe("/en");
    expect(pathForApp("zh", "community")).toBe("/zh/community");
    expect(pathForApp("en", "privacy")).toBe("/privacy");
    expect(pathForApp("ko", "terms")).toBe("/terms");
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
    expect(localeRedirectLocation("/make", "", null, "en-US")).toBe("/en/make");
    expect(localeRedirectLocation("/community", "?from=x", null, "ko")).toBe("/ko/community?from=x");
    expect(localeRedirectLocation("/privacy", "", null, "en-US")).toBeNull();
    expect(localeRedirectLocation("/terms", "", null, "en-US")).toBeNull();
    expect(localeRedirectLocation("/privacy", "", "anone-locale=en", "ja")).toBeNull();
    expect(localeRedirectLocation("/", "", null, "ja-JP")).toBeNull();
    expect(localeRedirectLocation("/en", "", null, "ja")).toBeNull();
  });

  it("canonicalizes /ja onto the unprefixed default URLs", () => {
    expect(localeRedirectLocation("/ja", "", null, "en")).toBe("/");
    expect(localeRedirectLocation("/ja/make", "", null, null)).toBe("/make");
    expect(localeRedirectLocation("/ja/community", "?q=1", null, null)).toBe("/community?q=1");
    expect(localeRedirectLocation("/ja/privacy", "", null, null)).toBe("/privacy");
    expect(localeRedirectLocation("/ja/terms", "", null, null)).toBe("/terms");
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

  it("ignores Accept-Language on the worker so unknown crawlers still get Japanese /", () => {
    expect(localeRedirectLocation("/", "", null, "en-US", "Chrome/128", { acceptLanguageRedirect: false })).toBeNull();
    expect(
      localeRedirectLocation("/community", "?from=x", null, "ko", "Chrome/128", { acceptLanguageRedirect: false }),
    ).toBeNull();
    expect(
      localeRedirectLocation("/", "", "anone-locale=en", "ja", "Chrome/128", { acceptLanguageRedirect: false }),
    ).toBe("/en");
  });
});

describe("messages", () => {
  it("keeps Japanese as the default copy and translates titles", () => {
    expect(t("ja", "makerTitle")).toBe("あのねジャンプメーカー");
    expect(t("ja", "pwaShortName")).toBe("あのねジャンプ");
    expect(t("en", "makerTitle")).toBe("Anone Jump Maker");
    expect(t("en", "pwaShortName")).toBe("Anone Jump");
    expect(t("ko", "makerTitle")).toBe("아노네 점프 메이커");
    expect(t("zh", "makerTitle")).toBe("あのね跳跃制作器");
    expect(t("en", "statusPhotosLoaded", { n: 3 })).toBe("Loaded 3 photos");
    expect(t("ja", "exportTitle")).toBe("動画を生成中");
    expect(t("ja", "exportCancel")).toBe("キャンセル");
    expect(t("ja", "exportKeepOpen")).toBe("端末上で動画を生成します。数十秒かかることがあります。");
    expect(t("en", "exportKeepOpen")).toBe("Video is generated on this device. It can take several tens of seconds.");
    expect(t("ko", "exportKeepOpen")).toBe("이 기기에서 영상을 만들어요. 수십 초 걸릴 수 있어요.");
    expect(t("zh", "exportKeepOpen")).toBe("视频会在这台设备上生成，可能需要几十秒。");
    expect(t("ja", "statusExportReadyDownload")).toBe("ダウンロードボタンで保存してください。");
    expect(t("en", "statusExportReadyDownload")).toBe("Save it with the Download button.");
    expect(t("ko", "statusExportReadyDownload")).toBe("다운로드 버튼으로 저장하세요.");
    expect(t("zh", "statusExportReadyDownload")).toBe("请点「下载」保存。");
    expect(t("ja", "statusExportShareCancelled")).toBe("共有をやめました。もう一度ダウンロードを押せます。");
    expect(t("en", "exportDownload")).toBe("Download");
    expect(t("ko", "statusExportCancelled")).toBe("생성을 취소했습니다");
    expect(t("zh", "exportTitle")).toBe("正在生成视频");
    expect(t("ja", "makerOnDevice")).toBe("端末上で動画を生成します。数十秒かかることがあります。");
    expect(t("en", "makerOnDevice")).toBe("Video is generated on this device. It can take several tens of seconds.");
    expect(t("ko", "makerOnDevice")).toBe("이 기기에서 영상을 만들어요. 수십 초 걸릴 수 있어요.");
    expect(t("zh", "makerOnDevice")).toBe("视频会在这台设备上生成，可能需要几十秒。");
    expect(t("ja", "makerAddPhotos")).toBe("写真を追加");
    expect(t("ja", "makerPhotosAtCap", { n: 32 })).toBe("これ以上追加できません（32枚まで）");
    expect(t("en", "statusPhotosAdded", { n: 1, total: 3 })).toBe("Added 1 photos (3 total)");
    expect(t("ja", "statusPhotoRemoved", { n: 2 })).toBe("写真を外しました（残り 2 枚）");
    expect(t("ja", "makerThumbsHint")).toBe("長押しして画像の順序を変更できます。");
    expect(t("en", "makerThumbsHint")).toBe("Press and hold to reorder.");
    expect(t("ja", "statusShared")).toBe("ハッシュタグを共有先に渡しました");
    expect(t("en", "statusShared")).toBe("Sent the hashtags to the share target");
    expect(t("ja", "statusShareUnsupported", { text: "#あのねジャンプ #あのねジャンプメーカー" })).toBe(
      "このブラウザでは共有できません。#あのねジャンプ #あのねジャンプメーカー をコピーしてください。",
    );
    expect(t("en", "statusShareUnsupported", { text: "#あのねジャンプ #あのねジャンプメーカー" })).not.toMatch(
      /https?:\/\//,
    );
    expect(t("ja", "makerOfficialMv")).toBe("「あのね」MV");
    expect(t("en", "makerOfficialMv")).toBe("“Connect the World” MV");
    expect(t("ja", "studioOptions")).toBe("オプション");
    expect(t("en", "studioOptions")).toBe("Options");
    expect(t("ko", "studioOptions")).toBe("옵션");
    expect(t("zh", "studioOptions")).toBe("选项");
    expect(t("ja", "studioTabAspect")).toBe("向き");
    expect(t("ja", "studioTabEffect")).toBe("エフェクト");
    expect(t("ja", "studioTabFilter")).toBe("フィルター");
    expect(t("ja", "studioTabCharacter")).toBe("キャラサイズ");
    expect(t("ja", "studioTabCharacterShort")).toBe("サイズ");
    expect(t("en", "studioTabAspect")).toBe("Aspect");
    expect(t("en", "studioTabCharacter")).toBe("Size");
    expect(t("ja", "makerLandscape")).toBe("横");
    expect(t("ja", "makerFilterBlurWeak")).toBe("ブラー(弱)");
    expect(t("ja", "makerFilterBlurStrong")).toBe("ブラー(強)");
    expect(t("en", "makerLandscape")).toBe("Landscape");
    expect(t("en", "makerFilterBlurWeak")).toBe("Blur (soft)");
    expect(t("ja", "makerCharacterLegend")).toBe("キャラサイズ");
    expect(t("ja", "makerCharacterStandard")).toBe("標準");
    expect(t("ja", "makerCharacter12")).toBe("1.2");
    expect(t("ja", "makerCharacter14")).toBe("1.4");
    expect(t("en", "makerCharacterLegend")).toBe("Character size");
    expect(t("en", "makerCharacterStandard")).toBe("Standard");
    expect(t("en", "makerCharacter12")).toBe("1.2");
    expect(t("ko", "makerCharacterStandard")).toBe("표준");
    expect(t("zh", "makerCharacter14")).toBe("1.4");
    expect(t("ja", "previewCharacterAria")).toBe("プレビューのキャラサイズ");
    expect(t("ja", "previewSaveHint")).toBe("端末上で動画を生成します。数十秒かかることがあります。");
    expect(t("en", "previewSaveHint")).toBe("Video is generated on this device. It can take several tens of seconds.");
    expect(t("ko", "previewSaveHint")).toBe("이 기기에서 영상을 만들어요. 수십 초 걸릴 수 있어요.");
    expect(t("zh", "previewSaveHint")).toBe("视频会在这台设备上生成，可能需要几十秒。");
    expect(t("ja", "previewMuteHint")).toBe("プレビュー時のみ");
    expect(t("en", "previewMuteHint")).toBe("Preview only");
    expect(t("ko", "previewMuteHint")).toBe("미리보기에서만");
    expect(t("zh", "previewMuteHint")).toBe("仅预览时");
  });

  it("describes on-device video and names Yoiailabs", () => {
    expect(t("ja", "privacyTitle")).toBe("プライバシーポリシー");
    expect(t("ja", "termsTitle")).toBe("利用規約");
    expect(t("en", "privacyTitle")).toBe("Privacy Policy");
    expect(t("en", "termsTitle")).toBe("Terms of Use");
    expect(t("ko", "privacyTitle")).toBe("개인정보 처리방침");
    expect(t("zh", "privacyTitle")).toBe("隐私政策");
    expect(t("ja", "footerOperator")).toContain("Yoiailabs");
    expect(t("en", "footerOperator")).toContain("Yoiailabs");
    expect(t("ja", "metaPrivacyDescription")).toContain("Yoiailabs");
  });

  it("uses the official song title in each locale's credit", () => {
    expect(t("ja", "songTitle")).toBe("あのね");
    expect(t("ja", "artistName")).toBe("ナナツカゼ");
    expect(songCreditLine("ja")).toBe("♪ あのね - ナナツカゼ");
    expect(t("en", "songTitle")).toBe("Connect the World");
    expect(t("en", "artistName")).toBe("Nanatsukaze");
    expect(songCreditLine("en")).toBe("♪ Connect the World - Nanatsukaze");
    expect(t("ko", "songTitle")).toBe("있잖아");
    expect(songCreditLine("ko")).toBe("♪ 있잖아 - Nanatsukaze");
    expect(t("zh", "songTitle")).toBe("Connect the World");
    expect(songCreditLine("zh")).toBe("♪ Connect the World - Nanatsukaze");
  });
});

describe("document crawlers", () => {
  it("recognizes Googlebot and social unfurlers", () => {
    expect(isDocumentCrawler("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(
      true,
    );
    expect(isDocumentCrawler("Twitterbot/1.0")).toBe(true);
    expect(isDocumentCrawler("meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)")).toBe(
      true,
    );
    expect(
      isDocumentCrawler(
        "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36 (compatible; GoogleOther)",
      ),
    ).toBe(true);
    expect(
      isDocumentCrawler(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari Line/13.6.0",
      ),
    ).toBe(true);
    expect(
      isDocumentCrawler(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });
});
