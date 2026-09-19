import type { Locale } from "./i18n.ts";

const ZEN_MARU = "family=Zen+Maru+Gothic:wght@400;700";
const NOTO_KR = "family=Noto+Sans+KR:wght@400;700";
const NOTO_SC = "family=Noto+Sans+SC:wght@400;700";

/** 日本語ハッシュタグは全言語に出るので、Zen Maru Gothic は常に載せる。 */
export function googleFontsHref(locale: Locale): string {
  const families =
    locale === "ko" ? `${ZEN_MARU}&${NOTO_KR}` : locale === "zh" ? `${ZEN_MARU}&${NOTO_SC}` : ZEN_MARU;
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
