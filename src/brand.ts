/** 横並びワードマークが無いあいだ、ヘッダーに置く小さいマーク。 */
export const HEADER_MARK_SRC = "/icons/icon.svg";

export const MAKER_LOGO_STACKED_SRC = "/brand/anone-logo-stacked.svg";
export const MAKER_LOGO_STACKED_EN_SRC = "/brand/anone-logo-stacked-en.svg";
export const MAKER_LOGO_STACKED_SIZE = { width: 640, height: 365 } as const;
export const MAKER_LOGO_STACKED_EN_SIZE = { width: 640, height: 390 } as const;

export function makerLogoStackedSrc(locale: "ja" | "en" | "ko" | "zh"): string {
  return locale === "ja" ? MAKER_LOGO_STACKED_SRC : MAKER_LOGO_STACKED_EN_SRC;
}

export function makerLogoStackedSize(locale: "ja" | "en" | "ko" | "zh"): {
  width: 640;
  height: 365 | 390;
} {
  return locale === "ja" ? MAKER_LOGO_STACKED_SIZE : MAKER_LOGO_STACKED_EN_SIZE;
}
