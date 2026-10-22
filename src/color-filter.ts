import { t, type Locale, type MessageKey } from "./i18n.ts";

export const COLOR_FILTERS = ["none", "dynamic", "dramatic", "film"] as const;
export type ColorFilter = (typeof COLOR_FILTERS)[number];

export function isColorFilter(value: unknown): value is ColorFilter {
  return typeof value === "string" && (COLOR_FILTERS as readonly string[]).includes(value);
}

export function normalizeColorFilter(value: unknown): ColorFilter {
  return isColorFilter(value) ? value : "none";
}

const LABEL_KEYS: Record<ColorFilter, MessageKey> = {
  none: "makerFilterNone",
  dramatic: "makerFilterDramatic",
  dynamic: "makerFilterDynamic",
  film: "makerFilterFilm",
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

/** sRGB のトーン調整。 */
export const COLOR_FILTER_RECIPES: Record<ColorFilter, Recipe> = {
  none: { saturation: 1, contrast: 1, gamma: 1, lift: 0, gain: [1, 1, 1] },
  dramatic: { saturation: 0.82, contrast: 1.18, gamma: 1.06, lift: 0, gain: [1, 1, 1] },
  dynamic: { saturation: 1.18, contrast: 1.12, gamma: 1, lift: 0, gain: [1, 1, 1] },
  film: { saturation: 0.78, contrast: 0.88, gamma: 1, lift: 10, gain: [1.03, 1, 0.96] },
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

/** 通常は現在の1枚、ディゾルブ中だけ最大2枚。各最大 2880²×4 ≒ 32MiB。 */
export function createColorPhotoCache() {
  const entries = new Map<ImageBitmap, HTMLCanvasElement>();
  let capacity: 1 | 2 = 1;
  let cachedFilter: ColorFilter = "none";
  const release = (source: ImageBitmap, canvas: HTMLCanvasElement) => {
    canvas.width = canvas.height = 0;
    entries.delete(source);
  };
  const trim = () => {
    while (entries.size > capacity) {
      const [source, canvas] = entries.entries().next().value!;
      release(source, canvas);
    }
  };
  const clear = () => {
    for (const [source, canvas] of entries) release(source, canvas);
    cachedFilter = "none";
  };
  return {
    clear,
    setCapacity(next: 1 | 2) {
      capacity = next;
      trim();
    },
    get(source: ImageBitmap | undefined, filter: ColorFilter): ImageBitmap | HTMLCanvasElement | undefined {
      if (!source || filter === "none") {
        clear();
        return source;
      }
      if (cachedFilter !== filter) clear();
      const cached = entries.get(source);
      if (cached) {
        // 最近使った写真を末尾へ。窓の終端では新写真を残して旧写真を解放する。
        entries.delete(source);
        entries.set(source, cached);
        return cached;
      }
      if (entries.size >= capacity) {
        const [oldSource, oldCanvas] = entries.entries().next().value!;
        release(oldSource, oldCanvas);
      }
      const next = document.createElement("canvas");
      next.width = source.width;
      next.height = source.height;
      const ctx = next.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas2D が使えません");
      ctx.drawImage(source, 0, 0);
      const image = ctx.getImageData(0, 0, next.width, next.height);
      applyColorFilter(image.data, filter);
      ctx.putImageData(image, 0, 0);
      cachedFilter = filter;
      entries.set(source, next);
      trim();
      return next;
    },
  };
}
