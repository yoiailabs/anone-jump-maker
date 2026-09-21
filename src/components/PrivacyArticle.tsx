import { useEffect } from "react";
import { LanguageNav } from "@/components/LanguageNav.tsx";
import { SiteFooter } from "@/components/SiteFooter.tsx";
import { localeRedirectLocation, pathForApp, t, type Locale } from "../i18n.ts";
import {
  GOOGLE_ADS_SETTINGS_URL,
  GOOGLE_ANALYTICS_OPTOUT_URL,
  GOOGLE_ANALYTICS_SAFEGUARDS_URL,
  GOOGLE_PRIVACY_POLICY_URL,
  PRIVACY_CONTACT_URL,
  PRIVACY_ORG_URL,
  PRIVACY_POLICY_UPDATED,
} from "../privacy.ts";

function clientLocaleRedirect(): string | null {
  if (typeof location === "undefined" || typeof navigator === "undefined") return null;
  const languages =
    navigator.languages.length > 0 ? [...navigator.languages] : [navigator.language];
  return localeRedirectLocation(
    location.pathname,
    location.search,
    typeof document === "undefined" ? "" : document.cookie,
    languages.join(","),
    navigator.userAgent,
  );
}

export default function PrivacyArticle({ locale }: { locale: Locale }) {
  useEffect(() => {
    const dest = clientLocaleRedirect();
    if (dest) location.replace(dest);
  }, []);

  return (
    <>
      <div className="sky" aria-hidden="true">
        <span className="blob blob-lime" />
        <span className="blob blob-teal" />
        <span className="blob blob-coral" />
      </div>
      <div className="app">
        <header className="hero">
          <LanguageNav locale={locale} view="privacy" />
          <p className="eyebrow">#あのねジャンプ</p>
          <h1 id="privacyTitle">{t(locale, "privacyTitle")}</h1>
          <p className="lede">
            <time dateTime={PRIVACY_POLICY_UPDATED}>{t(locale, "privacyUpdated")}</time>
          </p>
        </header>
        <article className="privacy" id="privacyPolicy">
          <section>
            <h2>{t(locale, "privacyOperatorHeading")}</h2>
            <p>{t(locale, "privacyOperatorBody")}</p>
          </section>
          <section>
            <h2>{t(locale, "privacyAboutHeading")}</h2>
            <p>{t(locale, "privacyAboutBody")}</p>
          </section>
          <section>
            <h2>{t(locale, "privacyAnalyticsHeading")}</h2>
            <p>{t(locale, "privacyAnalyticsIntro")}</p>
            <ul>
              <li>{t(locale, "privacyAnalyticsPages")}</li>
              <li>{t(locale, "privacyAnalyticsNav")}</li>
              <li>{t(locale, "privacyAnalyticsEvents")}</li>
              <li>{t(locale, "privacyAnalyticsDevice")}</li>
            </ul>
            <p>{t(locale, "privacyAnalyticsOutro")}</p>
          </section>
          <section>
            <h2>{t(locale, "privacyCookiesHeading")}</h2>
            <p>{t(locale, "privacyCookiesBody")}</p>
          </section>
          <section>
            <h2>{t(locale, "privacyPurposeHeading")}</h2>
            <p>{t(locale, "privacyPurposeBody")}</p>
          </section>
          <section>
            <h2>{t(locale, "privacyThirdHeading")}</h2>
            <p>{t(locale, "privacyThirdBody")}</p>
            <ul>
              <li>
                <a href={GOOGLE_PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
                  {t(locale, "privacyGooglePolicy")}
                </a>
              </li>
              <li>
                <a href={GOOGLE_ANALYTICS_SAFEGUARDS_URL} target="_blank" rel="noopener noreferrer">
                  {t(locale, "privacyGoogleAnalytics")}
                </a>
              </li>
            </ul>
          </section>
          <section>
            <h2>{t(locale, "privacyOptOutHeading")}</h2>
            <p>{t(locale, "privacyOptOutBody")}</p>
            <ul>
              <li>
                <a href={GOOGLE_ANALYTICS_OPTOUT_URL} target="_blank" rel="noopener noreferrer">
                  {t(locale, "privacyOptOutAddon")}
                </a>
              </li>
              <li>
                <a href={GOOGLE_ADS_SETTINGS_URL} target="_blank" rel="noopener noreferrer">
                  {t(locale, "privacyOptOutAds")}
                </a>
              </li>
            </ul>
          </section>
          <section>
            <h2>{t(locale, "privacyContactHeading")}</h2>
            <p>{t(locale, "privacyContactBody")}</p>
            <ul>
              <li>
                <a href={PRIVACY_CONTACT_URL} target="_blank" rel="noopener noreferrer">
                  {t(locale, "privacyContactLink")}
                </a>
              </li>
              <li>
                <a href={PRIVACY_ORG_URL} target="_blank" rel="noopener noreferrer">
                  {t(locale, "privacyOrgLink")}
                </a>
              </li>
            </ul>
          </section>
          <section>
            <h2>{t(locale, "privacyUpdatesHeading")}</h2>
            <p>{t(locale, "privacyUpdatesBody")}</p>
          </section>
        </article>
        <p className="privacy-back">
          <a id="privacyBack" className="page-link" href={pathForApp(locale, "maker")}>
            {t(locale, "communityBack")}
          </a>
        </p>
        <SiteFooter locale={locale} current />
      </div>
    </>
  );
}
