/** 画面上のライブ合成だけ内部解像度を下げる。保存は 1。 */
export const PREVIEW_RESOLUTION_SCALE = 0.5;

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

/** 出力サイズに倍率を掛ける。プレビューは 0.5、保存は 1。 */
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
