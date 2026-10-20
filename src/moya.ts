import { ensureCanvasSize } from "./canvas-size.ts";
import type { SwapFx } from "./layout.ts";

export const MOYA_AMPLITUDE = 0.022;
export const MOYA_BANDS = 32;
export const MOYA_MASK_SIZE = 48;
export const MOYA_MASK_FEATHER = 0.16;
/** 縮小・拡大で作る軽いボケの最大画素幅（短辺比）。 */
export const MOYA_SOFTNESS = 0.003;

export type MoyaMask = ReturnType<typeof createMoyaMask>;
type MoyaSurfaces = {
  fxA: HTMLCanvasElement;
  fxACtx: CanvasRenderingContext2D;
  fxB: HTMLCanvasElement;
  fxBCtx: CanvasRenderingContext2D;
  fxPad: HTMLCanvasElement;
  fxPadCtx: CanvasRenderingContext2D;
  blur: HTMLCanvasElement;
  blurCtx: CanvasRenderingContext2D;
};

/** カットと相対フレームの整数ハッシュ。雲は frame=0 に固定して沸騰を防ぐ。 */
function hash(cut: number, frame: number, lane: number): number {
  let x = Math.imul(cut, 0x9e3779b1) ^ Math.imul(frame, 0x85ebca6b) ^ Math.imul(lane, 0xc2b2ae35);
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 0x100000000;
}

function smooth(value: number): number {
  const u = Math.max(0, Math.min(1, value));
  return u * u * (3 - 2 * u);
}

function valueNoise(x: number, y: number, cut: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const u = smooth(x - ix);
  const v = smooth(y - iy);
  const at = (dx: number, dy: number) => hash(cut, 0, (ix + dx) + (iy + dy) * 101);
  const a = at(0, 0) * (1 - u) + at(1, 0) * u;
  const b = at(0, 1) * (1 - u) + at(1, 1) * u;
  return a * (1 - v) + b * v;
}

/** compositor ごとに一度だけ作る。読み戻しやフレームごとのキャンバス生成は不要。 */
export function createMoyaMask() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = MOYA_MASK_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas2D が使えません");
  const image = ctx.createImageData(MOYA_MASK_SIZE, MOYA_MASK_SIZE);
  return { canvas, ctx, image };
}

