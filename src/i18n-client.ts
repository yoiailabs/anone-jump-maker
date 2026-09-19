import {
  isLocale,
  localeCookieHeader,
  pathForApp,
  t,
  type AppView,
  type Locale,
} from "./i18n.ts";

export function persistLocale(locale: Locale): void {
  document.cookie = localeCookieHeader(locale, location.protocol === "https:");
}

export function syncLanguageNav(root: ParentNode, locale: Locale, view: AppView): void {
  for (const nav of root.querySelectorAll(".lang-switch")) {
    nav.setAttribute("aria-label", t(locale, "langNavAria"));
    for (const anchor of nav.querySelectorAll("a[data-locale]")) {
      const item = anchor.getAttribute("data-locale");
      if (!isLocale(item)) continue;
      anchor.setAttribute("href", pathForApp(item, view));
      if (item === locale) anchor.setAttribute("aria-current", "page");
      else anchor.removeAttribute("aria-current");
    }
  }
}
