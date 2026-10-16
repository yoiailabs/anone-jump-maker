import type { AspectMode } from "./layout.ts";

/** 横プレビュー。1280×720 の半分で 640×360。 */
export const PREVIEW_RESOLUTION_SCALE = 0.5;

/**
 * 縦プレビュー。1080×1920 の 1/3 で 360×640。
 * 横プレビューと同じ画素数（230400）にし、縦だけ重くしない。
 */
export const PORTRAIT_PREVIEW_RESOLUTION_SCALE = 1 / 3;

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

/** 出力サイズに倍率を掛ける。横プレビューは 0.5、縦プレビューは 1/3、保存は 1。 */
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
