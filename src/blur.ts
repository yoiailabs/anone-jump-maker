/**
 * iOS / Safari は Canvas2D の `filter` が無効（caniuse: disabled by default）。
 * 縮小バッファへ箱型ぼかしを掛けてから戻す。
 */
export const CANVAS_FILTER_BLUR = "unsupported-on-safari" as const;

export const SOFTWARE_BLUR_PASSES = 2;

/**
 * 非整数倍率の縮小は細模様を低周波へ折り返すため、縮小は半分ずつに限定する。
 * 1920pxの弱は1/2、強は1/4。端数のσはカーネル外周の重みで合わせる。
 */
export function softwareBlurDownscale(px: number): number {
  return px < 3 ? 1 : px < 8 ? 0.5 : 0.25;
}

/**
 * px はフル解像度の目標σ。整数半径rの箱に、外周±(r+1)を重みtで足す。
 * 1パスの分散 V = (r(r+1)(2r+1)/3 + 2t(r+1)²) / (2r+1+2t)。
 * 戻り値 r+t によって整数半径の段差をなくし、2パスの分散を目標へ揃える。
 */
export function softwareBlurRadius(px: number): number {
  if (px <= 0) return 0;
  const down = softwareBlurDownscale(px);
  // 半分ずつの縮小（画素の平均）と、拡大の双線形補間の分散も差し引く。
  const resampleVariance = (1 / down ** 2 - 1) / 4;
  const variance = Math.max(0, px ** 2 - resampleVariance) * down ** 2 / SOFTWARE_BLUR_PASSES;
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
): void {
  if (radius <= 0 || width < 1 || height < 1 || passes < 1) return;
  // 各軸で8bitへ丸めると、縞の位相によってDC成分まで揺れる。最終出力だけ丸める。
  const tmp = new Float32Array(data.length);
  const work = new Float32Array(data);
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
  scratch.width = stageW;
  scratch.height = stageH;
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
    boxBlurRgba(image.data, sw, sh, radius);
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
  const lastX = width - 1;
  const lastY = height - 1;
  if (horizontal) {
    for (let y = 0; y < height; y += 1) {
      const row = y * width * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const i = row + clamp(k, 0, lastX) * 4;
        r += src[i]!;
        g += src[i + 1]!;
        b += src[i + 2]!;
        a += src[i + 3]!;
      }
      for (let x = 0; x < width; x += 1) {
        const i = row + x * 4;
        const out = row + clamp(x - radius, 0, lastX) * 4;
        const inn = row + clamp(x + radius + 1, 0, lastX) * 4;
        const left = row + clamp(x - radius - 1, 0, lastX) * 4;
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
    return;
  }
  for (let x = 0; x < width; x += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const i = (clamp(k, 0, lastY) * width + x) * 4;
      r += src[i]!;
      g += src[i + 1]!;
      b += src[i + 2]!;
      a += src[i + 3]!;
    }
    for (let y = 0; y < height; y += 1) {
      const i = (y * width + x) * 4;
      const out = (clamp(y - radius, 0, lastY) * width + x) * 4;
      const inn = (clamp(y + radius + 1, 0, lastY) * width + x) * 4;
      const left = (clamp(y - radius - 1, 0, lastY) * width + x) * 4;
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
