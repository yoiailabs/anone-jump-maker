import { ensureCanvasSize } from "./canvas-size.ts";
import type { SwapFx } from "./layout.ts";

/** 短辺135pxの作業面を縦横で共用し、写真とキャラに同じ光を使う。 */
export const LIGHT_LEAK_SHORT_SIDE = 135;
export const LIGHT_LEAK_CHARACTER_GAIN = 0.2;
export const LIGHT_LEAK_PHOTO_GAIN = 0.86;

// 芯は淡い暖色、外側はアンバー→オレンジ→ピンク。白い全面フラッシュにはしない。
export const LIGHT_LEAK_PALETTES = [
  ["#fff1cc", "#ffc16b", "#ff681c", "#f02c83"],
  ["#fff0d8", "#ffaf59", "#ff7b28", "#ed397c"],
  ["#fff4d4", "#ffd080", "#ff8429", "#e93791"],
  ["#ffe9d0", "#ffb776", "#ff582d", "#ed438c"],
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
  // ピークでは入口から18%、その後は反対側の外まで抜ける。
  const travel = progress <= 0.5 ? -0.32 + progress : 0.18 + (progress - 0.5) * 2.14;
  const edge = seed % 4;
  const cross = 0.24 + unit(31) * 0.25 + (progress - 0.5) * (unit(53) - 0.5) * 0.3;
  return {
    palette: LIGHT_LEAK_PALETTES[hash(seed ^ 17) % LIGHT_LEAK_PALETTES.length]!,
    edge,
    x: edge === 1 || edge === 3 ? 1 - travel : travel,
    y: edge >= 2 ? travel : cross,
    radiusX: (0.4 + unit(71) * 0.08) * (0.8 + progress * 0.4),
    radiusY: (0.53 + unit(97) * 0.1) * (0.8 + progress * 0.4),
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
    ctx.globalAlpha = [0.95, 0.62, 0.4][blob]!;
    const offset = blob * 0.1;
    const direction = plan.edge === 1 || plan.edge === 3 ? -1 : 1;
    ctx.translate((plan.x - offset * direction) * w, (plan.y + offset) * h);
    ctx.scale(plan.radiusX * w * (1 - blob * 0.14), plan.radiusY * h * (1 - blob * 0.12));
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, plan.palette[0]);
    gradient.addColorStop(0.12, plan.palette[1]);
    gradient.addColorStop(0.36, plan.palette[2]);
    gradient.addColorStop(0.66, plan.palette[3]);
    gradient.addColorStop(1, "#ed398000");
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
