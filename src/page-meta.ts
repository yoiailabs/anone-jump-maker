/** 本番の正規オリジン。プレビュー URL ではなく OGP に載せる。 */
export const APP_ORIGIN = "https://anone.yoiailabs.com";
export const COMMUNITY_PATH = "/community";
export const OG_IMAGE_URL = `${APP_ORIGIN}/og.png`;

export const MAKER_DOCUMENT_TITLE = "あのねジャンプメーカー";
export const COMMUNITY_DOCUMENT_TITLE = "みんなの #あのねジャンプ";
export const COMMUNITY_DESCRIPTION =
  "ファンが投稿したジャンプ動画です。下にスクロールして見てね。";

export type PageMeta = {
  title: string;
  description: string;
  url: string;
  image: string;
};

export const COMMUNITY_PAGE_META: PageMeta = {
  title: COMMUNITY_DOCUMENT_TITLE,
  description: COMMUNITY_DESCRIPTION,
  url: `${APP_ORIGIN}${COMMUNITY_PATH}`,
  image: OG_IMAGE_URL,
};

export function isCommunityPath(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0] ?? pathname;
  const trimmed = path.replace(/\/+$/, "") || "/";
  return trimmed === COMMUNITY_PATH;
}

/** index.html の title / description / OGP をコミュニティ用に差し替える。 */
export function rewriteHtmlPageMeta(html: string, meta: PageMeta = COMMUNITY_PAGE_META): string {
  const title = escapeHtml(meta.title);
  const description = escapeAttr(meta.description);
  const url = escapeAttr(meta.url);
  const image = escapeAttr(meta.image);
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  out = replaceMeta(out, "name", "description", description);
  out = replaceMeta(out, "property", "og:title", title);
  out = replaceMeta(out, "property", "og:description", description);
  out = replaceMeta(out, "property", "og:url", url);
  out = replaceMeta(out, "property", "og:image", image);
  out = replaceMeta(out, "name", "twitter:image", image);
  return out;
}

function replaceMeta(html: string, kind: "name" | "property", key: string, content: string): string {
  const re = new RegExp(`(<meta\\s[^>]*\\b${kind}="${key}"[^>]*\\bcontent=")[^"]*(")`, "i");
  if (!re.test(html)) {
    throw new Error(`missing meta ${kind}="${key}"`);
  }
  re.lastIndex = 0;
  return html.replace(re, `$1${content}$2`);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
