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

/** shared: シートを完了 / cancelled: ユーザーが閉じた / unsupported: 使えないか失敗 */
export type FileShareOutcome = "shared" | "cancelled" | "unsupported";

/** 書き出し Blob を、ファイル名と MIME を保った File にする。 */
export function videoFileForShare(blob: Blob, filename: string, mime?: string): File {
  return new File([blob], filename, { type: videoShareType(mime, blob.type) });
}

/**
 * ファイル付き Web Share が使えるか。`canShare({ files })` が無い、または false なら使わない。
 * ハッシュタグ本文だけの共有とは別で、UA では判定しない。
 */
export function canShareFiles(nav: ShareNavigatorLike | undefined, files: readonly File[]): boolean {
  if (!nav?.share || !nav.canShare || files.length === 0) return false;
  try {
    return nav.canShare({ files: [...files] });
  } catch {
    return false;
  }
}

/**
 * 生成動画をファイルとして共有する。
 * `canShare({ files })` が通ったときだけ `share` する。
 * ハッシュタグ本文を足しても `canShare` が通るときだけ text を付け、通らなければファイルだけ渡す。
 */
export async function shareVideoFile(options: {
  blob: Blob;
  filename: string;
  mime?: string;
  text?: string;
  navigator?: ShareNavigatorLike;
}): Promise<FileShareOutcome> {
  const nav = options.navigator;
  if (!nav?.share || !nav.canShare) return "unsupported";
  const file = videoFileForShare(options.blob, options.filename, options.mime);
  const files = [file];
  let filesOk = false;
  try {
    filesOk = nav.canShare({ files });
  } catch {
    return "unsupported";
  }
  if (!filesOk) return "unsupported";

  const text = options.text ?? SHARE_TEXT;
  let data: ShareData = { files };
  if (text) {
    try {
      if (nav.canShare({ files, text })) data = { files, text };
    } catch {
      data = { files };
    }
  }

  try {
    await nav.share(data);
    return "shared";
  } catch (error) {
    if (isAbort(error)) return "cancelled";
    return "unsupported";
  }
}

/** コピー出し分け専用。共有の可否は `canShare` で見る。 */
export function isXInAppBrowser(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return /Twitter/i.test(userAgent);
}

function videoShareType(mime: string | undefined, blobType: string): string {
  const fromMime = mime?.split(";")[0]?.trim();
  if (fromMime) return fromMime;
  const fromBlob = blobType.split(";")[0]?.trim();
  if (fromBlob) return fromBlob;
  return "video/mp4";
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
