import { t, type Locale, type MessageKey } from "./i18n.ts";

export const COLOR_FILTERS = ["none", "dramatic", "dynamic", "sepia", "mono", "film", "cool", "warm"] as const;
export type ColorFilter = (typeof COLOR_FILTERS)[number];

export function isColorFilter(value: string): value is ColorFilter {
  return (COLOR_FILTERS as readonly string[]).includes(value);
}

const LABEL_KEYS: Record<ColorFilter, MessageKey> = {
  none: "makerFilterNone",
  dramatic: "makerFilterDramatic",
  dynamic: "makerFilterDynamic",
  sepia: "makerFilterSepia",
  mono: "makerFilterMono",
  film: "makerFilterFilm",
  cool: "makerFilterCool",
  warm: "makerFilterWarm",
};

export function colorFilterLabel(filter: ColorFilter, locale: Locale): string {
  return t(locale, LABEL_KEYS[filter]);
}

type Recipe = {
  saturation: number;
  contrast: number;
  gamma: number;
  lift: number;
  gain: readonly [number, number, number];
};

/** sRGB のトーン調整。cool/warm は色温度の違いを明確にし、空や肌の色を保つ。 */
export const COLOR_FILTER_RECIPES: Record<ColorFilter, Recipe> = {
  none: { saturation: 1, contrast: 1, gamma: 1, lift: 0, gain: [1, 1, 1] },
  dramatic: { saturation: 0.82, contrast: 1.18, gamma: 1.06, lift: 0, gain: [1, 1, 1] },
  dynamic: { saturation: 1.18, contrast: 1.12, gamma: 1, lift: 0, gain: [1, 1, 1] },
  sepia: { saturation: 0.12, contrast: 0.94, gamma: 1, lift: 4, gain: [1.08, 1, 0.84] },
  mono: { saturation: 0, contrast: 1.06, gamma: 1, lift: 0, gain: [1, 1, 1] },
  film: { saturation: 0.78, contrast: 0.88, gamma: 1, lift: 10, gain: [1.03, 1, 0.96] },
  cool: { saturation: 1, contrast: 1.05, gamma: 1, lift: 0, gain: [0.9, 0.98, 1.1] },
  warm: { saturation: 0.95, contrast: 0.94, gamma: 1, lift: 6, gain: [1.12, 1.01, 0.9] },
};

const clamp = (v: number) => Math.max(0, Math.min(255, v));
const LUMA = [0.2126, 0.7152, 0.0722] as const;

/** 行列の積を 8bit 固定小数の参照表にし、画素ループから乗算を外す。 */
export function buildColorTransform(filter: ColorFilter) {
  const recipe = COLOR_FILTER_RECIPES[filter];
  const matrix = Array.from({ length: 3 }, (_, row) =>
    LUMA.map((weight, col) => (1 - recipe.saturation) * weight + (row === col ? recipe.saturation : 0)),
  );
  const contributions = matrix.flatMap((row) => row.map((weight) =>
    Int32Array.from({ length: 256 }, (_, i) => Math.round(weight * i * 256)),
  ));
  const lut = recipe.gain.map((gain) => Uint8Array.from({ length: 256 }, (_, i) => {
    const tone = (Math.pow(i / 255, recipe.gamma) - 0.5) * recipe.contrast + 0.5;
    return Math.round(clamp(tone * (255 - recipe.lift) * gain + recipe.lift));
  }));
  return { matrix, contributions, lut };
}

const TRANSFORMS = Object.fromEntries(COLOR_FILTERS.map((filter) => [filter, buildColorTransform(filter)])) as
  Record<ColorFilter, ReturnType<typeof buildColorTransform>>;

/** アルファは保持。none は画素に触れず、そのまま返す。プレビュー・保存で共用。 */
export function applyColorFilter(data: Uint8ClampedArray, filter: ColorFilter): void {
  if (filter === "none") return;
  const { contributions: c, lut } = TRANSFORMS[filter];
  const [rr, rg, rb, gr, gg, gb, br, bg, bb] = c as [Int32Array, Int32Array, Int32Array, Int32Array, Int32Array, Int32Array, Int32Array, Int32Array, Int32Array];
  const [rLut, gLut, bLut] = lut as [Uint8Array, Uint8Array, Uint8Array];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    data[i] = rLut[clamp((rr[r]! + rg[g]! + rb[b]! + 128) >> 8)]!;
    data[i + 1] = gLut[clamp((gr[r]! + gg[g]! + gb[b]! + 128) >> 8)]!;
    data[i + 2] = bLut[clamp((br[r]! + bg[g]! + bb[b]! + 128) >> 8)]!;
  }
}

/** 現在の写真だけを保持する。最大 2880²×4 ≒ 32MiB、画素配列は生成時だけ。 */
export function createColorPhotoCache() {
  let cachedSource: ImageBitmap | undefined;
  let cachedFilter: ColorFilter = "none";
  let canvas: HTMLCanvasElement | undefined;
  const clear = () => {
    if (canvas) canvas.width = canvas.height = 0;
    canvas = undefined;
    cachedSource = undefined;
    cachedFilter = "none";
  };
  return {
    clear,
    get(source: ImageBitmap | undefined, filter: ColorFilter): ImageBitmap | HTMLCanvasElement | undefined {
      if (!source || filter === "none") {
        clear();
        return source;
      }
      if (cachedSource === source && cachedFilter === filter) return canvas!;
      clear();
      const next = document.createElement("canvas");
      next.width = source.width;
      next.height = source.height;
      const ctx = next.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas2D が使えません");
      ctx.drawImage(source, 0, 0);
      const image = ctx.getImageData(0, 0, next.width, next.height);
      applyColorFilter(image.data, filter);
      ctx.putImageData(image, 0, 0);
      cachedSource = source;
      cachedFilter = filter;
      canvas = next;
      return canvas;
    },
  };
}
