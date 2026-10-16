import type { AspectMode } from "./layout.ts";

/**
 * プレビューは書き出しの 1/3。
 * 横 1920×1080 → 640×360、縦 1080×1920 → 360×640。画素数は同じ（230400）。
 */
export const PREVIEW_RESOLUTION_SCALE = 1 / 3;

/** 縦プレビュー。横と同じ 1/3。 */
export const PORTRAIT_PREVIEW_RESOLUTION_SCALE = PREVIEW_RESOLUTION_SCALE;

/** ライブ合成の内部解像度。保存は 1 のまま。 */
export function previewResolutionScale(mode: AspectMode): number {
  return mode === "portrait" ? PORTRAIT_PREVIEW_RESOLUTION_SCALE : PREVIEW_RESOLUTION_SCALE;
}

/** Assigning `canvas.width` even to the same value resets the bitmap. */
export function ensureCanvasSize(
  canvas: { width: number; height: number },
  width: number,
  height: number,
): boolean {
  if (canvas.width === width && canvas.height === height) {
    return false;
  }
  canvas.width = width;
  canvas.height = height;
  return true;
}

/** 出力サイズに倍率を掛ける。プレビューは 1/3、保存は 1。 */
export function scaleCanvasSize(
  width: number,
  height: number,
  scale: number,
): { width: number; height: number } {
  const safe = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    width: Math.max(1, Math.round(width * safe)),
    height: Math.max(1, Math.round(height * safe)),
  };
}
