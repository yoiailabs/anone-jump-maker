import { SiteFooter } from "@/components/SiteFooter.tsx";
import { pathForApp, t, type Locale } from "../i18n.ts";
import { termsDocument, type TermsBlock, type TermsPart } from "../terms-copy.ts";

function Parts({ parts }: { parts: TermsPart[] }) {
  return parts.map((part, index) =>
    typeof part === "string" ? (
      <span key={index}>{part}</span>
    ) : (
      <a key={index} href={pathForApp("ja", "privacy")}>
        {part.label}
      </a>
    ),
  );
}

function BlockView({ block }: { block: TermsBlock }) {
  if (block.type === "p") {
    return (
      <p>
        <Parts parts={block.parts} />
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
          <Parts parts={item} />
        </li>
      ))}
    </ol>
  );
}

export default function TermsArticle({ locale }: { locale: Locale }) {
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
          <p className="eyebrow">#あのねジャンプ</p>
          <h1 id="termsTitle">{t("ja", "termsTitle")}</h1>
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
                <BlockView key={`${section.heading}-${index}`} block={block} />
              ))}
            </section>
          ))}
        </article>
        <p className="privacy-back">
          <a id="termsBack" className="page-link" href={pathForApp("ja", "maker")}>
            {t("ja", "communityBack")}
          </a>
        </p>
        <SiteFooter locale="ja" current="terms" />
      </div>
    </>
  );
}
