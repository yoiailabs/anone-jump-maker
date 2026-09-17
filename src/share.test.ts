import { describe, expect, it, vi } from "vitest";
import {
  APP_SHARE_DATA,
  APP_SHARE_URL,
  canShareAppUrl,
  copyTextToClipboard,
  SHARE_HASHTAG,
  SHARE_MAKER_HASHTAG,
  SHARE_TEXT,
  shareAppUrl,
} from "./share.ts";

describe("ハッシュタグをコピー", () => {
  it("両方のハッシュタグを本文にする", () => {
    expect(SHARE_TEXT).toBe("#あのねジャンプ #あのねジャンプメーカー");
    expect(SHARE_TEXT).toContain(SHARE_HASHTAG);
    expect(SHARE_TEXT).toContain(SHARE_MAKER_HASHTAG);
  });

  it("クリップボードへハッシュタグを書いたら true", async () => {
    const writeText = vi.fn(async () => {});
    expect(await copyTextToClipboard(SHARE_TEXT, { writeText })).toBe(true);
    expect(writeText).toHaveBeenCalledWith(SHARE_TEXT);
    expect(await copyTextToClipboard(SHARE_TEXT)).toBe(false);
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
