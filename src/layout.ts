export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export const OUTPUT = { width: 720, height: 1280 } as const;

/**
 * テンプレ（miWuv4NK9Qk）と参考 Short（o1ROhNU0UNw）の 16:9 帯。
 * 9:16 フレーム高さに対する上端。720px サムネ実測 208/720 = 13/45。
 */
export const MAIN_PANEL_Y_FRAC = 13 / 45;

/** カット拍での hop。参考 Short は 360×640 で約 ±20px。 */
export const JUMP_AMPLITUDE = 20 / 640;

/** 1 ジャンプの長さ（秒）。スロット間隔より長くはしない。 */
export const JUMP_DURATION = 0.36;

/**
 * 16:9 本編を 9:16 に cover したあと、さらに少しズームして
 * hop とボケのはみ出しを隠す。
 */
export const BLUR_COVER_SCALE = 1.22;

/** 本編とブラー帯の境。参考は細い暗線。 */
export const PANEL_DIVIDER_PX = 2;

/** 上下帯の暗転。 */
export const BLUR_DIM = "rgba(8, 6, 4, 0.55)";

export const BLUR_SOURCE = "main-frame" as const;

export function outputSize(): { width: number; height: number } {
  return OUTPUT;
}

/** 縦 9:16 上のシャープな 16:9。左右端まで。テンプレ緑帯に一致。 */
export function mainPanelRect(canvasW: number, canvasH: number): Rect {
  const w = canvasW;
  const h = (canvasW * 9) / 16;
  const y = canvasH * MAIN_PANEL_Y_FRAC;
  return { x: 0, y, w, h };
}

/** テンプレ映像から緑 16:9 帯を切り出す矩形。 */
export function templateBandRect(videoW: number, videoH: number): Rect {
  const h = videoW * (9 / 16);
  const y = videoH * MAIN_PANEL_Y_FRAC;
  return { x: 0, y, w: videoW, h };
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
