import { OUTPUTS } from "./layout.ts";

export type LoadedPhoto = {
  id: string;
  name: string;
  /** 書き出し解像度＋余裕まで縮小した本編用。元の巨大画素は持たない。 */
  bitmap: ImageBitmap;
  /** サムネ専用の小さい Blob URL。本編 bitmap とは別。 */
  thumbUrl: string;
};

/**
 * 本編の最大辺。横 1280 にズームアウト寄り（~1.8）と cover の余裕を足す。
 * 元の 12MP 級を枚数分持たない。
 */
export const PHOTO_MAX_EDGE = 1920;

/** サムネは CSS 3.2rem 程度。2x でも足りる小さい辺。 */
export const PHOTO_THUMB_EDGE = 160;

/** 同時 decode を抑えて、フル解像度のピークを重ねない。 */
export const PHOTO_DECODE_CONCURRENCY = 2;

export function photoFitSize(
  srcW: number,
  srcH: number,
  maxEdge: number,
): { width: number; height: number; downsampled: boolean } {
  const width = Math.max(1, Math.round(srcW));
  const height = Math.max(1, Math.round(srcH));
  const long = Math.max(width, height);
  const cap = Math.max(1, Math.round(maxEdge));
  if (long <= cap) {
    return { width, height, downsampled: false };
  }
  const scale = cap / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    downsampled: true,
  };
}

export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const workers = Math.max(1, Math.min(Math.round(limit), items.length));
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]!, index);
    }
  };
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

export async function loadPhotos(
  files: File[],
  options: { onProgress?: (current: number, total: number) => void } = {},
): Promise<LoadedPhoto[]> {
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  const total = imageFiles.length;
  const loaded: LoadedPhoto[] = [];
  try {
    const photos = await mapLimit(imageFiles, PHOTO_DECODE_CONCURRENCY, async (file) => {
      const photo = await loadPhoto(file);
      loaded.push(photo);
      options.onProgress?.(loaded.length, total);
      return photo;
    });
    return photos;
  } catch (error) {
    revokePhotos(loaded);
    throw error;
  }
}

async function loadPhoto(file: File): Promise<LoadedPhoto> {
  const full = await decodeFullBitmap(file);
  let working = full;
  const fitted = photoFitSize(full.width, full.height, PHOTO_MAX_EDGE);
  if (fitted.downsampled) {
    try {
      working = await downscaleBitmap(full, fitted.width, fitted.height);
    } finally {
      full.close();
    }
  }
  try {
    const thumbUrl = await makeThumbUrl(working);
    return {
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      name: file.name,
      bitmap: working,
      thumbUrl,
    };
  } catch (error) {
    working.close();
    throw error;
  }
}

async function decodeFullBitmap(file: File): Promise<ImageBitmap> {
  try {
    // EXIF だけここで直す。WebGL へ直接上げず、合成は Canvas2D 経由（上下反転防止）。
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = await loadHtmlImage(url);
      return await createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function downscaleBitmap(source: ImageBitmap, width: number, height: number): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high",
    });
  } catch {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像を縮小できませんでした");
    ctx.drawImage(source, 0, 0, width, height);
    try {
      return await createImageBitmap(canvas);
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

async function makeThumbUrl(source: ImageBitmap): Promise<string> {
  const fitted = photoFitSize(source.width, source.height, PHOTO_THUMB_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = fitted.width;
  canvas.height = fitted.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("サムネを作れませんでした");
  ctx.drawImage(source, 0, 0, fitted.width, fitted.height);
  try {
    const blob = await canvasToBlob(canvas);
    return URL.createObjectURL(blob);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("サムネを作れませんでした"));
    }, "image/jpeg", 0.72);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を読み込めませんでした"));
    image.src = src;
  });
}

export function revokePhotos(photos: readonly LoadedPhoto[]): void {
  for (const photo of photos) {
    URL.revokeObjectURL(photo.thumbUrl);
    photo.bitmap.close();
  }
}

/** 横 1280 をカバーできること。テストとコメント用。 */
export const PHOTO_OUTPUT_EDGE = Math.max(OUTPUTS.portrait.width, OUTPUTS.landscape.width);
