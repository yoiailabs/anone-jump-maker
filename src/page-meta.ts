import { parseAppPath, pathForApp, t, type AppView, type Locale } from "./i18n.ts";

/** 本番の正規オリジン。プレビュー URL ではなく OGP に載せる。 */
export const APP_ORIGIN = "https://anone.yoiailabs.com";
export const COMMUNITY_PATH = "/community";
export const OG_IMAGE_URL = `${APP_ORIGIN}/og.png`;

export const MAKER_DOCUMENT_TITLE = t("ja", "makerTitle");
export const MAKER_DESCRIPTION = t("ja", "metaMakerDescription");
export const COMMUNITY_DOCUMENT_TITLE = t("ja", "communityTitle");
export const COMMUNITY_DESCRIPTION = t("ja", "metaCommunityDescription");

export type PageMeta = {
  title: string;
  description: string;
  url: string;
  image: string;
  lang: Locale;
  ogLocale: string;
  view: AppView;
};

const OG_LOCALE: Record<Locale, string> = {
  ja: "ja_JP",
  en: "en_US",
  ko: "ko_KR",
  zh: "zh_CN",
};

export function pageUrl(locale: Locale, view: AppView): string {
  const path = pathForApp(locale, view);
  return path === "/" ? `${APP_ORIGIN}/` : `${APP_ORIGIN}${path}`;
}

export function pageMeta(locale: Locale, view: AppView): PageMeta {
  return {
    title: view === "community" ? t(locale, "communityTitle") : t(locale, "makerTitle"),
    description: t(locale, view === "community" ? "metaCommunityDescription" : "metaMakerDescription"),
    url: pageUrl(locale, view),
    image: OG_IMAGE_URL,
    lang: locale,
    ogLocale: OG_LOCALE[locale],
    view,
  };
}

export const MAKER_PAGE_META: PageMeta = pageMeta("ja", "maker");
export const COMMUNITY_PAGE_META: PageMeta = pageMeta("ja", "community");

export function isCommunityPath(pathname: string): boolean {
  return parseAppPath(pathname)?.view === "community";
}

/** メーカー HTML の title / description / OGP をコミュニティ用に差し替える。 */
export function rewriteHtmlPageMeta(html: string, meta: PageMeta = COMMUNITY_PAGE_META): string {
  const title = escapeHtml(meta.title);
  const description = escapeAttr(meta.description);
  const url = escapeAttr(meta.url);
  const image = escapeAttr(meta.image);
  let out = html.replace(/<html\b([^>]*)\blang="[^"]*"/, `<html$1lang="${meta.lang}"`);
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
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
