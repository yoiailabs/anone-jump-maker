import { ensureCanvasSize } from "./canvas-size.ts";

type GlitchSurfaces = {
  fxA: HTMLCanvasElement;
  fxACtx: CanvasRenderingContext2D;
  fxB: HTMLCanvasElement;
  fxBCtx: CanvasRenderingContext2D;
};

/** カットと相対フレームだけで決まるハッシュ。再生順や呼び出し回数には依存しない。 */
function noise(cut: number, frame: number, lane: number): number {
  let x = Math.imul(cut, 0x9e3779b1) ^ Math.imul(frame, 0x85ebca6b) ^ Math.imul(lane, 0xc2b2ae35);
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 0x100000000;
}

/** 整数座標の横スライスを折り返す。左右とも全幅を一度ずつ埋め、境界の暗線を防ぐ。 */
function wrapSlice(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  y: number,
  height: number,
  offset: number,
): void {
  const w = source.width;
  const dx = ((offset % w) + w) % w;
  ctx.drawImage(source, 0, y, w - dx, height, dx, y, w - dx, height);
  if (dx > 0) ctx.drawImage(source, w - dx, y, dx, height, 0, y, dx, height);
}

function reset(ctx: CanvasRenderingContext2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.imageSmoothingEnabled = false;
}

/** 作業面を使い回し、画素の読み戻しなしでスライス・短いブロック・RGB ずれを描く。 */
export function drawGlitch(
  main: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  { fxA, fxACtx, fxB, fxBCtx }: GlitchSurfaces,
  cut: number,
  { amount, frame }: { amount: number; frame: number },
): void {
  const w = main.width;
  const h = main.height;
  const short = Math.min(w, h);
  ensureCanvasSize(fxA, w, h);
  ensureCanvasSize(fxB, w, h);
  reset(fxACtx);
  reset(fxBCtx);
  fxACtx.drawImage(main, 0, 0);
  fxBCtx.drawImage(main, 0, 0);

  const rand = (lane: number) => noise(cut, frame, lane);
  for (let i = 0; i < 6; i++) {
    const bh = Math.min(h, Math.max(1, Math.round(short * (0.006 + rand(i * 3) * 0.022))));
    const y = Math.floor(rand(i * 3 + 1) * (h - bh + 1));
    const dx = Math.round((rand(i * 3 + 2) * 2 - 1) * short * 0.045 * amount);
    wrapSlice(fxBCtx, fxA, y, bh, dx);
  }

  // 小さな写真断片に薄い色を足す。全画面のランダムノイズ・強い白黒明滅は使わない。
  for (let i = 0; i < 3; i++) {
    const bw = Math.min(w, Math.max(1, Math.round(short * (0.025 + rand(30 + i) * 0.08))));
    const bh = Math.min(h, Math.max(1, Math.round(short * (0.005 + rand(40 + i) * 0.02))));
    const x = Math.floor(rand(50 + i) * (w - bw + 1));
    const y = Math.floor(rand(60 + i) * (h - bh + 1));
    const sx = Math.floor(rand(70 + i) * (w - bw + 1));
    fxBCtx.globalAlpha = amount * 0.65;
    fxBCtx.drawImage(fxA, sx, y, bw, bh, x, y, bw, bh);
    fxBCtx.globalAlpha = amount * 0.08;
    fxBCtx.globalCompositeOperation = "lighter";
    fxBCtx.fillStyle = i % 2 === 0 ? "#d06880" : "#68a0c0";
    fxBCtx.fillRect(x, y, bw, bh);
    reset(fxBCtx);
  }

  const rgb = Math.max(1, Math.round(short * 0.006 * amount));
  const direction = rand(80) < 0.5 ? -1 : 1;
  ctx.save();
  reset(ctx);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  for (const [color, dx] of [["#ff0000", rgb * direction], ["#00ff00", 0], ["#0000ff", -rgb * direction]] as const) {
    reset(fxACtx);
    fxACtx.drawImage(fxB, 0, 0);
    fxACtx.globalCompositeOperation = "multiply";
    fxACtx.fillStyle = color;
    fxACtx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    wrapSlice(ctx, fxA, 0, h, dx);
  }
  ctx.restore();
}
