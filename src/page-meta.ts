import {
  DEFAULT_LOCALE,
  OG_LOCALE,
  isJapaneseOnlyView,
  parseAppPath,
  pathForApp,
  t,
  type AppView,
  type Locale,
  type MessageKey,
} from "./i18n.ts";

/** 本番の正規オリジン。プレビュー URL ではなく OGP に載せる。 */
export const APP_ORIGIN = "https://anone.yoiailabs.com";
export const COMMUNITY_PATH = "/community";
export const OG_IMAGE_URL = `${APP_ORIGIN}/official-assets/og.png`;

export const MAKER_DOCUMENT_TITLE = t("ja", "makerTitle");
export const MAKER_DESCRIPTION = t("ja", "metaMakerDescription");
export const COMMUNITY_DOCUMENT_TITLE = t("ja", "communityTitle");
export const COMMUNITY_DESCRIPTION = t("ja", "metaCommunityDescription");

export type PageMeta = {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt: string;
  siteName: string;
  lang: Locale;
  ogLocale: string;
  view: AppView;
};

export function pageUrl(locale: Locale, view: AppView): string {
  const path = pathForApp(locale, view);
  return path === "/" ? `${APP_ORIGIN}/` : `${APP_ORIGIN}${path}`;
}

export function ogImageUrl(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? OG_IMAGE_URL : `${APP_ORIGIN}/official-assets/og-${locale}.png`;
}

const VIEW_COPY: Record<AppView, { title: MessageKey; description: MessageKey }> = {
  maker: { title: "makerTitle", description: "metaMakerDescription" },
  studio: { title: "studioTitle", description: "metaMakerDescription" },
  community: { title: "communityTitle", description: "metaCommunityDescription" },
  privacy: { title: "privacyTitle", description: "metaPrivacyDescription" },
  terms: { title: "termsTitle", description: "metaTermsDescription" },
};

export function pageMeta(locale: Locale, view: AppView): PageMeta {
  const lang = isJapaneseOnlyView(view) ? DEFAULT_LOCALE : locale;
  const siteName = t(lang, "makerTitle");
  const copy = VIEW_COPY[view];
  return {
    title: t(lang, copy.title),
    description: t(lang, copy.description),
    url: pageUrl(lang, view),
    image: ogImageUrl(lang),
    imageAlt: siteName,
    siteName,
    lang,
    ogLocale: OG_LOCALE[lang],
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
