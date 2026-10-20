import { ensureCanvasSize } from "./canvas-size.ts";
import { MIST_WINDOW_FRAMES } from "./layout.ts";

const TEXTURE_SIZE = 256;
const MASK_STEPS = 32;
let masks: HTMLCanvasElement[] | undefined;
let blended: HTMLCanvasElement | undefined;

/** 呼び出し順に依存しない整数ハッシュ。カット・フレームから模様と流れを決める。 */
function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca6b) ^ Math.imul(seed, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}

function smooth(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const tx = smooth(x - ix);
  const ty = smooth(y - iy);
  const a = hash(ix, iy, seed) * (1 - tx) + hash(ix + 1, iy, seed) * tx;
  const b = hash(ix, iy + 1, seed) * (1 - tx) + hash(ix + 1, iy + 1, seed) * tx;
  return a * (1 - ty) + b * ty;
}

/** 4 オクターブの fBm と段階別のしきい値を初回だけ計算。フレーム中の画素読み戻しは不要。 */
function mistMasks(): HTMLCanvasElement[] {
  if (masks) return masks;
  const field = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      let n = 0;
      for (let octave = 0; octave < 4; octave++) {
        const frequency = 5 * 2 ** octave / TEXTURE_SIZE;
        n += noise(x * frequency, y * frequency, 71 + octave) * 0.5333 / 2 ** octave;
      }
      field[y * TEXTURE_SIZE + x] = Math.max(0, Math.min(1, (n - 0.2) / 0.6));
    }
  }
  masks = Array.from({ length: MASK_STEPS + 1 }, (_, stage) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
    const amount = stage / MASK_STEPS;
    const threshold = 1.08 - amount * 1.3;
    for (let p = 0; p < field.length; p++) {
      const n = field[p]!;
      // 頂点では不透明のまま雲の陰影を残す。散るときは薄い場所から穴が開く。
      const alpha = stage === 0 ? 0 : Math.max(smooth((n - threshold) / 0.19), smooth((amount - 0.88) / 0.12));
      const white = 222 + n * 33;
      image.data.set([white + 2, white + 1, white, alpha * 255], p * 4);
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  });
  return masks;
}

/** 縮小／拡大の柔らかなブラーと微量の明度リフト。Safari でも filter / readback は不要。 */
export function softenMistPhoto(
  main: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  { fxA, fxACtx }: { fxA: HTMLCanvasElement; fxACtx: CanvasRenderingContext2D },
  amount: number,
): void {
  const { width: w, height: h } = main;
  const down = 1 / (1 + Math.min(w, h) * 0.007 * amount);
  ensureCanvasSize(fxA, Math.max(8, Math.round(w * down)), Math.max(8, Math.round(h * down)));
  fxACtx.setTransform(1, 0, 0, 1, 0, 0);
  fxACtx.globalAlpha = 1;
  fxACtx.globalCompositeOperation = "source-over";
  fxACtx.filter = "none";
  fxACtx.imageSmoothingEnabled = true;
  fxACtx.drawImage(main, 0, 0, fxA.width, fxA.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = amount * 0.85;
  ctx.drawImage(fxA, 0, 0, w, h);
  ctx.globalAlpha = amount * 0.07;
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** 大きな余白を持つ雲を漂わせ、カット後は拡大しながら外へ流す。元の不透明フレームも保持する。 */
export function drawMist(
  main: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  cut: number,
  { amount, frame }: { amount: number; frame: number },
): void {
  const bank = mistMasks();
  const level = Math.max(0, Math.min(MASK_STEPS, amount * MASK_STEPS));
  const low = Math.floor(level);
  const blend = level - low;
  if (!blended) {
    blended = document.createElement("canvas");
    blended.width = blended.height = TEXTURE_SIZE;
  }
  const blendCtx = blended.getContext("2d")!;
  blendCtx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  blendCtx.globalCompositeOperation = "lighter";
  blendCtx.globalAlpha = 1 - blend;
  blendCtx.drawImage(bank[low]!, 0, 0);
  if (blend > 0) {
    blendCtx.globalAlpha = blend;
    blendCtx.drawImage(bank[Math.min(MASK_STEPS, low + 1)]!, 0, 0);
  }
  const { width: w, height: h } = main;
  const after = Math.max(0, frame) / MIST_WINDOW_FRAMES;
  const size = Math.max(w, h) * (1.5 + frame * 0.006 + after * 0.32);
  // カットごとの流れに、フレーム由来の連続ノイズを微量加える（ちらつかせない）。
  const dx = (hash(cut, 0, 8) - 0.5) * w * 0.16 + frame * w * 0.003 + after * w * 0.04;
  const dy = (hash(cut, 0, 9) - 0.5) * h * 0.16 - frame * h * 0.004 - after * h * 0.06
    + noise(frame / 8, cut, 11) * h * 0.008;
  ctx.save();
  ctx.translate(w / 2 + dx, h / 2 + dy);
  ctx.scale(hash(cut, 0, 10) < 0.5 ? -1 : 1, 1);
  ctx.imageSmoothingEnabled = true;
  const draw = (alpha: number, scale: number) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(blended!, -size * scale / 2, -size * scale / 2, size * scale, size * scale);
  };
  // 薄い大きな雲が輪郭の外へにじむグロー。白い一様フェードにはしない。
  ctx.globalCompositeOperation = "screen";
  draw(0.13 * amount, 1.035);
  ctx.globalCompositeOperation = "source-over";
  draw(1, 1);
  ctx.restore();
}
