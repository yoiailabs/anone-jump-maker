import { HEADER_MARK_SRC } from "../brand.ts";
import { pathForApp, t, type Locale } from "../i18n.ts";

/** アイコンとメーカー名を横に並べた仮のヘッダーロックアップ。トップへ戻る。 */
export function HeaderLockup({
  locale,
  id,
  label,
}: {
  locale: Locale;
  id: string;
  label?: string;
}) {
  return (
    <a id={id} className="header-lockup" href={pathForApp(locale, "maker")} aria-label={label}>
      <img
        className="header-lockup-mark"
        src={HEADER_MARK_SRC}
        width={64}
        height={64}
        alt=""
        decoding="async"
      />
      <span className="header-lockup-title">{t(locale, "makerTitle")}</span>
    </a>
  );
}
