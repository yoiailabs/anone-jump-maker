import { describe, expect, it, vi } from "vitest";
import {
  APP_SHARE_DATA,
  APP_SHARE_URL,
  buildXAndroidComposeUrl,
  buildXAppComposeUrl,
  buildXIntentUrl,
  canShareAppUrl,
  canShareVideoFile,
  copyTextToClipboard,
  mobilePlatform,
  openExternalTab,
  openXAppCompose,
  openXCompose,
  SHARE_HASHTAG,
  SHARE_MAKER_HASHTAG,
  SHARE_TEXT,
  shareAppUrl,
  shareJumpVideo,
  toShareFile,
  xComposeLinkAttrs,
  type AppComposeDeps,
  type ShareNavigatorLike,
} from "./share.ts";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const videoFile = () => toShareFile(new Blob(["x"], { type: "video/mp4" }), "anone-jump-9x16.mp4");

/** アプリに移ったかどうかを手で動かせる `openXAppCompose` の足回り。 */
function fakeAppCompose(options: { hidden: boolean }) {
  const navigated: string[] = [];
  let hidden = options.hidden;
  let onHidden: (() => void) | null = null;
  let timerFn: (() => void) | null = null;
  let cleared = false;
  const deps: AppComposeDeps = {
    navigate: (url) => navigated.push(url),
    isHidden: () => hidden,
    onHidden: (listener) => {
      onHidden = listener;
      return () => {
        onHidden = null;
      };
    },
    setTimer: (listener) => {
      timerFn = listener;
      return 7;
    },
    clearTimer: (id) => {
      expect(id).toBe(7);
      cleared = true;
    },
  };
  return {
    deps,
    navigated,
    get cleared() {
      return cleared;
    },
    hide: () => {
      hidden = true;
      onHidden?.();
    },
    runTimer: () => timerFn?.(),
  };
}

