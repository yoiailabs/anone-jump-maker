export const MAKER_LOGO_STACKED_SRC = "/brand/anone-logo-stacked.svg";
export const MAKER_LOGO_STACKED_EN_SRC = "/brand/anone-logo-stacked-en.svg";
export const MAKER_LOGO_STACKED_SIZE = { width: 640, height: 365 } as const;

export function makerLogoStackedSrc(locale: "ja" | "en" | "ko" | "zh"): string {
  return locale === "ja" ? MAKER_LOGO_STACKED_SRC : MAKER_LOGO_STACKED_EN_SRC;
}
