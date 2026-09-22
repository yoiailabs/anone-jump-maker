import {
  DEFAULT_LOCALE,
  OG_LOCALE,
  isJapaneseOnlyView,
  pathForApp,
  t,
  type AppView,
  type Locale,
  type MessageKey,
} from "./i18n.ts";

/** 本番の正規オリジン。プレビュー URL ではなく OGP に載せる。 */
export const APP_ORIGIN = "https://anone.yoiailabs.com";
export const OG_IMAGE_URL = `${APP_ORIGIN}/og.png`;

export const MAKER_DOCUMENT_TITLE = t("ja", "makerTitle");
export const MAKER_DESCRIPTION = t("ja", "metaMakerDescription");

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
  return locale === DEFAULT_LOCALE ? OG_IMAGE_URL : `${APP_ORIGIN}/og-${locale}.png`;
}

const VIEW_COPY: Record<AppView, { title: MessageKey; description: MessageKey }> = {
  maker: { title: "makerTitle", description: "metaMakerDescription" },
  home: { title: "makerTitle", description: "metaMakerDescription" },
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
