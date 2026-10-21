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
 * 読み込み時に一度だけ縮小・読み戻し・3×3ガウスぼかし。bitmapの寿命で解放される。
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
  const values = new Float32Array(raw.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const sx = Math.max(0, Math.min(width - 1, x + dx));
          const sy = Math.max(0, Math.min(height - 1, y + dy));
          sum += raw[sy * width + sx]! * (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
        }
      }
      values[y * width + x] = sum / 16;
    }
  }
  grids.set(bitmap, { width, height, values });
  canvas.width = canvas.height = 0;
}

/** 描画中はキャッシュだけを走査。coverで見えるセルの中心をパネル座標へ写す。 */
export function lightLeakSource(bitmap: ImageBitmap, dest: Rect, panelW: number, panelH: number) {
  const grid = grids.get(bitmap);
  if (!grid) return LIGHT_LEAK_FALLBACK;
  let max = -Infinity, sum = 0, count = 0;
  let sourceX = 0, sourceY = 0;
  for (let y = 0; y < grid.height; y++) {
    const py = dest.y + (y + 0.5) / grid.height * dest.h;
    if (py < 0 || py >= panelH) continue;
    for (let x = 0; x < grid.width; x++) {
      const px = dest.x + (x + 0.5) / grid.width * dest.w;
      if (px < 0 || px >= panelW) continue;
      const value = grid.values[y * grid.width + x]!;
      sum += value;
      count++;
      // 同点は先のインデックスを採用し、シークやcompositorによる揺れを防ぐ。
      if (value > max) {
        max = value;
        sourceX = px / panelW;
        sourceY = py / panelH;
      }
    }
  }
  return count === 0 || max < LIGHT_LEAK_DARK_THRESHOLD || max - sum / count < LIGHT_LEAK_CONTRAST_THRESHOLD
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
