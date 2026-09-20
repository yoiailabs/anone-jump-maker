import { t, type Locale } from "../i18n.ts";

export function BrowsersNote({ locale }: { locale: Locale }) {
  return (
    <p className="browsers-note" id="browsersNote">
      {t(locale, "makerBrowsersNote")}
    </p>
  );
}
