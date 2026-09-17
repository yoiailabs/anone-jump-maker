/** 画面の投稿ボタンに出すハッシュタグ。 */
export const SHARE_HASHTAG = "#あのねジャンプ";

/** メーカー名のハッシュタグ。投稿本文に足す。 */
export const SHARE_MAKER_HASHTAG = "#あのねジャンプメーカー";

/** X の投稿／共有シートに渡す本文。 */
export const SHARE_TEXT = `${SHARE_HASHTAG} ${SHARE_MAKER_HASHTAG}`;

/** アプリ本体の共有 URL。プレビュー URL ではなく本番を渡す。 */
export const APP_SHARE_URL = "https://anone.yoiailabs.com";

export const APP_SHARE_TITLE = "あのねジャンプメーカー";

export const APP_SHARE_DATA: ShareData = {
  title: APP_SHARE_TITLE,
  url: APP_SHARE_URL,
};

/** X の投稿画面（intent）。twitter.com/intent/tweet も同じ画面へ転送される。 */
const X_INTENT_ENDPOINT = "https://x.com/intent/post";

/**
 * X アプリのネイティブ投稿画面。非公式のスキームだが、`x.com/intent/post` を渡すと
 * アプリは投稿画面ではなく内蔵ブラウザで開いてしまうので、スマホではこちらを叩く。
 */
const X_APP_COMPOSE_ENDPOINT = "twitter://post";

/** Android の X アプリ。assetlinks.json でも `com.twitter.android`。 */
const X_ANDROID_PACKAGE = "com.twitter.android";

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

/** shared: Web Share / copied: クリップボード / cancelled: ユーザーが閉じた */
export type AppShareOutcome = "shared" | "copied" | "cancelled" | "unsupported";

export function buildXIntentUrl(text: string = SHARE_TEXT): string {
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

/** アプリの投稿画面の開き方が違うので、スマホは OS まで見分ける。other は UA から分からない端末。 */
export type MobilePlatform = "ios" | "android" | "other";

export function mobilePlatform(platform: PlatformLike | undefined): MobilePlatform | null {
  if (!platform) return null;
  const ua = platform.userAgent ?? "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPod|iPad/i.test(ua)) return "ios";
  // iPadOS の Safari は Macintosh を名乗るので、タッチの有無で見分ける。
  if (/Macintosh/i.test(ua) && (platform.maxTouchPoints ?? 0) > 1) return "ios";
  return platform.userAgentData?.mobile === true ? "other" : null;
}

/** X アプリのネイティブ投稿画面（iOS はこの URL に遷移させる）。 */
export function buildXAppComposeUrl(text: string = SHARE_TEXT): string {
  return `${X_APP_COMPOSE_ENDPOINT}?message=${encodeURIComponent(text)}`;
}

/**
 * Android の intent URI。X アプリの共有（ACTION_SEND / text/plain）に直接渡すとネイティブの
 * 投稿画面が開く。アプリが無ければブラウザが `S.browser_fallback_url` の投稿画面へ落とす。
 */
export function buildXAndroidComposeUrl(
  text: string = SHARE_TEXT,
  fallbackUrl: string = buildXIntentUrl(text),
): string {
  return [
    "intent:#Intent",
    "action=android.intent.action.SEND",
    "type=text/plain",
    `package=${X_ANDROID_PACKAGE}`,
    `S.android.intent.extra.TEXT=${encodeURIComponent(text)}`,
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)}`,
    "end",
  ].join(";");
}

/**
 * 投稿ボタンのリンク先。
 * Android はブラウザが intent URI を解決してアプリの投稿画面を開く（無ければ Web に落ちる）ので
 * リンクだけで完結する。iOS には同じ仕掛けが無いので、リンク自体は Web の投稿画面にしておき、
 * 1 回目のタップだけ `buildXAppComposeUrl` で上書きする（`shouldOpenXApp`）。
 */
export function xComposeLinkAttrs(options: {
  platform: MobilePlatform | null;
  text?: string;
}): ComposeLinkAttrs {
  const webUrl = buildXIntentUrl(options.text);
  if (options.platform === null) {
    return { href: webUrl, target: "_blank", rel: "noopener noreferrer" };
  }
  const href =
    options.platform === "android" ? buildXAndroidComposeUrl(options.text, webUrl) : webUrl;
  return { href, target: null, rel: null };
}

/** アプリを叩いたことを忘れるまでの時間。これを過ぎたタップは、また 1 回目として扱う。 */
export const X_APP_RETRY_WINDOW_MS = 30_000;

/**
 * iOS のタップで、アプリのスキームを叩くか Web の投稿画面（リンクの遷移）に回すか。
 *
 * スキームには「開けなかった」の通知が無い。時間で見切って Web に落とすと、アプリが前に出るのが
 * 間に合わなかったときに投稿画面の上へ内蔵ブラウザが重なってしまうので、待たずにユーザーの
 * 2 回目のタップを合図にする。叩いた直後（30 秒以内）にまだこの画面に居るなら、アプリは
 * 出てこなかったとみなして Web に回す。時間が空いたタップは、また 1 回目として扱う。
 */
export function shouldOpenXApp(
  lastTryAt: number | null,
  now: number,
  windowMs: number = X_APP_RETRY_WINDOW_MS,
): boolean {
  if (lastTryAt === null) return true;
  return now - lastTryAt > windowMs;
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
  const text = options.text ?? SHARE_TEXT;
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
