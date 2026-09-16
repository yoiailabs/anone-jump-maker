export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export const OUTPUT = { width: 720, height: 1280 } as const;

/** カット拍での背景ジャンプ。キャンバス高さに対する最大変位。 */
export const JUMP_AMPLITUDE = 0.058;

/** 1 ジャンプの長さ（秒）。スロット間隔より長くはしない。 */
export const JUMP_DURATION = 0.36;

/** 上下帯は本編より大きく cover ズームする。ジャンプとボケのはみ出しも隠す。 */
export const BLUR_COVER_SCALE = 1.58;

/** 中央 16:9 とブラー帯の境の細い黒線。 */
export const PANEL_DIVIDER_PX = 3;

/**
 * 本編 16:9 を厳密中央から下へずらす（キャンバス高さ比）。
 * テンプレ映像のキャラはおよそ y=0.45–0.76（胴〜足元）に乗る。
 * 0.10 だと 720×1280 でパネル下端が約 0.758 になり、その帯に重なる。
 */
export const MAIN_PANEL_Y_SHIFT = 0.1;

export function outputSize(): { width: number; height: number } {
  return OUTPUT;
}

/** 縦 9:16 キャンバス上のシャープな 16:9。左右端まで。キャラ位置に合わせて下げる。 */
export function mainPanelRect(canvasW: number, canvasH: number): Rect {
  const w = canvasW;
  const h = (canvasW * 9) / 16;
  const y = (canvasH - h) / 2 + canvasH * MAIN_PANEL_Y_SHIFT;
  return { x: 0, y, w, h };
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

/** テンプレ映像の置き場。キャンバス全面を cover。 */
export function videoOverlayRect(canvasW: number, canvasH: number, videoW: number, videoH: number): Rect {
  return coverDest(videoW, videoH, canvasW, canvasH);
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
  // 速い上昇 → ゆるい落下（跳ね）
  if (u < 0.34) {
    return Math.sin(((u / 0.34) * Math.PI) / 2);
  }
  return Math.cos((((u - 0.34) / 0.66) * Math.PI) / 2);
}

/** 上方向が負（Canvas2D）。ブラー帯と本編 16:9 内の写真で同じ値を使う。 */
export function jumpOffsetPx(time: number, slots: readonly number[], canvasHeight: number): number {
  const amount = jumpAmount(time, slots);
  if (amount === 0) return 0;
  return -amount * canvasHeight * JUMP_AMPLITUDE;
}
