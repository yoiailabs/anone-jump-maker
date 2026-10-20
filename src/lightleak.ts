import { ensureCanvasSize } from "./canvas-size.ts";
import type { SwapFx } from "./layout.ts";

/** 短辺135pxの作業面を縦横で共用し、写真とキャラに同じ光を使う。 */
export const LIGHT_LEAK_SHORT_SIDE = 135;
export const LIGHT_LEAK_CHARACTER_GAIN = 0.2;
export const LIGHT_LEAK_PHOTO_GAIN = 0.95;

// アンバーとオレンジを主役にし、ピンクはごく薄い外縁だけに使う。
export const LIGHT_LEAK_PALETTES = [
  ["#ffe6af", "#ffd27a", "#ff9a3c", "#ff6a2a", "#f02c83"],
  ["#ffe3b0", "#ffc36b", "#ff942f", "#ff7028", "#ed397c"],
  ["#ffe9b8", "#ffd080", "#ffa343", "#ff7829", "#e93791"],
  ["#ffe0a6", "#ffc776", "#ff963a", "#ff682d", "#ed438c"],
] as const;

/** 整数カット番号だけから選ぶ。呼び出し順・時刻・乱数源には依存しない。 */
function hash(value: number): number {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

export function lightLeakPlan(cutIndex: number, frame: number) {
  const seed = hash(cutIndex);
  const unit = (salt: number) => hash(seed ^ salt) / 0x100000000;
  const progress = Math.max(0, Math.min(1, (frame + 4) / 8));
  // 外から差し込み、ピークで13〜17%。余韻は8%だけ奥へ流し、入口側に残す。
  const peak = 0.13 + unit(11) * 0.04;
  const travel = progress <= 0.5
    ? -0.22 + progress * 2 * (peak + 0.22)
    : peak + (progress - 0.5) * 0.16;
  const edge = seed % 4;
  const cross = 0.23 + unit(31) * 0.13 + (progress - 0.5) * (unit(53) - 0.5) * 0.08;
  const right = edge === 1 || edge === 3;
  const growth = 0.9 + progress * 0.16;
  return {
    palette: LIGHT_LEAK_PALETTES[hash(seed ^ 17) % LIGHT_LEAK_PALETTES.length]!,
    edge,
    x: edge >= 2 ? (right ? 1 - cross : cross) : (right ? 1 - travel : travel),
    y: edge >= 2 ? travel : cross,
    radiusX: (edge >= 2 ? 0.75 + unit(71) * 0.1 : 0.31 + unit(71) * 0.05) * growth,
    radiusY: (edge >= 2 ? 0.28 + unit(97) * 0.04 : 0.85 + unit(97) * 0.1) * growth,
  };
}

/** 小さな透明面に三つの柔らかい楕円を描く。画素の読み戻しはしない。 */
export function paintLightLeak(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cutIndex: number,
  fx: NonNullable<SwapFx["lightleak"]>,
): void {
  const scale = LIGHT_LEAK_SHORT_SIDE / Math.min(width, height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  ensureCanvasSize(canvas, w, h);
  ctx.clearRect(0, 0, w, h);
  const plan = lightLeakPlan(cutIndex, fx.frame);
  for (let blob = 0; blob < 3; blob++) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = [1, 0.55, 0.35][blob]!;
    const direction = plan.edge === 1 || plan.edge === 3 ? -1 : 1;
    // 副光は端へ寄せつつ長辺方向へずらし、三つの同心円にしない。
    const along = [0, -0.19, 0.24][blob]!;
    const inward = [0, -0.08, -0.04][blob]!;
    ctx.translate(
      (plan.x + (plan.edge >= 2 ? along * direction : inward * direction)) * w,
      (plan.y + (plan.edge >= 2 ? inward : along)) * h,
    );
    ctx.scale(plan.radiusX * w * [1, 0.72, 0.88][blob]!, plan.radiusY * h * [1, 0.86, 0.65][blob]!);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    // 色とアルファを一緒に減衰。近白の芯を小さく、外縁のピンクは数%以下にする。
    // 副光の芯はアンバー／オレンジへずらし、主光と色も少し変える。
    gradient.addColorStop(0, `${plan.palette[blob]}f2`);
    gradient.addColorStop(0.04, `${plan.palette[Math.max(1, blob)]}eb`);
    gradient.addColorStop(0.22, `${plan.palette[2]}c7`);
    gradient.addColorStop(0.45, `${plan.palette[3]}73`);
    gradient.addColorStop(0.68, `${plan.palette[3]}2e`);
    gradient.addColorStop(0.82, `${plan.palette[4]}0d`);
    gradient.addColorStop(1, `${plan.palette[4]}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
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
