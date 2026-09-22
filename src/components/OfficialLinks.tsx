import { t, type Locale } from "../i18n";
import { siteCopy } from "../site-copy";
import { OFFICIAL_LINKS, OFFICIAL_MV_WATCH_HREF } from "../links";
export function OfficialLinks({ locale }: { locale: Locale }) {
  return (
    <nav className="official-links" aria-label={siteCopy[locale].official}>
      <span>{siteCopy[locale].official}</span>
      <a
        href={OFFICIAL_MV_WATCH_HREF}
        target="_blank"
        rel="noopener noreferrer"
      >
        MV ↗
      </a>
      {OFFICIAL_LINKS.map((link) => (
        <a
          key={link.id}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t(locale, "makerLinkAria", { label: link.label })}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
