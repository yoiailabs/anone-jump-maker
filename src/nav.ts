import {
  DEFAULT_LOCALE,
  parseAppPath,
  pathForApp,
  t,
  type AppView,
  type AppPath,
  type Locale,
} from "./i18n.ts";
import { COMMUNITY_PATH } from "./page-meta.ts";

/** メーカー本体とコミュニティページ。パスで切り替える。 */
export const APP_VIEWS = ["maker", "community"] as const;
export type { AppView, AppPath, Locale };

export { COMMUNITY_PATH };
export const MAKER_DOCUMENT_TITLE = t("ja", "makerTitle");
export const TO_COMMUNITY_LABEL = t("ja", "communityToCommunity");
export const TO_MAKER_LABEL = t("ja", "communityBack");

export function pathForView(view: AppView, locale: Locale = DEFAULT_LOCALE): string {
  return pathForApp(locale, view);
}

export function parseHashView(hash: string): AppView {
  const raw = hash.trim().replace(/^#\/?/, "");
  return raw === "community" ? "community" : "maker";
}

export function parseAppLocation(
  input: string | Pick<Location, "pathname" | "hash">,
): AppPath {
  if (typeof input === "string") {
    if (input.startsWith("/")) {
      const path = input.split(/[?#]/, 1)[0] ?? input;
      return parseAppPath(path) ?? { locale: DEFAULT_LOCALE, view: "maker", prefixed: false };
    }
    return { locale: DEFAULT_LOCALE, view: parseHashView(input), prefixed: false };
  }
  const fromPath = parseAppPath(input.pathname) ?? {
    locale: DEFAULT_LOCALE,
    view: "maker" as const,
    prefixed: false,
  };
  if (fromPath.view === "community") return fromPath;
  if (parseHashView(input.hash) === "community") return { ...fromPath, view: "community" };
  return fromPath;
}

export function parseAppView(input: string | Pick<Location, "pathname" | "hash">): AppView {
  return parseAppLocation(input).view;
}

export function documentTitleForView(view: AppView, locale: Locale = DEFAULT_LOCALE): string {
  return view === "community" ? t(locale, "communityTitle") : t(locale, "makerTitle");
}

/** 古い `#community` / `#maker`、末尾スラッシュ、`/ja` を実パスへ寄せる。既に正規なら null。 */
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
  const parsed = parseAppPath(url.pathname);
  if (!parsed) return null;
  if (parseHashView(url.hash) === "community") return { ...parsed, view: "community" };
  return parsed;
}

export function appViewFromClick(
  anchor: Pick<HTMLAnchorElement, "href" | "target">,
  origin: string,
): AppView | null {
  return appPathFromClick(anchor, origin)?.view ?? null;
}

export function toCommunityLinkHtml(locale: Locale = DEFAULT_LOCALE): string {
  return `<p class="hero-more"><a id="toCommunity" class="btn" href="${pathForApp(locale, "community")}">${t(locale, "communityToCommunity")}</a></p>`;
}

export function toMakerLinkHtml(id = "toMaker", locale: Locale = DEFAULT_LOCALE): string {
  return `<p class="community-back-wrap"><a id="${id}" class="page-link" href="${pathForApp(locale, "maker")}">${t(locale, "communityBack")}</a></p>`;
}
