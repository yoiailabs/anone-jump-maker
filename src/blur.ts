/**
 * iOS / Safari は Canvas2D の `filter` が無効（caniuse: disabled by default）。
 * 縮小バッファへ箱型ぼかしを掛けてから戻す。
 */
export const CANVAS_FILTER_BLUR = "unsupported-on-safari" as const;

export const SOFTWARE_BLUR_PASSES = 2;

/**
 * 非整数倍率の縮小は細模様を低周波へ折り返すため、縮小は半分ずつに限定する。
 * 640pxの弱も1/2へ縮小する。端数のσはカーネル外周の重みで合わせる。
 * 1/2縮小・補間だけでσ≈0.866になるため、σ<1は縮小せず目標を超えないようにする。
 */
export function softwareBlurDownscale(px: number): number {
  return px < 1 ? 1 : px < 8 ? 0.5 : 0.25;
}

/** 小さいσでは分散を1パスに集め、縮小後のナイキスト周波数付近を十分に減衰させる。 */
export function softwareBlurPasses(px: number): number {
  return px >= 1 && px < 2 ? 1 : SOFTWARE_BLUR_PASSES;
}

type BlurBuffers = { tmp: Float32Array; work: Float32Array };
// scratchごとに保持し、別のプレビューや書き出しと作業領域を共有しない。
const workspaces = new WeakMap<HTMLCanvasElement, BlurBuffers>();

export function releaseSoftwareBlurBuffers(scratch: HTMLCanvasElement): void {
  workspaces.delete(scratch);
}

/**
 * px はフル解像度の目標σ。整数半径rの箱に、外周±(r+1)を重みtで足す。
 * 1パスの分散 V = (r(r+1)(2r+1)/3 + 2t(r+1)²) / (2r+1+2t)。
 * 戻り値 r+t によって整数半径の段差をなくし、全パスの分散を目標へ揃える。
 */
export function softwareBlurRadius(px: number): number {
  if (px <= 0) return 0;
  const down = softwareBlurDownscale(px);
  // 半分ずつの縮小（画素の平均）と、拡大の双線形補間の分散も差し引く。
  const resampleVariance = (1 / down ** 2 - 1) / 4;
  const variance = Math.max(0, px ** 2 - resampleVariance) * down ** 2 / softwareBlurPasses(px);
  const radius = Math.floor((Math.sqrt(1 + 12 * variance) - 1) / 2);
  const innerVarianceSum = radius * (radius + 1) * (2 * radius + 1) / 3;
  const weight = (variance * (2 * radius + 1) - innerVarianceSum) / (2 * ((radius + 1) ** 2 - variance));
  return radius + weight;
}

/**
 * RGBA 画素の分離箱型ぼかし。2 パスでガウスに近い。
 * Canvas2D `filter` を使わないので iOS でも効く。
 */
export function boxBlurRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  passes = SOFTWARE_BLUR_PASSES,
  buffers?: BlurBuffers,
): void {
  if (radius <= 0 || width < 1 || height < 1 || passes < 1) return;
  // 各軸で8bitへ丸めると、縞の位相によってDC成分まで揺れる。最終出力だけ丸める。
  const tmp = buffers?.tmp ?? new Float32Array(data.length);
  const work = buffers?.work ?? new Float32Array(data.length);
  work.set(data);
  for (let i = 0; i < passes; i += 1) {
    blurAxis(work, tmp, width, height, radius, true);
    blurAxis(tmp, work, width, height, radius, false);
  }
  data.set(work);
}

