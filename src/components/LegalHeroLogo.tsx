import { MAKER_LOGO_STACKED_SIZE, MAKER_LOGO_STACKED_SRC } from "../brand.ts";
import { pathForApp } from "../i18n.ts";

const HOME_LABEL = "トップへ戻る";

export function LegalHeroLogo() {
  return (
    <a id="legalHome" className="hero-logo-link" href={pathForApp("ja", "home")} aria-label={HOME_LABEL}>
      <img
        className="hero-logo"
        src={MAKER_LOGO_STACKED_SRC}
        width={MAKER_LOGO_STACKED_SIZE.width}
        height={MAKER_LOGO_STACKED_SIZE.height}
        alt={HOME_LABEL}
        decoding="async"
      />
    </a>
  );
}
