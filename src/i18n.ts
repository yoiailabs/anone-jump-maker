import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NATIVE_NAMES,
  MESSAGES,
  PREFIXED_LOCALES,
  type Locale,
  type MessageKey,
  type PrefixedLocale,
} from "./messages.ts";

export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NATIVE_NAMES,
  OG_LOCALE,
  PREFIXED_LOCALES,
  TWITTER_DATA_LANG,
  type Locale,
  type MessageKey,
  type PrefixedLocale,
} from "./messages.ts";

export const LOCALE_COOKIE = "anone-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type AppView = "maker" | "studio" | "community" | "privacy" | "terms";

export type AppPath = {
  locale: Locale;
  view: AppView;
  /** URL に /en などのプレフィックスがある（手動選択・共有リンク）。 */
  prefixed: boolean;
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

export function isPrefixedLocale(value: string | undefined): value is PrefixedLocale {
  return value != null && (PREFIXED_LOCALES as readonly string[]).includes(value);
}

export function normalizePathname(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] ?? pathname;
  return path.replace(/\/+$/, "") || "/";
}

const UNPREFIXED_VIEWS: Record<string, AppView> = {
  "/": "maker",
  "/make": "studio",
  "/community": "community",
  "/privacy": "privacy",
  "/terms": "terms",
};

export function parseAppPath(pathname: string): AppPath | null {
  const path = normalizePathname(pathname);
  const unprefixed = UNPREFIXED_VIEWS[path];
  if (unprefixed) return { locale: DEFAULT_LOCALE, view: unprefixed, prefixed: false };

  const parts = path.slice(1).split("/");
  const first = parts[0];
  if (!isLocale(first)) return null;
  if (parts.length === 1) return { locale: first, view: "maker", prefixed: true };
  const segment = parts[1];
  if (parts.length === 2 && segment === "make") {
    return { locale: first, view: "studio", prefixed: true };
  }
  if (parts.length === 2 && (segment === "community" || segment === "privacy" || segment === "terms")) {
    return { locale: first, view: segment, prefixed: true };
  }
  return null;
}

/** 利用規約とプライバシーポリシーは日本語ページだけ。 */
export function isJapaneseOnlyView(view: AppView): boolean {
  return view === "privacy" || view === "terms";
}

export function pathForApp(locale: Locale, view: AppView): string {
  if (isJapaneseOnlyView(view)) return `/${view}`;
  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  if (view === "maker") return prefix || "/";
  if (view === "studio") return `${prefix}/make`;
  return `${prefix}/${view}`;
}

export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let text = MESSAGES[locale][key];
  if (!vars) return text;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

/** 動画内クレジット。日本語は「あのね」。英語・韓国語・中国語は英語のクレジット曲名。 */
export function songCreditLine(locale: Locale = DEFAULT_LOCALE): string {
  return `♪ ${t(locale, "songTitle")} - ${t(locale, "artistName")}`;
}