describe("X への投稿", () => {
  it("投稿画面に両方のハッシュタグを載せる", () => {
    const url = new URL(buildXIntentUrl());
    expect(url.origin + url.pathname).toBe("https://x.com/intent/post");
    expect(url.searchParams.get("text")).toBe(SHARE_TEXT);
    expect(SHARE_TEXT).toContain(SHARE_HASHTAG);
    expect(SHARE_TEXT).toContain(SHARE_MAKER_HASHTAG);
    expect(buildXIntentUrl()).toContain(encodeURIComponent(SHARE_TEXT));
  });

  it("共有シートがファイルを扱えるときだけ動画ごと渡す", () => {
    const file = videoFile();
    const willShare: ShareNavigatorLike = { share: async () => {}, canShare: () => true };
    const textOnly: ShareNavigatorLike = { share: async () => {}, canShare: () => false };
    expect(canShareVideoFile(file, willShare)).toBe(true);
    expect(canShareVideoFile(file, textOnly)).toBe(false);
    expect(canShareVideoFile(file, { share: async () => {} })).toBe(false);
    expect(canShareVideoFile(file, undefined)).toBe(false);
    expect(canShareVideoFile(null, willShare)).toBe(false);
  });

  it("共有シートに動画とハッシュタグを渡し、投稿画面は開かない", async () => {
    const file = videoFile();
    const share = vi.fn(async () => {});
    const openUrl = vi.fn(() => true);
    const outcome = await shareJumpVideo({
      file,
      navigator: { share, canShare: () => true },
      openUrl,
    });
    expect(outcome).toBe("files");
    expect(share).toHaveBeenCalledWith({ files: [file], text: SHARE_TEXT });
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("共有シートが無い環境では X の投稿画面を開く", async () => {
    const openUrl = vi.fn(() => true);
    const outcome = await shareJumpVideo({ file: videoFile(), openUrl });
    expect(outcome).toBe("intent");
    expect(openUrl).toHaveBeenCalledWith(buildXIntentUrl());
  });

  it("動画がまだ無くても投稿画面は開く", async () => {
    const openUrl = vi.fn(() => true);
    const share = vi.fn(async () => {});
    const outcome = await shareJumpVideo({
      file: null,
      navigator: { share, canShare: () => true },
      openUrl,
    });
    expect(outcome).toBe("intent");
    expect(share).not.toHaveBeenCalled();
    expect(openUrl).toHaveBeenCalledWith(buildXIntentUrl());
  });

  it("ユーザーが共有シートを閉じたら投稿画面を重ねて開かない", async () => {
    const openUrl = vi.fn(() => true);
    const share = vi.fn(async () => {
      throw Object.assign(new Error("share canceled"), { name: "AbortError" });
    });
    const outcome = await shareJumpVideo({
      file: videoFile(),
      navigator: { share, canShare: () => true },
      openUrl,
    });
    expect(outcome).toBe("cancelled");
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("共有シートが失敗したら投稿画面に落とす", async () => {
    const openUrl = vi.fn(() => true);
    const share = vi.fn(async () => {
      throw new Error("share failed");
    });
    const outcome = await shareJumpVideo({
      file: videoFile(),
      navigator: { share, canShare: () => true },
      openUrl,
    });
    expect(outcome).toBe("intent");
    expect(openUrl).toHaveBeenCalledWith(buildXIntentUrl());
  });

  it("ポップアップが塞がれたら blocked を返す", async () => {
    const outcome = await shareJumpVideo({ file: videoFile(), openUrl: () => false });
    expect(outcome).toBe("blocked");
  });

  it("別タブは noopener 抜きで開き、opener を切る（成功と block を見分けるため）", () => {
    const tab = { opener: {} as unknown } as Window;
    const open = vi.fn(() => tab);
    expect(openExternalTab("https://x.com/intent/post", { open })).toBe(true);
    expect(open).toHaveBeenCalledWith("https://x.com/intent/post", "_blank");
    expect(tab.opener).toBeNull();
    expect(openExternalTab("https://x.com/intent/post", { open: () => null })).toBe(false);
  });

  it("スマホの OS を見分ける（iPadOS は Macintosh を名乗るのでタッチで判定）", () => {
    expect(mobilePlatform({ userAgent: IPHONE_UA, maxTouchPoints: 5 })).toBe("ios");
    expect(mobilePlatform({ userAgent: IPAD_UA, maxTouchPoints: 5 })).toBe("ios");
    expect(mobilePlatform({ userAgent: ANDROID_UA, maxTouchPoints: 5 })).toBe("android");
    expect(mobilePlatform({ userAgent: MAC_UA, maxTouchPoints: 0 })).toBeNull();
    expect(mobilePlatform({ userAgent: IPAD_UA, maxTouchPoints: 0 })).toBeNull();
    expect(mobilePlatform({ userAgent: MAC_UA, userAgentData: { mobile: true } })).toBe("other");
    expect(mobilePlatform(undefined)).toBeNull();
  });

  it("アプリの投稿画面は本文を message で渡す（https の intent は内蔵ブラウザで開くため）", () => {
    expect(buildXAppComposeUrl()).toBe(`twitter://post?message=${encodeURIComponent(SHARE_TEXT)}`);
    expect(buildXAppComposeUrl("#テスト")).toBe("twitter://post?message=%23%E3%83%86%E3%82%B9%E3%83%88");
  });

  it("Android は intent URI で X アプリの共有に渡し、無ければ Web の投稿画面へ落とす", () => {
    const url = buildXAndroidComposeUrl();
    expect(url.startsWith("intent:#Intent;")).toBe(true);
    expect(url).toContain("action=android.intent.action.SEND");
    expect(url).toContain("type=text/plain");
    expect(url).toContain("package=com.twitter.android");
    expect(url).toContain(`S.android.intent.extra.TEXT=${encodeURIComponent(SHARE_TEXT)}`);
    expect(url).toContain(`S.browser_fallback_url=${encodeURIComponent(buildXIntentUrl())}`);
    expect(url.endsWith(";end")).toBe(true);
  });

  it("iOS の投稿リンクは Web の投稿画面のまま（クリック時にアプリへ差し替える）", () => {
    const ios = xComposeLinkAttrs({ platform: "ios" });
    expect(ios.href).toBe(buildXIntentUrl());
    expect(ios.target).toBeNull();
    expect(ios.rel).toBeNull();
  });

  it("Android の投稿リンクは intent URI、UA 不明のスマホは Web の投稿画面", () => {
    expect(xComposeLinkAttrs({ platform: "android" }).href).toBe(buildXAndroidComposeUrl());
    expect(xComposeLinkAttrs({ platform: "other" }).href).toBe(buildXIntentUrl());
    expect(xComposeLinkAttrs({ platform: "android" }).target).toBeNull();
  });

  it("PC は投稿リンクを別タブに出して opener を渡さない", () => {
    const desktop = xComposeLinkAttrs({ platform: null, text: "#テスト" });
    expect(desktop.href).toBe(buildXIntentUrl("#テスト"));
    expect(desktop.target).toBe("_blank");
    expect(desktop.rel).toBe("noopener noreferrer");
  });

  it("iOS はアプリを叩き、出てこなければ Web の投稿画面に落とす", () => {
    const { deps, navigated, runTimer } = fakeAppCompose({ hidden: false });
    openXAppCompose(deps, { appUrl: "twitter://post?message=a", webUrl: "https://x.com/intent/post" });
    expect(navigated).toEqual(["twitter://post?message=a"]);
    runTimer();
    expect(navigated).toEqual(["twitter://post?message=a", "https://x.com/intent/post"]);
  });

  it("アプリが前に出たら待ち時間を止めて Web の投稿画面は開かない", () => {
    const fake = fakeAppCompose({ hidden: false });
    openXAppCompose(fake.deps, {
      appUrl: "twitter://post?message=a",
      webUrl: "https://x.com/intent/post",
    });
    fake.hide();
    expect(fake.cleared).toBe(true);
    fake.runTimer();
    expect(fake.navigated).toEqual(["twitter://post?message=a"]);
  });

  it("画面が隠れたままなら時間切れでも Web に落とさない", () => {
    const { deps, navigated, runTimer } = fakeAppCompose({ hidden: true });
    openXAppCompose(deps, { appUrl: "twitter://post?message=a", webUrl: "https://x.com/intent/post" });
    runTimer();
    expect(navigated).toEqual(["twitter://post?message=a"]);
  });

  it("共有シート後の投稿画面は、スマホなら同じタブで開く", () => {
    const url = buildXIntentUrl();
    const navigate = vi.fn();
    const openTab = vi.fn(() => true);
    expect(openXCompose({ url, appHandoff: true, navigate, openTab })).toBe(true);
    expect(navigate).toHaveBeenCalledWith(url);
    expect(openTab).not.toHaveBeenCalled();
  });

  it("PC の投稿画面は別タブで、塞がれたら失敗を返す", () => {
    const url = buildXIntentUrl();
    const navigate = vi.fn();
    expect(openXCompose({ url, appHandoff: false, navigate, openTab: () => true })).toBe(true);
    expect(openXCompose({ url, appHandoff: false, navigate, openTab: () => false })).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("保存した動画の名前と MIME をそのまま持たせる", () => {
    const file = toShareFile(new Blob(["x"], { type: "video/webm" }), "anone-zoom-16x9.webm");
    expect(file?.name).toBe("anone-zoom-16x9.webm");
    expect(file?.type).toBe("video/webm");
  });
});

describe("このアプリを共有する", () => {
  it("本番 URL とタイトルを Web Share に渡す", () => {
    expect(APP_SHARE_DATA).toEqual({
      title: "あのねジャンプメーカー",
      url: APP_SHARE_URL,
    });
    expect(APP_SHARE_URL).toBe("https://anone.yoiailabs.com");
  });

  it("share があるときだけアプリ URL をシートに出せる", () => {
    expect(canShareAppUrl({ share: async () => {} })).toBe(true);
    expect(canShareAppUrl({ share: async () => {}, canShare: () => true })).toBe(true);
    expect(canShareAppUrl({ share: async () => {}, canShare: () => false })).toBe(false);
    expect(canShareAppUrl(undefined)).toBe(false);
  });

  it("Web Share API で本番 URL を渡す", async () => {
    const share = vi.fn(async () => {});
    const copyText = vi.fn(async () => true);
    const outcome = await shareAppUrl({
      navigator: { share, canShare: () => true },
      copyText,
    });
    expect(outcome).toBe("shared");
    expect(share).toHaveBeenCalledWith(APP_SHARE_DATA);
    expect(copyText).not.toHaveBeenCalled();
  });

  it("ユーザーが共有シートを閉じたらコピーしない", async () => {
    const copyText = vi.fn(async () => true);
    const outcome = await shareAppUrl({
      navigator: {
        share: async () => {
          throw Object.assign(new Error("share canceled"), { name: "AbortError" });
        },
        canShare: () => true,
      },
      copyText,
    });
    expect(outcome).toBe("cancelled");
    expect(copyText).not.toHaveBeenCalled();
  });

  it("Web Share が無い環境では URL をコピーする", async () => {
    const copyText = vi.fn(async () => true);
    const outcome = await shareAppUrl({ copyText });
    expect(outcome).toBe("copied");
    expect(copyText).toHaveBeenCalledWith(APP_SHARE_URL);
  });

  it("共有もコピーもできなければ unsupported", async () => {
    const outcome = await shareAppUrl({
      navigator: { share: async () => {}, canShare: () => false },
      copyText: async () => false,
    });
    expect(outcome).toBe("unsupported");
  });

  it("クリップボードへ書いたら true", async () => {
    const writeText = vi.fn(async () => {});
    expect(await copyTextToClipboard(APP_SHARE_URL, { writeText })).toBe(true);
    expect(writeText).toHaveBeenCalledWith(APP_SHARE_URL);
    expect(await copyTextToClipboard(APP_SHARE_URL)).toBe(false);
  });
});
