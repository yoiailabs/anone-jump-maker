import { pathForApp, t, type Locale } from "../i18n.ts";

import { siteCopy } from "../site-copy";

export function SiteFooter({
  locale,
  current,
}: {
  locale: Locale;
  current?: "privacy" | "terms";
}) {
  return (
    <footer className="site-footer" id="siteFooter">
      <p className="site-footer-notice">{siteCopy[locale].fan}</p>
      <div className="site-footer-links">
        <nav aria-label={t(locale, "footerNavAria")}>
          <a
            id="privacyPolicyLink"
            href={pathForApp(locale, "privacy")}
            {...(current === "privacy" ? { "aria-current": "page" as const } : {})}
          >
            {t(locale, "privacyLink")}
          </a>
          <a
            id="termsLink"
            href={pathForApp(locale, "terms")}
            {...(current === "terms" ? { "aria-current": "page" as const } : {})}
          >
            {t(locale, "termsLink")}
          </a>
        </nav>
        <p className="site-footer-credit">{t(locale, "footerOperator")}</p>
      </div>
    </footer>
  );
}