/** 新写真のアルファだけを雲状に切り抜く。端点は完全な旧／新になる。 */
export function maskMoyaPhoto(
  photo: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  mask: MoyaMask,
  cut: number,
  mix: number,
): void {
  if (mix >= 1) return;
  if (mix <= 0) {
    ctx.clearRect(0, 0, photo.width, photo.height);
    return;
  }
  const short = Math.min(photo.width, photo.height);
  const sx = 4 * photo.width / short;
  const sy = 4 * photo.height / short;
  const { data } = mask.image;
  for (let y = 0; y < MOYA_MASK_SIZE; y++) {
    for (let x = 0; x < MOYA_MASK_SIZE; x++) {
      const nx = x / (MOYA_MASK_SIZE - 1) * sx;
      const ny = y / (MOYA_MASK_SIZE - 1) * sy;
      const noise = 0.75 * valueNoise(nx, ny, cut) + 0.25 * valueNoise(nx * 2 + 13, ny * 2 + 7, cut);
      const a = smooth((mix * (1 + 2 * MOYA_MASK_FEATHER) - noise) / (2 * MOYA_MASK_FEATHER));
      const i = (y * MOYA_MASK_SIZE + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  mask.ctx.putImageData(mask.image, 0, 0);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "destination-in";
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(mask.canvas, 0, 0, photo.width, photo.height);
  ctx.restore();
}

function reset(ctx: CanvasRenderingContext2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.imageSmoothingEnabled = true;
}

/** 四辺と四隅を端の画素で延長し、縦横の変位でも下地の隙間を作らない。 */
function padFrame(source: HTMLCanvasElement, surfaces: MoyaSurfaces, pad: number): HTMLCanvasElement {
  const { fxPad, fxPadCtx: ctx } = surfaces;
  const w = source.width;
  const h = source.height;
  ensureCanvasSize(fxPad, w + pad * 2, h + pad * 2);
  reset(ctx);
  ctx.imageSmoothingEnabled = false;
  for (const [sx, sw, dx, dw] of [[0, 1, 0, pad], [0, w, pad, w], [w - 1, 1, pad + w, pad]]) {
    for (const [sy, sh, dy, dh] of [[0, 1, 0, pad], [0, h, pad, h], [h - 1, 1, pad + h, pad]]) {
      ctx.drawImage(source, sx!, sy!, sw!, sh!, dx!, dy!, dw!, dh!);
    }
  }
  return fxPad;
}

/** 写真合成後・フィルターとキャラより前。32帯を線形シアーでつなぎ、境界の段差を防ぐ。 */
export function warpMoyaPhoto(
  main: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  surfaces: MoyaSurfaces,
  cut: number,
  { amount, frame }: NonNullable<SwapFx["moya"]>,
): void {
  const w = main.width;
  const h = main.height;
  const short = Math.min(w, h);
  const amp = short * MOYA_AMPLITUDE * amount;
  const pad = Math.ceil(amp) + 2;
  const { fxA, fxACtx, fxB, fxBCtx, blur, blurCtx } = surfaces;
  ensureCanvasSize(fxA, w, h);
  ensureCanvasSize(fxB, w, h);
  reset(fxACtx);
  reset(fxBCtx);
  fxACtx.drawImage(main, 0, 0);
  // シード位相を固定し、整数フレームで連続的に流す。再シークも呼出順に依存しない。
  const phaseFrame = Math.floor(frame / 8) * 8;
  const driftMix = smooth((frame - phaseFrame) / 8);
  const drift = hash(cut, phaseFrame, 702) * (1 - driftMix) + hash(cut, phaseFrame + 8, 702) * driftMix;
  const phase = hash(cut, 0, 701) * Math.PI * 2 + drift * 0.3;
  const wave = (u: number, axis: number) => amp * (
    0.62 * Math.sin(u * Math.PI * 2.1 + phase + frame * 0.25 + axis) +
    0.27 * Math.sin(u * Math.PI * 5.3 - phase * 0.7 - frame * 0.17 + axis) +
    0.11 * Math.sin(u * Math.PI * 9.1 + phase * 1.3 + frame * 0.12 + axis));
  let padded = padFrame(fxA, surfaces, pad);
  for (let band = 0; band < MOYA_BANDS; band++) {
    const y = Math.round(band * h / MOYA_BANDS);
    const end = Math.round((band + 1) * h / MOYA_BANDS);
    if (end === y) continue;
    const a = wave(y / h, 0);
    const slope = (wave(end / h, 0) - a) / (end - y);
    fxBCtx.setTransform(1, 0, slope, 1, a - slope * y, 0);
    fxBCtx.drawImage(padded, 0, pad + y, w + pad * 2, end - y, -pad, y, w + pad * 2, end - y);
  }
  padded = padFrame(fxB, surfaces, pad);
  reset(ctx);
  for (let band = 0; band < MOYA_BANDS; band++) {
    const x = Math.round(band * w / MOYA_BANDS);
    const end = Math.round((band + 1) * w / MOYA_BANDS);
    if (end === x) continue;
    const a = wave(x / w, 2.3);
    const slope = (wave(end / w, 2.3) - a) / (end - x);
    ctx.setTransform(1, slope, 0, 1, 0, a - slope * x);
    ctx.drawImage(padded, pad + x, 0, end - x, h + pad * 2, x, -pad, end - x, h + pad * 2);
  }
  reset(ctx);
  // Canvas2D.filter が無効な Safari でも効く、弱い縮小ボケを混ぜる。
  const soft = Math.max(1, short * MOYA_SOFTNESS);
  const down = 1 / (1 + soft);
  ensureCanvasSize(blur, Math.max(1, Math.round(w * down)), Math.max(1, Math.round(h * down)));
  reset(blurCtx);
  blurCtx.drawImage(main, 0, 0, blur.width, blur.height);
  ctx.globalAlpha = amount * 0.65;
  ctx.drawImage(blur, 0, 0, w, h);
  reset(ctx);
}
