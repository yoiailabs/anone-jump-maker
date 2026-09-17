/** 投稿に付けてもらうハッシュタグ。 */
export const SHARE_HASHTAG = "#あのねジャンプ";

/** アプリ本体の共有 URL。プレビュー URL ではなく本番を渡す。 */
export const APP_SHARE_URL = "https://anone.yoiailabs.com";

export const APP_SHARE_TITLE = "あのねジャンプメーカー";

export const APP_SHARE_DATA: ShareData = {
  title: APP_SHARE_TITLE,
  url: APP_SHARE_URL,
};

/** X の投稿画面（intent）。twitter.com/intent/tweet も同じ画面へ転送される。 */
const X_INTENT_ENDPOINT = "https://x.com/intent/post";

export type ShareNavigatorLike = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

/** files: 動画ごと共有シートへ渡せた / intent: X の投稿画面だけ開いた / cancelled: ユーザーが閉じた */
export type ShareOutcome = "files" | "intent" | "cancelled" | "blocked";

/** shared: Web Share / copied: クリップボード / cancelled: ユーザーが閉じた */
export type AppShareOutcome = "shared" | "copied" | "cancelled" | "unsupported";

export function buildXIntentUrl(text: string = SHARE_HASHTAG): string {
  return `${X_INTENT_ENDPOINT}?text=${encodeURIComponent(text)}`;
}

export function toShareFile(blob: Blob, filename: string): File | null {
  if (typeof File !== "function") return null;
  return new File([blob], filename, { type: blob.type || "video/mp4" });
}

/** 動画ファイルごと共有できるか（iOS / Android の共有シート）。 */
export function canShareVideoFile(file: File | null, nav: ShareNavigatorLike | undefined): boolean {
  if (!file || !nav?.share || !nav.canShare) return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * 保存した動画をハッシュタグ付きで X に出す。
 * 共有シートがファイルを受け取れる端末では動画ごと渡し、それ以外は投稿画面だけ開いて添付は手元でしてもらう。
 */
export async function shareJumpVideo(options: {
  file: File | null;
  text?: string;
  navigator?: ShareNavigatorLike;
  openUrl: (url: string) => boolean;
}): Promise<ShareOutcome> {
  const text = options.text ?? SHARE_HASHTAG;
  const { file, navigator: nav } = options;
  if (file && nav?.share && canShareVideoFile(file, nav)) {
    try {
      await nav.share({ files: [file], text });
      return "files";
    } catch (error) {
      if (isAbort(error)) return "cancelled";
    }
  }
  return options.openUrl(buildXIntentUrl(text)) ? "intent" : "blocked";
}

/** アプリ URL を Web Share API で出せるか。 */
export function canShareAppUrl(nav: ShareNavigatorLike | undefined): boolean {
  if (!nav?.share) return false;
  if (!nav.canShare) return true;
  try {
    return nav.canShare(APP_SHARE_DATA);
  } catch {
    return false;
  }
}

/**
 * このアプリの URL を共有する。Web Share が使える端末はシートを開き、
 * 使えない（多くの PC ブラウザ）ときは URL をクリップボードへコピーする。
 */
export async function shareAppUrl(options: {
  navigator?: ShareNavigatorLike;
  copyText?: (text: string) => Promise<boolean>;
}): Promise<AppShareOutcome> {
  const nav = options.navigator;
  if (canShareAppUrl(nav)) {
    try {
      await nav?.share?.(APP_SHARE_DATA);
      return "shared";
    } catch (error) {
      if (isAbort(error)) return "cancelled";
    }
  }
  if (options.copyText && (await options.copyText(APP_SHARE_URL))) {
    return "copied";
  }
  return "unsupported";
}

export async function copyTextToClipboard(
  text: string,
  clipboard?: Pick<Clipboard, "writeText">,
): Promise<boolean> {
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * 投稿画面を別タブで開く。`window.open` に `noopener` を渡すと開けても null が返り、
 * ブロックと見分けられなくなるので、開いてから opener を切る。
 */
export function openExternalTab(url: string, opener: Pick<Window, "open">): boolean {
  const tab = opener.open(url, "_blank");
  if (!tab) return false;
  try {
    tab.opener = null;
  } catch {
    /* 別オリジンで弾かれても、タブは開けている */
  }
  return true;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
