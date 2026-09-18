import { keyImageDataWasm } from "./pixel-wasm.ts";

/** Adaptive near-solid background key + mild green chroma assist. */

export const KEY_PARAMS = {
  /** RGB distance (0–255) treated as background. */
  tolerance: 38,
  /** Soft edge width in RGB distance. */
  softness: 22,
  /** Keep pixels darker than this fully opaque (line art). */
  darkProtect: 48,
  /** Extra transparency when G exceeds max(R,B) by this much. */
  greenBoost: 18,
  greenSoft: 40,
} as const;

export function colorDistance(
  r: number,
  g: number,
  b: number,
  kr: number,
  kg: number,
  kb: number,
): number {
  const dr = r - kr;
  const dg = g - kg;
  const db = b - kb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function luma(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

/** 0 = fully keyed (transparent), 1 = keep foreground. */
export function keyAlpha(
  r: number,
  g: number,
  b: number,
  kr: number,
  kg: number,
  kb: number,
  params = KEY_PARAMS,
): number {
  const dist = colorDistance(r, g, b, kr, kg, kb);
  let alpha = clamp01((dist - params.tolerance) / params.softness);
  const greenScreen = Math.max(0, g - Math.max(r, b));
  const greenKill = clamp01((greenScreen - params.greenBoost) / params.greenSoft) * 0.85;
  alpha = Math.min(alpha, 1 - greenKill);
  if (luma(r, g, b) < params.darkProtect) {
    alpha = 1;
  }
  return alpha;
}

export function despill(
  r: number,
  g: number,
  b: number,
  kr: number,
  kg: number,
  kb: number,
  params = KEY_PARAMS,
): [number, number, number] {
  const dist = colorDistance(r, g, b, kr, kg, kb);
  const spill = 1 - clamp01((dist - params.tolerance * 0.4) / (params.tolerance + params.softness));
  const y = luma(r, g, b);
  const t = spill * 0.7;
  return [r + (y - r) * t, g + (y - g) * t, b + (y - b) * t];
}

export function sampleKeyColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): [number, number, number] {
  const points: Array<[number, number]> = [
    [2, 2],
    [width - 3, 2],
    [Math.floor(width / 2), 3],
    [Math.floor(width * 0.15), Math.floor(height * 0.04)],
    [Math.floor(width * 0.85), Math.floor(height * 0.04)],
    [2, height - 3],
    [width - 3, height - 3],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of points) {
    const i = (y * width + x) * 4;
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  const n = points.length;
  return [r / n, g / n, b / n];
}

/** In-place RGBA key. Returns the sampled key color. */
export function keyImageData(image: ImageData, params = KEY_PARAMS): [number, number, number] {
  const key = sampleKeyColor(image.data, image.width, image.height);
  if (params === KEY_PARAMS && keyImageDataWasm(image)) {
    return key;
  }
  return keyImageDataJs(image, params);
}

/** JS 参照実装。WASM が使えないときとテスト用。 */
export function keyImageDataJs(image: ImageData, params = KEY_PARAMS): [number, number, number] {
  const { data, width, height } = image;
  const key = sampleKeyColor(data, width, height);
  const [kr, kg, kb] = key;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = keyAlpha(r, g, b, kr, kg, kb, params);
    const [nr, ng, nb] = despill(r, g, b, kr, kg, kb, params);
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
    data[i + 3] = Math.round(a * 255);
  }
  return key;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
