import { ArrowUpRight, ArrowRight } from "lucide-react";
import { LanguageNav } from "./LanguageNav";
import { SiteFooter } from "./SiteFooter";
import { JumpLoop } from "./JumpLoop";
import { OfficialLinks } from "./OfficialLinks";
import { pathForApp, t, type Locale } from "../i18n";
import { makerLogoStackedSize, makerLogoStackedSrc } from "../brand";
import { siteCopy } from "../site-copy";
import { MORE_JUMPS_HREF } from "../social";
import { OFFICIAL_MV_WATCH_HREF } from "../links";
export default function HomePage({ locale }: { locale: Locale }) {
  const copy = siteCopy[locale];
  const logoSize = makerLogoStackedSize(locale);
  return (
    <div className="site-home">
      <header className="home-header">
        <a
          href={pathForApp(locale, "home")}
          aria-label={t(locale, "makerTitle")}
        >
          <img
            className="brand-mark"
            src={makerLogoStackedSrc(locale)}
            width={logoSize.width}
            height={logoSize.height}
            alt={t(locale, "makerTitle")}
          />
        </a>
        <LanguageNav locale={locale} view="home" />
      </header>
      <main className="home-main">
        <div className="home-copy">
          <p className="home-kicker">ANONE JUMP MAKER</p>
          <h1 id="makerTitle">{copy.headline}</h1>
          <p className="home-intro">{copy.intro}</p>
          <a
            id="startMaking"
            className="primary-action"
            href={pathForApp(locale, "maker")}
          >
            {copy.start}
            <ArrowRight size={22} />
          </a>
          <p className="local-note">{copy.local}</p>
        </div>
        <figure className="home-film">
          <JumpLoop
            href={OFFICIAL_MV_WATCH_HREF}
            ariaLabel={t(locale, "makerPvAria", {
              song: t(locale, "songTitle"),
            })}
          />
          <figcaption>
            <span>{copy.sound}</span>
            <ArrowUpRight size={16} />
          </figcaption>
        </figure>
      </main>
      <div className="home-bottom">
        <a
          className="quiet-link"
          href={MORE_JUMPS_HREF}
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.search}
          <ArrowUpRight size={14} />
        </a>
        <OfficialLinks locale={locale} />
      </div>
      <SiteFooter locale={locale} />
    </div>
  );
}
