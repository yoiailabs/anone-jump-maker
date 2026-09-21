import { pathForApp, t, type Locale } from "../i18n.ts";

export function SiteFooter({
  locale,
  current = false,
}: {
  locale: Locale;
  current?: boolean;
}) {
  return (
    <footer className="site-footer" id="siteFooter">
      <nav aria-label={t(locale, "footerNavAria")}>
        <a
          id="privacyPolicyLink"
          href={pathForApp(locale, "privacy")}
          {...(current ? { "aria-current": "page" as const } : {})}
        >
          {t(locale, "privacyLink")}
        </a>
      </nav>
      <p className="site-footer-credit">{t(locale, "footerOperator")}</p>
    </footer>
  );
}
