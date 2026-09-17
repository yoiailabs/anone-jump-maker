/** 投稿に付けてもらうハッシュタグ。 */
export const SHARE_HASHTAG = "#あのねジャンプ";

/** X の投稿画面（intent）。twitter.com/intent/tweet も同じ画面へ転送される。 */
const X_INTENT_ENDPOINT = "https://x.com/intent/post";

export type ShareNavigatorLike = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

/** 端末を見分けるために使う navigator の断片。 */
export type PlatformLike = {
  userAgent?: string;
  userAgentData?: { mobile?: boolean };
  maxTouchPoints?: number;
};

/** 投稿ボタン（`<a>`）に載せる属性。 */
export type ComposeLinkAttrs = {
  href: string;
  /** スマホでは付けない（別タブに出すと OS がアプリへ渡してくれない）。 */
  target: string | null;
  rel: string | null;
};

/** files: 動画ごと共有シートへ渡せた / intent: X の投稿画面だけ開いた / cancelled: ユーザーが閉じた */
export type ShareOutcome = "files" | "intent" | "cancelled" | "blocked";

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
 * スマホ・タブレットか。
 * `x.com/intent/post` は X アプリの universal link / app link に入っている（AASA の `/*`、除外は
 * `/intent/sessions` だけ）ので、同じタブへのふつうのリンク遷移なら OS がアプリの投稿画面を開く。
 * 逆に `window.open` や別タブからの遷移は iOS / Android がアプリに渡さず、ブラウザの X が出る。
 */
export function prefersAppHandoff(platform: PlatformLike | undefined): boolean {
  if (!platform) return false;
  if (platform.userAgentData?.mobile === true) return true;
  const ua = platform.userAgent ?? "";
  if (/Android|iPhone|iPod|iPad/i.test(ua)) return true;
  // iPadOS の Safari は Macintosh を名乗るので、タッチの有無で見分ける。
  return /Macintosh/i.test(ua) && (platform.maxTouchPoints ?? 0) > 1;
}

/** 投稿ボタンのリンク先。スマホは同じタブ（アプリに渡すため）、PC は別タブ。 */
export function xComposeLinkAttrs(options: {
  appHandoff: boolean;
  text?: string;
}): ComposeLinkAttrs {
  const href = buildXIntentUrl(options.text);
  return options.appHandoff
    ? { href, target: null, rel: null }
    : { href, target: "_blank", rel: "noopener noreferrer" };
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

/**
 * 共有シートを使えなかったときに、JS から投稿画面へ出す。
 * スマホは同じタブで遷移する。クリックから時間が経った `window.open` は塞がれるうえ、
 * 別タブに出すと X アプリではなくブラウザの X が開いてしまう。
 */
export function openXCompose(options: {
  url: string;
  appHandoff: boolean;
  navigate: (url: string) => void;
  openTab: (url: string) => boolean;
}): boolean {
  if (options.appHandoff) {
    options.navigate(options.url);
    return true;
  }
  return options.openTab(options.url);
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