export function applySoftwareBlur(
  target: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  scratchCtx: CanvasRenderingContext2D,
  px: number,
): void {
  if (px <= 0) return;
  const w = target.width;
  const h = target.height;
  const down = softwareBlurDownscale(px);
  const sw = Math.max(8, Math.round(w * down));
  const sh = Math.max(8, Math.round(h * down));
  // 双線形補間の一段縮小で細模様を拾わないよう、各段を最大1/2縮小にする。
  // 同じバッファの左上に順次描き、追加キャンバスの確保を避ける。
  let stageW = Math.max(sw, Math.ceil(w / 2));
  let stageH = Math.max(sh, Math.ceil(h / 2));
  if (scratch.width !== stageW) scratch.width = stageW;
  if (scratch.height !== stageH) scratch.height = stageH;
  scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
  scratchCtx.filter = "none";
  scratchCtx.globalAlpha = 1;
  scratchCtx.globalCompositeOperation = "copy";
  scratchCtx.imageSmoothingEnabled = true;
  scratchCtx.drawImage(target, 0, 0, stageW, stageH);
  while (stageW > sw || stageH > sh) {
    const nextW = Math.max(sw, Math.ceil(stageW / 2));
    const nextH = Math.max(sh, Math.ceil(stageH / 2));
    scratchCtx.drawImage(scratch, 0, 0, stageW, stageH, 0, 0, nextW, nextH);
    stageW = nextW;
    stageH = nextH;
  }
  const radius = softwareBlurRadius(px);
  try {
    const image = scratchCtx.getImageData(0, 0, sw, sh);
    let buffers = workspaces.get(scratch);
    if (!buffers || buffers.work.length !== image.data.length) {
      buffers = { tmp: new Float32Array(image.data.length), work: new Float32Array(image.data.length) };
      workspaces.set(scratch, buffers);
    }
    boxBlurRgba(image.data, sw, sh, radius, softwareBlurPasses(px), buffers);
    scratchCtx.putImageData(image, 0, 0);
  } catch {
    // 汚染キャンバスなど readback できないときは縮小のまま戻し、それでもボケる
  }
  targetCtx.setTransform(1, 0, 0, 1, 0, 0);
  targetCtx.filter = "none";
  targetCtx.globalAlpha = 1;
  targetCtx.globalCompositeOperation = "source-over";
  targetCtx.imageSmoothingEnabled = true;
  // 端の拡大も半径に比例させ、プレビューだけ固定2pxで広がるのを避ける。
  const pad = px * 0.35;
  targetCtx.drawImage(scratch, 0, 0, sw, sh, -pad, -pad, w + pad * 2, h + pad * 2);
}

function blurAxis(
  src: Float32Array,
  dst: Float32Array,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): void {
  const weight = radius - Math.floor(radius);
  radius = Math.floor(radius);
  const extent = radius * 2 + 1 + weight * 2;
  // 両軸を同じループへ通し、寸法やパス数の切替でも同じ画素処理を使う。
  const lines = horizontal ? height : width;
  const length = horizontal ? width : height;
  const step = horizontal ? 4 : width * 4;
  const lineStep = horizontal ? width * 4 : 4;
  const last = length - 1;
  for (let line = 0; line < lines; line += 1) {
    const start = line * lineStep;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const i = start + clamp(k, 0, last) * step;
      r += src[i]!;
      g += src[i + 1]!;
      b += src[i + 2]!;
      a += src[i + 3]!;
    }
    for (let position = 0; position < length; position += 1) {
      const i = start + position * step;
      const out = start + Math.max(position - radius, 0) * step;
      const inn = start + Math.min(position + radius + 1, last) * step;
      const left = start + Math.max(position - radius - 1, 0) * step;
      dst[i] = (r + weight * (src[left]! + src[inn]!)) / extent;
      dst[i + 1] = (g + weight * (src[left + 1]! + src[inn + 1]!)) / extent;
      dst[i + 2] = (b + weight * (src[left + 2]! + src[inn + 2]!)) / extent;
      dst[i + 3] = (a + weight * (src[left + 3]! + src[inn + 3]!)) / extent;
      r += src[inn]! - src[out]!;
      g += src[inn + 1]! - src[out + 1]!;
      b += src[inn + 2]! - src[out + 2]!;
      a += src[inn + 3]! - src[out + 3]!;
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
