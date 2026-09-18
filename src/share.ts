/** 画面のコピー案内に出すハッシュタグ。 */
export const SHARE_HASHTAG = "#あのねジャンプ";

/** メーカー名のハッシュタグ。コピー本文に足す。 */
export const SHARE_MAKER_HASHTAG = "#あのねジャンプメーカー";

/** ハッシュタグをコピー／アプリ共有するときに渡す本文。 */
export const SHARE_TEXT = `${SHARE_HASHTAG} ${SHARE_MAKER_HASHTAG}`;

/** アプリ本体の共有 URL。プレビュー URL ではなく本番を渡す。 */
export const APP_SHARE_URL = "https://anone.yoiailabs.com";

export const APP_SHARE_TITLE = SHARE_TEXT;

export const APP_SHARE_DATA: ShareData = {
  title: APP_SHARE_TITLE,
  url: APP_SHARE_URL,
};

export type ShareNavigatorLike = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

/** shared: Web Share / copied: クリップボード / cancelled: ユーザーが閉じた */
export type AppShareOutcome = "shared" | "copied" | "cancelled" | "unsupported";

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

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
