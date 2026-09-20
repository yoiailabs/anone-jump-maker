import { t, type Locale } from "../i18n.ts";

const BROWSER_LINES = [
  "makerBrowsersIos",
  "makerBrowsersAndroid",
  "makerBrowsersDesktop",
  "makerBrowsersMacSafari",
] as const;

export function BrowsersNote({ locale }: { locale: Locale }) {
  return (
    <div className="browsers-note" id="browsersNote">
      <p className="browsers-note-heading">{t(locale, "makerBrowsersHeading")}</p>
      <ul>
        {BROWSER_LINES.map((key) => (
          <li key={key}>{t(locale, key)}</li>
        ))}
      </ul>
    </div>
  );
}
