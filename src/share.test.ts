import { describe, expect, it, vi } from "vitest";
import {
  APP_SHARE_DATA,
  canShareFiles,
  canShareHashtags,
  copyTextToClipboard,
  isXInAppBrowser,
  SHARE_HASHTAG,
  SHARE_MAKER_HASHTAG,
  SHARE_TEXT,
  shareHashtags,
  shareVideoFile,
  videoFileForShare,
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

function abortError(): Error {
  return Object.assign(new Error("share canceled"), { name: "AbortError" });
}

describe("動画ファイルを共有する", () => {
  const blob = new Blob(["video"], { type: "video/webm" });
  const filename = "anone-jump-16x9.mp4";

  it("MIME を優先し、無ければ Blob の type、それも無ければ video/mp4", () => {
    const fromMime = videoFileForShare(blob, filename, "video/mp4");
    expect(fromMime.name).toBe(filename);
    expect(fromMime.type).toBe("video/mp4");
    expect(videoFileForShare(blob, filename).type).toBe("video/webm");
    expect(videoFileForShare(new Blob(["x"]), "clip.mp4").type).toBe("video/mp4");
    expect(videoFileForShare(blob, filename, "video/mp4;codecs=avc1").type).toBe("video/mp4");
  });

  it("canShare({ files }) が true のときだけファイル共有できる", () => {
    const file = videoFileForShare(blob, filename, "video/mp4");
    expect(canShareFiles(undefined, [file])).toBe(false);
    expect(canShareFiles({ share: async () => {} }, [file])).toBe(false);
    expect(canShareFiles({ share: async () => {}, canShare: () => true }, [])).toBe(false);
    const canShare = vi.fn((data: ShareData) => Boolean(data.files?.length));
    expect(canShareFiles({ share: async () => {}, canShare }, [file])).toBe(true);
    expect(canShare).toHaveBeenCalledWith({ files: [file] });
    expect(canShareFiles({ share: async () => {}, canShare: () => false }, [file])).toBe(false);
    expect(
      canShareFiles(
        {
          share: async () => {},
          canShare: () => {
            throw new Error("nope");
          },
        },
        [file],
      ),
    ).toBe(false);
  });

  it("ファイルとハッシュタグ本文の両方が通るときは両方渡す", async () => {
    const share = vi.fn(async (_data: ShareData) => {});
    const canShare = vi.fn((data: ShareData) => Boolean(data.files?.length));
    const outcome = await shareVideoFile({
      blob,
      filename,
      mime: "video/mp4",
      navigator: { share, canShare },
    });
    expect(outcome).toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0]?.[0];
    expect(payload?.text).toBe(SHARE_TEXT);
    expect(payload?.files).toHaveLength(1);
    expect(payload?.files?.[0]?.name).toBe(filename);
    expect(payload?.files?.[0]?.type).toBe("video/mp4");
    expect(payload).not.toHaveProperty("url");
    expect(payload).not.toHaveProperty("title");
  });

  it("本文付きが canShare で落ちたらファイルだけ渡す", async () => {
    const share = vi.fn(async (_data: ShareData) => {});
    const canShare = vi.fn((data: ShareData) => Boolean(data.files?.length) && data.text == null);
    const outcome = await shareVideoFile({
      blob,
      filename,
      mime: "video/mp4",
      navigator: { share, canShare },
    });
    expect(outcome).toBe("shared");
    const payload = share.mock.calls[0]?.[0];
    expect(payload).toEqual({ files: payload?.files });
    expect(payload?.text).toBeUndefined();
    expect(payload?.files?.[0]?.name).toBe(filename);
  });

  it("本文付きの canShare が例外でもファイルだけ共有する", async () => {
    const share = vi.fn(async (_data: ShareData) => {});
    const canShare = vi.fn((data: ShareData) => {
      if (data.text) throw new Error("text unsupported");
      return Boolean(data.files?.length);
    });
    const outcome = await shareVideoFile({
      blob,
      filename,
      navigator: { share, canShare },
    });
    expect(outcome).toBe("shared");
    expect(share.mock.calls[0]?.[0]?.text).toBeUndefined();
    expect(share.mock.calls[0]?.[0]?.files?.[0]?.type).toBe("video/webm");
  });

  it("ユーザーがシートを閉じたら cancelled で、ダウンロードへは進まない", async () => {
    const share = vi.fn(async () => {
      throw abortError();
    });
    const outcome = await shareVideoFile({
      blob,
      filename,
      mime: "video/mp4",
      navigator: { share, canShare: () => true },
    });
    expect(outcome).toBe("cancelled");
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("canShare がファイルを拒否したら share を呼ばない", async () => {
    const share = vi.fn(async () => {});
    const outcome = await shareVideoFile({
      blob,
      filename,
      navigator: { share, canShare: (data) => !data.files },
    });
    expect(outcome).toBe("unsupported");
    expect(share).not.toHaveBeenCalled();
  });

  it("share が Abort 以外で失敗したら unsupported", async () => {
    const outcome = await shareVideoFile({
      blob,
      filename,
      navigator: {
        share: async () => {
          throw new Error("share failed");
        },
        canShare: () => true,
      },
    });
    expect(outcome).toBe("unsupported");
  });

  it("X のアプリ内ブラウザはコピー出し分けだけに使う", () => {
    expect(isXInAppBrowser("Mozilla/5.0 Twitter for iPhone")).toBe(true);
    expect(isXInAppBrowser("Mozilla/5.0 (Linux) TwitterAndroid")).toBe(true);
    expect(isXInAppBrowser("Mozilla/5.0 (iPhone) Version/17.0 Mobile Safari/604.1")).toBe(false);
    expect(isXInAppBrowser(undefined)).toBe(false);
  });
});
