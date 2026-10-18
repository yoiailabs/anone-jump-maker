import {
  DEFAULT_LOCALE,
  parseAppPath,
  pathForApp,
  t,
  type AppView,
  type AppPath,
  type Locale,
} from "./i18n.ts";

export type { AppView, AppPath, Locale };

export const MAKER_DOCUMENT_TITLE = t("ja", "makerTitle");

export function pathForView(view: AppView, locale: Locale = DEFAULT_LOCALE): string {
  return pathForApp(locale, view);
}

export function parseAppLocation(input: string | Pick<Location, "pathname" | "hash">): AppPath {
  if (typeof input === "string") {
    if (input.startsWith("/")) {
      const path = input.split(/[?#]/, 1)[0] ?? input;
      return parseAppPath(path) ?? { locale: DEFAULT_LOCALE, view: "maker", prefixed: false };
    }
    return { locale: DEFAULT_LOCALE, view: "maker", prefixed: false };
  }
  return (
    parseAppPath(input.pathname) ?? {
      locale: DEFAULT_LOCALE,
      view: "maker" as const,
      prefixed: false,
    }
  );
}

export function parseAppView(input: string | Pick<Location, "pathname" | "hash">): AppView {
  return parseAppLocation(input).view;
}

export function documentTitleForView(view: AppView, locale: Locale = DEFAULT_LOCALE): string {
  if (view === "studio") return t(locale, "studioTitle");
  if (view === "privacy") return t(DEFAULT_LOCALE, "privacyTitle");
  if (view === "terms") return t(DEFAULT_LOCALE, "termsTitle");
  return t(locale, "makerTitle");
}

/** 古い `#maker`、末尾スラッシュ、`/ja` を実パスへ寄せる。既に正規なら null。 */
export function canonicalAppUrl(loc: Pick<Location, "pathname" | "search" | "hash">): string | null {
  const parsed = parseAppLocation(loc);
  const next = `${pathForApp(parsed.locale, parsed.view)}${loc.search}`;
  const current = `${loc.pathname}${loc.search}${loc.hash}`;
  return current === next ? null : next;
}

export function appPathFromClick(
  anchor: Pick<HTMLAnchorElement, "href" | "target">,
  origin: string,
): AppPath | null {
  if (anchor.target && anchor.target !== "_self") return null;
  let url: URL;
  try {
    url = new URL(anchor.href, origin);
  } catch {
    return null;
  }
  if (url.origin !== new URL(origin).origin) return null;
  return parseAppPath(url.pathname);
}

export function appViewFromClick(
  anchor: Pick<HTMLAnchorElement, "href" | "target">,
  origin: string,
): AppView | null {
  return appPathFromClick(anchor, origin)?.view ?? null;
}
