import { languageNavHtml, type AppView, type Locale } from "../i18n.ts";

export function LanguageNav({ locale, view }: { locale: Locale; view: AppView }) {
  return (
    <div
      className="lang-switch-wrap"
      dangerouslySetInnerHTML={{ __html: languageNavHtml(locale, view) }}
    />
  );
}
