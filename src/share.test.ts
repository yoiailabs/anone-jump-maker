import { describe, expect, it, vi } from "vitest";
import {
  APP_SHARE_DATA,
  canShareHashtags,
  copyTextToClipboard,
  SHARE_HASHTAG,
  SHARE_MAKER_HASHTAG,
  SHARE_TEXT,
  shareHashtags,
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
    const denied = vi.fn(async () => {
      throw new Error("denied");
    });
    expect(await copyTextToClipboard(SHARE_TEXT, { writeText: denied })).toBe(false);
  });
});

describe("共有する", () => {
  it("Web Share にはハッシュタグ本文だけを渡し URL は付けない", () => {
    expect(APP_SHARE_DATA).toEqual({
      text: SHARE_TEXT,
    });
    expect(APP_SHARE_DATA).not.toHaveProperty("url");
    expect(APP_SHARE_DATA).not.toHaveProperty("title");
    expect(APP_SHARE_DATA.text).toBe("#あのねジャンプ #あのねジャンプメーカー");
    expect(JSON.stringify(APP_SHARE_DATA)).not.toMatch(/https?:\/\//);
  });

  it("share があるときだけハッシュタグをシートに出せる", () => {
    expect(canShareHashtags({ share: async () => {} })).toBe(true);
    expect(canShareHashtags({ share: async () => {}, canShare: () => true })).toBe(true);
    expect(canShareHashtags({ share: async () => {}, canShare: () => false })).toBe(false);
    expect(canShareHashtags(undefined)).toBe(false);
  });

  it("Web Share API でハッシュタグ本文だけを渡す", async () => {
    const share = vi.fn(async (_data: ShareData) => {});
    const copyText = vi.fn(async () => true);
    const outcome = await shareHashtags({
      navigator: { share, canShare: () => true },
      copyText,
    });
    expect(outcome).toBe("shared");
    expect(share).toHaveBeenCalledWith(APP_SHARE_DATA);
    const payload = share.mock.calls[0]?.[0];
    expect(payload).toEqual({ text: SHARE_TEXT });
    expect(payload).not.toHaveProperty("url");
    expect(payload).not.toHaveProperty("title");
    expect(copyText).not.toHaveBeenCalled();
  });

  it("ユーザーが共有シートを閉じたらコピーしない", async () => {
    const copyText = vi.fn(async () => true);
    const outcome = await shareHashtags({
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

  it("Web Share が無い環境ではハッシュタグ本文をコピーする", async () => {
    const copyText = vi.fn(async () => true);
    const outcome = await shareHashtags({ copyText });
    expect(outcome).toBe("copied");
    expect(copyText).toHaveBeenCalledWith(SHARE_TEXT);
    expect(copyText).not.toHaveBeenCalledWith(expect.stringMatching(/https?:\/\//));
  });

  it("共有もコピーもできなければ unsupported", async () => {
    const outcome = await shareHashtags({
      navigator: { share: async () => {}, canShare: () => false },
      copyText: async () => false,
    });
    expect(outcome).toBe("unsupported");
  });

  it("クリップボードへ書いたら true", async () => {
    const writeText = vi.fn(async () => {});
    expect(await copyTextToClipboard(SHARE_TEXT, { writeText })).toBe(true);
    expect(writeText).toHaveBeenCalledWith(SHARE_TEXT);
    expect(await copyTextToClipboard(SHARE_TEXT)).toBe(false);
  });
});
