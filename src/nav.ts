import {
  DEFAULT_LOCALE,
  parseAppPath,
  pathForApp,
  t,
  type AppView,
  type Locale,
} from "./i18n.ts";
export const APP_VIEWS = ["home", "maker", "privacy", "terms"] as const;
export function pathForView(
  view: AppView,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return pathForApp(locale, view);
}
export function documentTitleForView(
  view: AppView,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return t(
    view === "privacy" || view === "terms" ? "ja" : locale,
    view === "privacy"
      ? "privacyTitle"
      : view === "terms"
        ? "termsTitle"
        : "makerTitle",
  );
}
/** Retired gallery URLs resolve to the matching home, including old hash links. */
export function legacyHome(pathname: string): string | null {
  const match = /^\/(?:(ja|en|ko|zh)\/)?community\/?$/.exec(pathname);
  return match ? pathForApp((match[1] ?? "ja") as Locale, "home") : null;
}
export function parseAppView(pathname: string): AppView {
  return parseAppPath(pathname)?.view ?? "home";
}
