export type AspectMode = "portrait" | "landscape";

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export const OUTPUTS = {
  portrait: { width: 720, height: 1280 },
  landscape: { width: 1280, height: 720 },
} as const;

/** @deprecated 既定は縦。`OUTPUTS` と `outputSize` を使う。 */
export const OUTPUT = OUTPUTS.portrait;

/** カット拍での背景ジャンプ。キャンバス高さに対する最大変位。 */
export const JUMP_AMPLITUDE = 0.058;

/** 1 ジャンプの長さ（秒）。スロット間隔より長くはしない。 */
export const JUMP_DURATION = 0.36;

/** ブラー用に cover を少し拡大して、ジャンプとボケのはみ出しを隠す。 */
export const BLUR_COVER_SCALE = 1.24;

export function isAspectMode(value: string): value is AspectMode {
  return value === "portrait" || value === "landscape";
}

export function outputSize(mode: AspectMode): { width: number; height: number } {
  return OUTPUTS[mode];
}

export function usesBlurBackdrop(mode: AspectMode): boolean {
  return mode === "portrait";
}

/** 縦: 中央のシャープな 16:9。横: キャンバス全体が本編。 */
export function mainPanelRect(canvasW: number, canvasH: number, mode: AspectMode): Rect {
  if (mode === "landscape") {
    return { x: 0, y: 0, w: canvasW, h: canvasH };
  }
  const w = canvasW;
  const h = (canvasW * 9) / 16;
  return { x: 0, y: (canvasH - h) / 2, w, h };
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

export function containDest(srcW: number, srcH: number, destW: number, destH: number): Rect {
  const scale = Math.min(destW / Math.max(srcW, 1e-6), destH / Math.max(srcH, 1e-6));
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (destW - w) / 2, y: (destH - h) / 2, w, h };
}

/**
 * テンプレ映像の置き場。縦はキャンバス全面。
 * 横は contain してジャンプ全体を残し、左右は本編写真が見える。
 */
export function videoOverlayRect(
  canvasW: number,
  canvasH: number,
  videoW: number,
  videoH: number,
  mode: AspectMode,
): Rect {
  if (mode === "portrait") {
    return coverDest(videoW, videoH, canvasW, canvasH);
  }
  return containDest(videoW, videoH, canvasW, canvasH);
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

/** 上方向が負（Canvas2D）。横モードでは 0。 */
export function jumpOffsetPx(time: number, slots: readonly number[], canvasHeight: number, mode: AspectMode): number {
  if (!usesBlurBackdrop(mode)) return 0;
  return -jumpAmount(time, slots) * canvasHeight * JUMP_AMPLITUDE;
}
