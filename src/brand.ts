export const MAKER_LOGO_HORIZONTAL_SRC = "/brand/anone-logo-horizontal.svg";
export const MAKER_LOGO_HORIZONTAL_EN_SRC = "/brand/anone-logo-horizontal-en.svg";
export const MAKER_LOGO_HORIZONTAL_SIZE = { width: 720, height: 165 } as const;
export const MAKER_LOGO_HORIZONTAL_EN_SIZE = { width: 720, height: 176 } as const;

export function makerLogoHorizontalSrc(locale: "ja" | "en" | "ko" | "zh"): string {
  return locale === "ja" ? MAKER_LOGO_HORIZONTAL_SRC : MAKER_LOGO_HORIZONTAL_EN_SRC;
}

export function makerLogoHorizontalSize(locale: "ja" | "en" | "ko" | "zh"): {
  width: 720;
  height: 165 | 176;
} {
  return locale === "ja" ? MAKER_LOGO_HORIZONTAL_SIZE : MAKER_LOGO_HORIZONTAL_EN_SIZE;
}

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
