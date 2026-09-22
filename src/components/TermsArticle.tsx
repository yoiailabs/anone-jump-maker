import { useEffect } from "react";
import { LanguageNav } from "@/components/LanguageNav.tsx";
import { SiteFooter } from "@/components/SiteFooter.tsx";
import { localeRedirectLocation, pathForApp, t, type Locale } from "../i18n.ts";
import { termsDocument, type TermsBlock, type TermsPart } from "../terms-copy.ts";

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

function Parts({ parts, locale }: { parts: TermsPart[]; locale: Locale }) {
  return parts.map((part, index) =>
    typeof part === "string" ? (
      <span key={index}>{part}</span>
    ) : (
      <a key={index} href={pathForApp(locale, "privacy")}>
        {part.label}
      </a>
    ),
  );
}

function BlockView({ block, locale }: { block: TermsBlock; locale: Locale }) {
  if (block.type === "p") {
    return (
      <p>
        <Parts parts={block.parts} locale={locale} />
      </p>
    );
  }
  if (block.type === "ul") {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <ol>
      {block.items.map((item, index) => (
        <li key={index}>
          <Parts parts={item} locale={locale} />
        </li>
      ))}
    </ol>
  );
}

export default function TermsArticle({ locale }: { locale: Locale }) {
  useEffect(() => {
    const dest = clientLocaleRedirect();
    if (dest) location.replace(dest);
  }, []);

  const copy = termsDocument(locale);

  return (
    <>
      <div className="sky" aria-hidden="true">
        <span className="blob blob-lime" />
        <span className="blob blob-teal" />
        <span className="blob blob-coral" />
      </div>
      <div className="app privacy-app">
        <header className="hero">
          <LanguageNav locale={locale} view="terms" />
          <p className="eyebrow">#あのねジャンプ</p>
          <h1 id="termsTitle">{t(locale, "termsTitle")}</h1>
        </header>
        <article className="privacy" id="termsOfUse">
          <p className="privacy-dates">
            {copy.enactedLabel}
            {copy.enactedValue}
            <br />
            {copy.revisedLabel}
            {copy.revisedValue}
            <br />
            {copy.effectiveLabel}
            {copy.effectiveValue}
          </p>
          <p>{copy.preamble}</p>
          {copy.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.blocks.map((block, index) => (
                <BlockView key={`${section.heading}-${index}`} block={block} locale={locale} />
              ))}
            </section>
          ))}
        </article>
        <p className="privacy-back">
          <a id="termsBack" className="page-link" href={pathForApp(locale, "maker")}>
            {t(locale, "communityBack")}
          </a>
        </p>
        <SiteFooter locale={locale} current="terms" />
      </div>
    </>
  );
}
