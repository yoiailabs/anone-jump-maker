import { makerLogoHorizontalSize, makerLogoHorizontalSrc } from "../brand.ts";
import { pathForApp, t, type Locale } from "../i18n.ts";

/** 横並びワードマーク。トップへ戻る。 */
export function HeaderLockup({
  locale,
  id,
  label,
}: {
  locale: Locale;
  id: string;
  label?: string;
}) {
  const size = makerLogoHorizontalSize(locale);
  return (
    <a id={id} className="header-lockup" href={pathForApp(locale, "maker")} aria-label={label}>
      <img
        className="header-lockup-logo"
        src={makerLogoHorizontalSrc(locale)}
        width={size.width}
        height={size.height}
        alt={t(locale, "makerTitle")}
        decoding="async"
      />
    </a>
  );
}
