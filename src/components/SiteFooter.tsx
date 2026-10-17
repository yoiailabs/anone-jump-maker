import { JaPhrase } from "@/components/JaPhrase.tsx";
import { pathForApp, t, type Locale } from "../i18n.ts";

export function SiteFooter({
  locale,
  current,
}: {
  locale: Locale;
  current?: "privacy" | "terms";
}) {
  return (
    <footer className="site-footer" id="siteFooter">
      <JaPhrase className="site-footer-notice" locale={locale} text={t(locale, "termsNotice")} />
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
        <p className="site-footer-credit">{t(locale, "footerCopyright")}</p>
      </div>
    </footer>
  );
}
