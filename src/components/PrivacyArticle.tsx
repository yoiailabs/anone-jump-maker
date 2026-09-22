import { useEffect } from "react";
import { LanguageNav } from "@/components/LanguageNav.tsx";
import { SiteFooter } from "@/components/SiteFooter.tsx";
import { localeRedirectLocation, pathForApp, t, type Locale } from "../i18n.ts";
import { privacyDocument, type Inline, type PrivacyBlock } from "../privacy-copy.ts";

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

function olMark(title: string): string {
  const latinOrHangul = /[A-Za-z\uac00-\ud7af]/.test(title);
  const kanaOrKanji = /[\u3040-\u30ff\u4e00-\u9fff]/.test(title);
  return latinOrHangul && !kanaOrKanji ? ": " : "：";
}

function Parts({ parts }: { parts: Inline[] }) {
  return parts.map((part, index) =>
    typeof part === "string" ? (
      <span key={index}>{part}</span>
    ) : (
      <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">
        {part.label}
      </a>
    ),
  );
}

function BlockView({ block }: { block: PrivacyBlock }) {
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
  if (block.type === "ol") {
    return (
      <ol>
        {block.items.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            {olMark(item.title)}
            {item.text}
          </li>
        ))}
      </ol>
    );
  }
  if (block.type === "table") {
    return (
      <div className="privacy-table-wrap">
        <table>
          <thead>
            <tr>
              {block.headers.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) => (
                  <td key={`${row[0]}-${index}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <>
      <p>{block.intro}</p>
      <ul>
        {block.items.map((item) => (
          <li key={item.name}>
            {item.name}
            {block.separator.includes("／") ? "：" : ": "}
            {item.links.map((link, index) => (
              <span key={link.href}>
                {index > 0 ? block.separator : null}
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function PrivacyArticle({ locale }: { locale: Locale }) {
  useEffect(() => {
    const dest = clientLocaleRedirect();
    if (dest) location.replace(dest);
  }, []);

  const copy = privacyDocument(locale);

  return (
    <>
      <div className="sky" aria-hidden="true">
        <span className="blob blob-lime" />
        <span className="blob blob-teal" />
        <span className="blob blob-coral" />
      </div>
      <div className="app privacy-app">
        <header className="hero">
          <LanguageNav locale={locale} view="privacy" />
          <p className="eyebrow">#あのねジャンプ</p>
          <h1 id="privacyTitle">{t(locale, "privacyTitle")}</h1>
        </header>
        <article className="privacy" id="privacyPolicy">
          <p className="privacy-dates">
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
          <a id="privacyBack" className="page-link" href={pathForApp(locale, "maker")}>
            {t(locale, "communityBack")}
          </a>
        </p>
        <SiteFooter locale={locale} current="privacy" />
      </div>
    </>
  );
}
