export type AspectMode = "portrait" | "landscape";

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** 縦はテンプレ miWuv4NK9Qk と同じ 608×1080。横は 1280×720（プレビュー＝保存）。 */
export const OUTPUTS = {
  portrait: { width: 608, height: 1080 },
  landscape: { width: 1280, height: 720 },
} as const;

/** 新テンプレ miWuv4NK9Qk / 参考 Short と同じ 608×1080。 */
export const OUTPUT = OUTPUTS.portrait;

export const TEMPLATES = {
  portrait: { video: "/template/vertical.mp4", cuts: "/template/cuts.json" },
  landscape: { video: "/template/landscape.mp4", cuts: "/template/landscape-cuts.json" },
} as const;

/** テンプレ緑 16:9 帯（実測 312–654、高さ 342 = 608×9/16）。 */
export const TEMPLATE_BAND_Y = 312;
export const TEMPLATE_BAND_H = 342;

export const MAIN_PANEL_Y_FRAC = TEMPLATE_BAND_Y / OUTPUT.height;

/** 参考 Short の hop。1080p で約 30px 上。 */
export const JUMP_AMPLITUDE = 30 / OUTPUT.height;

/** 1 ジャンプの長さ（秒）。スロット間隔より長くはしない。 */
export const JUMP_DURATION = 0.36;

/**
 * 本編 16:9 をキャンバスへ cover する倍率。
 * 1 で本編上端→キャンバス上端、本編下端→キャンバス下端（参考と同じ）。
 */
export const BLUR_COVER_SCALE = 1;

/** 参考は本編上端の 1px 暗線。 */
export const PANEL_DIVIDER_PX = 1;

/** 上下帯の暗転。参考 Short の帯は本編の約 0.33–0.40 輝度。 */
export const BLUR_DIM = "rgba(4, 3, 3, 0.62)";

/**
 * 参考 Short の本編キャラ。緑帯 1:1 より大きく、下辺揃えで拡大する。
 * 公式 16:9 とテンプレ緑帯の実測（0.13 / 0.50 / 1.00 / 5.00s）から。
 */
export const CHAR_SCALE = 1.7;

/** 公式のステッカー縁（白、縦本編 608px 幅でのピクセル）。 */
export const CHAR_OUTLINE_PX = 2;

export const BLUR_SOURCE = "main-frame" as const;

export function isAspectMode(value: string): value is AspectMode {
  return value === "portrait" || value === "landscape";
}

export function usesBlurBackdrop(mode: AspectMode): boolean {
  return mode === "portrait";
}

/** キー済み緑帯を本編 16:9 へ置く矩形。下揃え・左右中央。 */
export function characterDest(panelW: number, panelH: number, scale = CHAR_SCALE): Rect {
  const w = panelW * scale;
  const h = panelH * scale;
  return {
    x: (panelW - w) / 2,
    y: panelH - h,
    w,
    h,
  };
}

/** 本編幅に合わせてステッカー縁を太らせる。縦 608 では 2px のまま。 */
export function characterOutlinePx(panelW: number): number {
  return Math.max(CHAR_OUTLINE_PX, Math.round((CHAR_OUTLINE_PX * panelW) / OUTPUT.width));
}

export function outputSize(mode: AspectMode = "portrait"): { width: number; height: number } {
  return OUTPUTS[mode];
}

/** 縦: 中央のシャープな 16:9。横: キャンバス全体が本編。 */
export function mainPanelRect(canvasW: number, canvasH: number, mode: AspectMode = "portrait"): Rect {
  if (mode === "landscape") {
    return { x: 0, y: 0, w: canvasW, h: canvasH };
  }
  const w = canvasW;
  const h = canvasW * (TEMPLATE_BAND_H / OUTPUT.width);
  const y = canvasH * (TEMPLATE_BAND_Y / OUTPUT.height);
  return { x: 0, y: Math.round(y), w, h: Math.round(h) };
}

/** テンプレ映像から切り出す矩形。縦は緑 16:9 帯、横は全面。 */
export function templateBandRect(videoW: number, videoH: number, mode: AspectMode = "portrait"): Rect {
  if (mode === "landscape") {
    return { x: 0, y: 0, w: videoW, h: videoH };
  }
  return {
    x: 0,
    y: Math.round(videoH * (TEMPLATE_BAND_Y / OUTPUT.height)),
    w: videoW,
    h: Math.round(videoW * (TEMPLATE_BAND_H / OUTPUT.width)),
  };
}

/** 本編パネル内の写真が hop しても端が見えないだけの cover 倍率。 */
export function sharpCoverScale(canvasH: number, panelH: number): number {
  const hop = canvasH * JUMP_AMPLITUDE;
  return 1 + (2 * hop) / Math.max(panelH, 1);
}

export function coverDest(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  options: { scale?: number; offsetY?: number; dx?: number; dy?: number } = {},
): Rect {
  const scale = Math.max(destW / Math.max(srcW, 1e-6), destH / Math.max(srcH, 1e-6)) * (options.scale ?? 1);
  const w = srcW * scale;
  const h = srcH * scale;
  return {
    x: (options.dx ?? 0) + (destW - w) / 2,
    y: (options.dy ?? 0) + (destH - h) / 2 + (options.offsetY ?? 0),
    w,
    h,
  };
}

/** Canvas2D（左上原点）の矩形 → WebGL UV（左下原点）。 */
export function rectToUvBottomLeft(rect: Rect, canvasW: number, canvasH: number): [number, number, number, number] {
  return [rect.x / canvasW, 1 - (rect.y + rect.h) / canvasH, rect.w / canvasW, rect.h / canvasH];
}

/**
 * カット開始から hop 曲線。0 = 静止、1 = 頂点。
 * `cuts.json` のスロット＝テンプレのポーズ切替に同期する。
 */
export function jumpAmount(time: number, slots: readonly number[]): number {
  if (slots.length === 0) return 0;
  let start = slots[0]!;
  let next = slots[1] ?? start + JUMP_DURATION;
  for (let i = 1; i < slots.length; i += 1) {
    const t = slots[i]!;
    if (time + 1e-4 >= t) {
      start = t;
      next = slots[i + 1] ?? start + JUMP_DURATION;
    } else {
      break;
    }
  }
  const duration = Math.min(JUMP_DURATION, Math.max(0.2, next - start));
  const u = (time - start) / duration;
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.34) {
    return Math.sin(((u / 0.34) * Math.PI) / 2);
  }
  return Math.cos((((u - 0.34) / 0.66) * Math.PI) / 2);
}

/** 上方向が負（Canvas2D）。本編 16:9 内の写真 hop に使う。 */
export function jumpOffsetPx(time: number, slots: readonly number[], canvasHeight: number): number {
  const amount = jumpAmount(time, slots);
  if (amount === 0) return 0;
  return -amount * canvasHeight * JUMP_AMPLITUDE;
}
