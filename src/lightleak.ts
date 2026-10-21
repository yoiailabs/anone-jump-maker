import { ensureCanvasSize } from "./canvas-size.ts";
import type { SwapFx } from "./layout.ts";

/** 短辺135pxの作業面を縦横で共用し、写真とキャラに同じ光を使う。 */
export const LIGHT_LEAK_SHORT_SIDE = 135;
export const LIGHT_LEAK_CHARACTER_GAIN = 0.12;
export const LIGHT_LEAK_PHOTO_GAIN = 0.95;
export const LIGHT_LEAK_GRID_EDGE = 32;
export const LIGHT_LEAK_DARK_THRESHOLD = 48;
export const LIGHT_LEAK_CONTRAST_THRESHOLD = 12;
export const LIGHT_LEAK_FALLBACK = { x: 0.5, y: 0.25 } as const;

type LuminanceGrid = { width: number; height: number; values: Float32Array };
type Rect = { x: number; y: number; w: number; h: number };
const grids = new WeakMap<ImageBitmap, LuminanceGrid>();

/**
 * 読み込み時に一度だけ縮小・読み戻して輝度グリッドをキャッシュする。bitmapの寿命で解放される。
 * 解析に失敗しても写真の読み込みは止めない（光漏れは上中央のフォールバック位置になる）。
 */
export function prepareLightLeakPhoto(bitmap: ImageBitmap): void {
  if (grids.has(bitmap)) return;
  try {
    analyzeLightLeakPhoto(bitmap);
  } catch {
    // Canvas2D が使えない・読み戻せない環境。キャッシュしないので lightLeakSource はフォールバックを返す。
  }
}

function analyzeLightLeakPhoto(bitmap: ImageBitmap): void {
  const scale = LIGHT_LEAK_GRID_EDGE / Math.max(bitmap.width, bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas2D が使えません");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const raw = new Float32Array(width * height);
  for (let i = 0; i < raw.length; i++) {
    const p = i * 4;
    raw[i] = (0.2126 * rgba[p]! + 0.7152 * rgba[p + 1]! + 0.0722 * rgba[p + 2]!) * rgba[p + 3]! / 255;
  }
  // ぼかしは表示範囲が決まる描画時に、見えるセルだけで行う（クロップ外の明部を混ぜない）。
  grids.set(bitmap, { width, height, values: raw });
  canvas.width = canvas.height = 0;
}

/**
 * 描画中はキャッシュだけを走査。cover で見えるセルの範囲を求め、その範囲の中だけで 3×3 ガウスぼかしをかけて
 * 最も明るいセルの中心をパネル座標へ写す。範囲外（クロップで見えない部分）の輝度は混ぜない。
 */
export function lightLeakSource(bitmap: ImageBitmap, dest: Rect, panelW: number, panelH: number) {
  const grid = grids.get(bitmap);
  if (!grid) return LIGHT_LEAK_FALLBACK;
  const cellX = (x: number) => dest.x + (x + 0.5) / grid.width * dest.w;
  const cellY = (y: number) => dest.y + (y + 0.5) / grid.height * dest.h;
  // セル中心はインデックスに対して単調なので、見えるセルは連続した範囲になる。
  let x0 = 0, x1 = grid.width - 1, y0 = 0, y1 = grid.height - 1;
  while (x0 <= x1 && cellX(x0) < 0) x0++;
  while (x1 >= x0 && cellX(x1) >= panelW) x1--;
  while (y0 <= y1 && cellY(y0) < 0) y0++;
  while (y1 >= y0 && cellY(y1) >= panelH) y1--;
  if (x0 > x1 || y0 > y1) return LIGHT_LEAK_FALLBACK;
  let max = -Infinity, sum = 0, count = 0;
  let sourceX = 0, sourceY = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let blurred = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const sy = Math.max(y0, Math.min(y1, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const sx = Math.max(x0, Math.min(x1, x + dx));
          blurred += grid.values[sy * grid.width + sx]! * (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
        }
      }
      const value = blurred / 16;
      sum += value;
      count++;
      // 同点は先のインデックスを採用し、シークやcompositorによる揺れを防ぐ。
      if (value > max) {
        max = value;
        sourceX = cellX(x) / panelW;
        sourceY = cellY(y) / panelH;
      }
    }
  }
  return max < LIGHT_LEAK_DARK_THRESHOLD || max - sum / count < LIGHT_LEAK_CONTRAST_THRESHOLD
    ? LIGHT_LEAK_FALLBACK : { x: sourceX, y: sourceY };
}

/** 白い局所グロー。短辺基準の円を強さに合わせて少しだけ膨らませる。 */
export function paintLightLeak(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  source: { x: number; y: number },
  fx: NonNullable<SwapFx["lightleak"]>,
): void {
  const scale = LIGHT_LEAK_SHORT_SIDE / Math.min(width, height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  ensureCanvasSize(canvas, w, h);
  ctx.clearRect(0, 0, w, h);
  const radius = Math.min(w, h) * (1 + 0.15 * fx.amount);
  const x = source.x * w, y = source.y * h;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  // ガウス状の連続減衰。外端は1階調未満でゼロへつなぎ、輪郭を残さない。
  const tail = Math.exp(-6);
  for (let i = 0; i <= 32; i++) {
    const r = i / 32;
    const alpha = (Math.exp(-6 * r * r) - tail) / (1 - tail);
    gradient.addColorStop(r, `rgba(255, 255, 255, ${alpha})`);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

/** 整数の全面矩形へ平滑化拡大。透明な縁も screen なので写真を暗くしない。 */
export function blendLightLeak(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  amount: number,
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = amount;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas, 0, 0, w, h);
  ctx.restore();
}
