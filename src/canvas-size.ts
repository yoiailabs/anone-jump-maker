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
