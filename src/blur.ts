/**
 * iOS / Safari は Canvas2D の `filter` が無効（caniuse: disabled by default）。
 * 縮小バッファへ箱型ぼかしを掛けてから戻す。
 */
export const CANVAS_FILTER_BLUR = "unsupported-on-safari" as const;

export const SOFTWARE_BLUR_QUALITY = {
  full: "full",
  preview: "preview",
} as const;

export type SoftwareBlurQuality = (typeof SOFTWARE_BLUR_QUALITY)[keyof typeof SOFTWARE_BLUR_QUALITY];

/** 保存 / オフライン encode。2 パスの現行品質。 */
export const EXPORT_BLUR_QUALITY = SOFTWARE_BLUR_QUALITY.full;

/** 画面上のライブ合成だけ安い近似。 */
export const PREVIEW_BLUR_QUALITY = SOFTWARE_BLUR_QUALITY.preview;

/** 保存の箱型ぼかしパス数。2 でガウスに近い。 */
export const SOFTWARE_BLUR_PASSES = 2;

/** プレビューは 1 パス。 */
export const PREVIEW_SOFTWARE_BLUR_PASSES = 1;

/** プレビューの半径倍率。保存の半分。 */
export const PREVIEW_SOFTWARE_BLUR_RADIUS_SCALE = 0.5;

/** プレビューは縮小バッファをさらに半分にする。 */
export const PREVIEW_SOFTWARE_BLUR_DOWNSCALE = 0.5;

/** プレビュー縮小の下限。小さすぎると塊になる。 */
export const PREVIEW_SOFTWARE_BLUR_MIN_DOWNSCALE = 0.08;

export type SoftwareBlurSettings = {
  quality: SoftwareBlurQuality;
  px: number;
  passes: number;
  downscale: number;
};

/** 半径に対する縮小率。小さいほど強いボケで、画素処理も軽い。 */
export function softwareBlurDownscale(px: number): number {
  if (px < 1) return 1;
  return Math.max(0.14, Math.min(0.5, 6 / px));
}

export function isSoftwareBlurQuality(value: string): value is SoftwareBlurQuality {
  return value === SOFTWARE_BLUR_QUALITY.full || value === SOFTWARE_BLUR_QUALITY.preview;
}

/**
 * プレビューは半径半分・1 パス・より強い縮小。
 * 保存は現行の半径・2 パス・現行縮小のまま。
 */
export function resolveSoftwareBlurSettings(
  px: number,
  quality: SoftwareBlurQuality = EXPORT_BLUR_QUALITY,
): SoftwareBlurSettings {
  if (!(px >= 1)) {
    return { quality, px: 0, passes: 0, downscale: 1 };
  }
  const preview = quality === SOFTWARE_BLUR_QUALITY.preview;
  const radiusPx = preview ? Math.max(1, Math.round(px * PREVIEW_SOFTWARE_BLUR_RADIUS_SCALE)) : px;
  const down = softwareBlurDownscale(px) * (preview ? PREVIEW_SOFTWARE_BLUR_DOWNSCALE : 1);
  return {
    quality,
    px: radiusPx,
    passes: preview ? PREVIEW_SOFTWARE_BLUR_PASSES : SOFTWARE_BLUR_PASSES,
    downscale: preview ? Math.max(PREVIEW_SOFTWARE_BLUR_MIN_DOWNSCALE, down) : down,
  };
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
  if (radius < 1 || width < 1 || height < 1 || passes < 1) return;
  const tmp = new Uint8ClampedArray(data.length);
  for (let i = 0; i < passes; i += 1) {
    blurAxis(data, tmp, width, height, radius, true);
    blurAxis(tmp, data, width, height, radius, false);
  }
}

export function applySoftwareBlur(
  target: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  scratchCtx: CanvasRenderingContext2D,
  px: number,
  quality: SoftwareBlurQuality = EXPORT_BLUR_QUALITY,
): void {
  const settings = resolveSoftwareBlurSettings(px, quality);
  if (settings.px < 1 || settings.passes < 1) return;
  const w = target.width;
  const h = target.height;
  const sw = Math.max(8, Math.round(w * settings.downscale));
  const sh = Math.max(8, Math.round(h * settings.downscale));
  scratch.width = sw;
  scratch.height = sh;
  scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
  scratchCtx.filter = "none";
  scratchCtx.globalAlpha = 1;
  scratchCtx.globalCompositeOperation = "source-over";
  scratchCtx.imageSmoothingEnabled = true;
  scratchCtx.drawImage(target, 0, 0, sw, sh);
  const radius = Math.max(1, Math.round(settings.px * settings.downscale));
  try {
    const image = scratchCtx.getImageData(0, 0, sw, sh);
    boxBlurRgba(image.data, sw, sh, radius, settings.passes);
    scratchCtx.putImageData(image, 0, 0);
  } catch {
    // 汚染キャンバスなど readback できないときは縮小のまま戻し、それでもボケる
  }
  targetCtx.setTransform(1, 0, 0, 1, 0, 0);
  targetCtx.filter = "none";
  targetCtx.globalAlpha = 1;
  targetCtx.globalCompositeOperation = "source-over";
  targetCtx.imageSmoothingEnabled = true;
  const pad = Math.max(2, Math.round(settings.px * 0.35));
  targetCtx.drawImage(scratch, -pad, -pad, w + pad * 2, h + pad * 2);
}

function blurAxis(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): void {
  const extent = radius * 2 + 1;
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
        dst[i] = Math.round(r / extent);
        dst[i + 1] = Math.round(g / extent);
        dst[i + 2] = Math.round(b / extent);
        dst[i + 3] = Math.round(a / extent);
        const out = row + clamp(x - radius, 0, lastX) * 4;
        const inn = row + clamp(x + radius + 1, 0, lastX) * 4;
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
      dst[i] = Math.round(r / extent);
      dst[i + 1] = Math.round(g / extent);
      dst[i + 2] = Math.round(b / extent);
      dst[i + 3] = Math.round(a / extent);
      const out = (clamp(y - radius, 0, lastY) * width + x) * 4;
      const inn = (clamp(y + radius + 1, 0, lastY) * width + x) * 4;
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
