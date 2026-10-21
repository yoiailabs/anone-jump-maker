import { ensureCanvasSize } from "./canvas-size.ts";
import { glitchNoise, glitchStyle } from "./glitch-style.ts";
export { glitchStyle } from "./glitch-style.ts";

type GlitchSurfaces = {
  fxA: HTMLCanvasElement;
  fxACtx: CanvasRenderingContext2D;
  fxB: HTMLCanvasElement;
  fxBCtx: CanvasRenderingContext2D;
};

/** 整数座標の横スライスを折り返す。左右とも全幅を一度ずつ埋め、境界の暗線を防ぐ。 */
function wrapSlice(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  y: number,
  height: number,
  offset: number,
  targetY = y,
): void {
  const w = source.width;
  const dx = ((offset % w) + w) % w;
  ctx.drawImage(source, 0, y, w - dx, height, dx, targetY, w - dx, height);
  if (dx > 0) ctx.drawImage(source, w - dx, y, dx, height, 0, targetY, dx, height);
}

/** 縦ずれも整数の折り返しで埋める。追加の作業面や拡大補間を使わない。 */
function wrapPlane(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, dx: number, offsetY: number): void {
  const h = source.height;
  const dy = ((offsetY % h) + h) % h;
  wrapSlice(ctx, source, 0, h - dy, dx, dy);
  if (dy > 0) wrapSlice(ctx, source, h - dy, dy, dx, 0);
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
  const style = glitchStyle(cut);
  const power = amount * style.strength;
  const before = frame < 0;
  const jitter = before ? Math.round(short * style.jitter * power) * (frame % 2 === 0 ? -1 : 1) : 0;
  wrapPlane(fxACtx, main, 0, jitter);
  fxBCtx.drawImage(fxA, 0, 0);

  const rand = (lane: number) => glitchNoise(cut, frame, lane);
  const sliceCount = before ? Math.round(2 + (style.slices - 2) * amount) : 2 + Math.floor(rand(90) * 2);
  for (let i = 0; i < sliceCount; i++) {
    const thickness = before ? (style.thickness[0] + rand(i * 3) * (style.thickness[1] - style.thickness[0])) * power : 0.003 + rand(i * 3) * 0.006;
    const bh = Math.min(h, Math.max(1, Math.round(short * thickness)));
    const y = Math.floor(rand(i * 3 + 1) * (h - bh + 1));
    const offset = before ? 0.1 + rand(i * 3 + 2) * 0.08 : 0.03;
    const direction = style.direction || (i % 2 === 0 ? -1 : 1);
    const dx = Math.round(direction * short * offset * power);
    wrapSlice(fxBCtx, fxA, y, bh, dx);
  }

  // 小さな写真断片に薄い色を足す。全画面のランダムノイズ・強い白黒明滅は使わない。
  for (let i = 0; before && i < style.fragments; i++) {
    const bw = Math.min(w, Math.max(1, Math.round(short * (0.025 + rand(30 + i) * 0.08))));
    const bh = Math.min(h, Math.max(1, Math.round(short * (0.005 + rand(40 + i) * 0.02))));
    const x = Math.floor(rand(50 + i) * (w - bw + 1));
    const y = Math.round(Math.max(0, Math.min(1, style.fragmentBand + (rand(60 + i) - 0.5) * 0.5)) * (h - bh));
    const sx = Math.floor(rand(70 + i) * (w - bw + 1));
    fxBCtx.globalAlpha = Math.min(0.85, power * 0.65);
    fxBCtx.drawImage(fxA, sx, y, bw, bh, x, y, bw, bh);
    fxBCtx.globalAlpha = power * 0.08;
    fxBCtx.globalCompositeOperation = "lighter";
    fxBCtx.fillStyle = i % 2 === 0 ? "#d06880" : "#68a0c0";
    fxBCtx.fillRect(x, y, bw, bh);
    reset(fxBCtx);
  }

  const rgb = Math.max(1, Math.round(short * (before ? 0.016 : 0.004) * power * style.rgbScale));
  const rgbY = Math.round(rgb * style.rgbVertical);
  ctx.save();
  reset(ctx);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const colors = ["#ff0000", "#00ff00", "#0000ff"];
  for (let channel = 0; channel < 3; channel++) {
    const displacement = [1, 0, -1][(channel - style.rgbLead + 3) % 3]!;
    const dx = rgb * style.rgbDirection * displacement;
    reset(fxACtx);
    fxACtx.drawImage(fxB, 0, 0);
    fxACtx.globalCompositeOperation = "multiply";
    fxACtx.fillStyle = colors[channel]!;
    fxACtx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    wrapPlane(ctx, fxA, dx, rgbY * displacement);
  }
  ctx.restore();
}
