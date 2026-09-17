import { describe, expect, it, vi } from "vitest";
import {
  buildXIntentUrl,
  canShareVideoFile,
  openExternalTab,
  SHARE_HASHTAG,
  shareJumpVideo,
  toShareFile,
  type ShareNavigatorLike,
} from "./share.ts";

const videoFile = () => toShareFile(new Blob(["x"], { type: "video/mp4" }), "anone-jump-9x16.mp4");

describe("X への投稿", () => {
  it("投稿画面にハッシュタグを載せる", () => {
    const url = new URL(buildXIntentUrl());
    expect(url.origin + url.pathname).toBe("https://x.com/intent/post");
    expect(url.searchParams.get("text")).toBe(SHARE_HASHTAG);
    expect(buildXIntentUrl()).toContain(encodeURIComponent(SHARE_HASHTAG));
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
    expect(share).toHaveBeenCalledWith({ files: [file], text: SHARE_HASHTAG });
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

  it("保存した動画の名前と MIME をそのまま持たせる", () => {
    const file = toShareFile(new Blob(["x"], { type: "video/webm" }), "anone-zoom-16x9.webm");
    expect(file?.name).toBe("anone-zoom-16x9.webm");
    expect(file?.type).toBe("video/webm");
  });
});
