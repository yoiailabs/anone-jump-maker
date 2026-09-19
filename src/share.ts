/** 画面のコピー案内に出すハッシュタグ。 */
export const SHARE_HASHTAG = "#あのねジャンプ";

/** メーカー名のハッシュタグ。コピー本文に足す。 */
export const SHARE_MAKER_HASHTAG = "#あのねジャンプメーカー";

/** ハッシュタグをコピー／アプリ共有するときに渡す本文。 */
export const SHARE_TEXT = `${SHARE_HASHTAG} ${SHARE_MAKER_HASHTAG}`;

/** Web Share に渡すデータ。ハッシュタグ本文のみ（URL は付けない）。 */
export const APP_SHARE_DATA: ShareData = {
  text: SHARE_TEXT,
};

export type ShareNavigatorLike = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

/** shared: Web Share / copied: クリップボード / cancelled: ユーザーが閉じた */
export type AppShareOutcome = "shared" | "copied" | "cancelled" | "unsupported";

/** ハッシュタグ本文を Web Share API で出せるか。 */
export function canShareHashtags(
  nav: ShareNavigatorLike | undefined,
  data: ShareData = APP_SHARE_DATA,
): boolean {
  if (!nav?.share) return false;
  if (!nav.canShare) return true;
  try {
    return nav.canShare(data);
  } catch {
    return false;
  }
}

/**
 * ハッシュタグ本文だけを共有する。Web Share が使える端末はシートを開き、
 * 使えない（多くの PC ブラウザ）ときは同じ本文をクリップボードへコピーする。
 */
export async function shareHashtags(options: {
  navigator?: ShareNavigatorLike;
  copyText?: (text: string) => Promise<boolean>;
  text?: string;
}): Promise<AppShareOutcome> {
  const nav = options.navigator;
  const text = options.text ?? SHARE_TEXT;
  const data: ShareData = { text };
  if (canShareHashtags(nav, data)) {
    try {
      await nav?.share?.(data);
      return "shared";
    } catch (error) {
      if (isAbort(error)) return "cancelled";
    }
  }
  if (options.copyText && (await options.copyText(text))) {
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
