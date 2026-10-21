import { ensureCanvasSize } from "./canvas-size.ts";
import type { AspectMode, Rect, SwapFx } from "./layout.ts";
import characterCenters from "./generated/lightleak-character.json";

/** 短辺135pxの作業面を縦横で共用し、写真とキャラに同じ光を使う。 */
export const LIGHT_LEAK_SHORT_SIDE = 135;
export const LIGHT_LEAK_CHARACTER_GAIN = 0.35;
export const LIGHT_LEAK_PHOTO_GAIN = 0.95;
/** 各フレームのガウス標準偏差／最遠隅までの距離。小さな光から全面へ広がり、余韻も拡散する。 */
export const LIGHT_LEAK_RADII = [0.07, 0.18, 0.36, 0.59, 0.82, 0.86, 0.90, 0.94, 0.98] as const;
export type LightLeakPoint = { readonly x: number; readonly y: number };

/** カット時点のテンプレ内アルファ重心。未知のカット／透明なカットは矩形からフォールバックする。 */
export function lightLeakCharacterPoint(cutFrame: number, mode: AspectMode): LightLeakPoint | undefined {
  return characterCenters.cuts.find((cut) => cut.frame === cutFrame)?.[mode] ?? undefined;
}

/** キー面と同じ配置で本体の位置を写す。窓内はカット時点の位置に固定し、シークやデコードに依存しない。 */
export function lightLeakCharacterSource(point: LightLeakPoint | null | undefined, dest: Rect, width: number, height: number): LightLeakPoint {
  return {
    x: Math.max(0, Math.min(1, (dest.x + (point?.x ?? 0.5) * dest.w) / width)),
    y: Math.max(0, Math.min(1, (dest.y + (point?.y ?? 0.42) * dest.h) / height)),
  };
}

/** キャラから放射状に広がる白いグロー。ピークは最遠の隅まで薄い白で包む。 */
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
  const x = source.x * w, y = source.y * h;
  const farthest = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
  const sigma = farthest * LIGHT_LEAK_RADII[fx.frame + 4]!;
  const radius = 4 * sigma;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  // ガウス状の連続減衰。外端は1階調未満でゼロへつなぎ、輪郭を残さない。
  const tail = Math.exp(-8);
  for (let i = 0; i <= 64; i++) {
    const r = i / 64;
    const alpha = (Math.exp(-8 * r * r) - tail) / (1 - tail);
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