export function localeCookieHeader(locale: Locale, secure: boolean): string {
  const parts = [
    `${LOCALE_COOKIE}=${locale}`,
    "Path=/",
    `Max-Age=${LOCALE_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function localeFromCookieHeader(cookieHeader: string | null | undefined): Locale | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName !== LOCALE_COOKIE) continue;
    const value = rest.join("=").trim();
    if (isLocale(value)) return value;
  }
  return null;
}

/** `en-US` / `zh-Hans` / `ja` を対応ロケールへ。未知は null。 */
export function matchLocaleTag(tag: string): Locale | null {
  const base = tag.trim().toLowerCase().split("-")[0];
  return isLocale(base) ? base : null;
}

export function localeFromLanguageTags(tags: readonly string[]): Locale | null {
  for (const tag of tags) {
    const locale = matchLocaleTag(tag);
    if (locale) return locale;
  }
  return null;
}

type AcceptItem = { tag: string; q: number };

export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header?.trim()) return null;
  const items: AcceptItem[] = [];
  for (const raw of header.split(",")) {
    const [tagPart, ...params] = raw.trim().split(";");
    const tag = tagPart?.trim();
    if (!tag) continue;
    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split("=");
      if (key?.trim() === "q") {
        const parsed = Number(value);
        q = Number.isFinite(parsed) ? parsed : 0;
      }
    }
    items.push({ tag, q });
  }
  items.sort((a, b) => b.q - a.q);
  return localeFromLanguageTags(items.map((item) => item.tag));
}

export function preferredLocale(
  cookieHeader: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  return localeFromCookieHeader(cookieHeader) ?? localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

export type LocaleRedirectOptions = {
  /**
   * Accept-Language で寄せるか。ブラウザの JS は true。
   * Worker は false：未知の OGP クローラ（汎用 Chrome UA 含む）が
   * `https://anone.yoiailabs.com/` の日本語 title / OGP を掴めるようにする。
   */
  acceptLanguageRedirect?: boolean;
};

/**
 * プレフィックスなしの `/` `/community` をブラウザ言語または Cookie で寄せる。
 * `/privacy` `/terms` は日本語固定で、言語では寄せない。
 * `/ja` はデフォルト言語の正規 URL へ戻す。既に正しい場所なら null。
 * 検索・SNS クローラは言語リダイレクトせず、hreflang で各言語を辿れるようにする。
 */
export function localeRedirectLocation(
  pathname: string,
  search: string,
  cookieHeader: string | null | undefined,
  acceptLanguage: string | null | undefined,
  userAgent?: string | null,
  options?: LocaleRedirectOptions,
): string | null {
  const parsed = parseAppPath(pathname);
  if (!parsed) return null;
  const current = `${normalizePathname(pathname)}${search}`;
  if (parsed.prefixed && parsed.locale === DEFAULT_LOCALE) {
    const next = `${pathForApp(DEFAULT_LOCALE, parsed.view)}${search}`;
    return next === current ? null : next;
  }
  if (parsed.prefixed) return null;
  if (isDocumentCrawler(userAgent)) return null;
  const preferred =
    options?.acceptLanguageRedirect === false
      ? (localeFromCookieHeader(cookieHeader) ?? DEFAULT_LOCALE)
      : preferredLocale(cookieHeader, acceptLanguage);
  if (preferred === DEFAULT_LOCALE) return null;
  const next = `${pathForApp(preferred, parsed.view)}${search}`;
  return next === current ? null : next;
}

/**
 * 検索・OGP クローラ。`/` を言語リダイレクトすると日本語の正規 URL と
 * title / description / OGP を拾えない。
 */
export function isDocumentCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return DOCUMENT_CRAWLER_RE.test(userAgent);
}

const DOCUMENT_CRAWLER_RE =
  /Googlebot|Google-InspectionTool|GoogleOther|Google-Extended|Storebot-Google|AdsBot-Google|APIs-Google|Mediapartners-Google|Google-Read-Aloud|bingbot|BingPreview|msnbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Yeti\/|facebookexternalhit|Facebot|FacebookBot|meta-externalagent|meta-externalfetcher|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|WhatsApp|Applebot|PetalBot|Bytespider|ia_archiver|Pinterestbot|redditbot|Embedly|Iframely|Hatena|LineBot|\bLine\//i;

export function languageNavHtml(locale: Locale, view: AppView): string {
  const links = LOCALES.map((item) => {
    const href = pathForApp(item, view);
    const current = item === locale ? ' aria-current="page"' : "";
    return `<a href="${href}" lang="${item}" hreflang="${item}" data-locale="${item}"${current}>${LOCALE_NATIVE_NAMES[item]}</a>`;
  }).join("");
  return `<nav class="lang-switch" aria-label="${t(locale, "langNavAria")}">${links}</nav>`;
}

const JA_ERROR_KEYS: Record<string, MessageKey> = {
  [MESSAGES.ja.errorImageLoad]: "errorImageLoad",
  [MESSAGES.ja.errorHeic]: "errorHeic",
  [MESSAGES.ja.errorTemplateDecode]: "errorTemplateDecode",
  [MESSAGES.ja.errorTemplateFrameMissing]: "errorTemplateFrameMissing",
  [MESSAGES.ja.errorTemplateFrameFrozen]: "errorTemplateFrameFrozen",
  [MESSAGES.ja.errorUnsupportedExport]: "errorUnsupportedExport",
  [MESSAGES.ja.errorCanvas2d]: "errorCanvas2d",
  [MESSAGES.ja.errorExportBuffer]: "errorExportBuffer",
  [MESSAGES.ja.errorShrink]: "errorShrink",
  [MESSAGES.ja.errorThumb]: "errorThumb",
  [MESSAGES.ja.statusCutsFailed]: "statusCutsFailed",
  [MESSAGES.ja.statusCutsMissing]: "statusCutsMissing",
  [MESSAGES.ja.statusTemplateLoadFailed]: "statusTemplateLoadFailed",
};

const TEMPLATE_LOAD_CODE = /^テンプレ動画を読み込めませんでした \((\d+)\)$/;

export function messageFromError(locale: Locale, error: unknown, fallback: MessageKey): string {
  const raw = error instanceof Error ? error.message : "";
  const coded = TEMPLATE_LOAD_CODE.exec(raw);
  if (coded?.[1]) return t(locale, "statusTemplateLoadFailedCode", { code: coded[1] });
  const key = JA_ERROR_KEYS[raw];
  if (key) return t(locale, key);
  if (raw) return raw;
  return t(locale, fallback);
}
