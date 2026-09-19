import { OUTPUTS } from "./layout.ts";
import { reportError } from "./sentry.ts";

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

/** サムネは CSS 6rem 程度。3x でも足りる小さい辺。 */
export const PHOTO_THUMB_EDGE = 240;

/** 同時 decode を抑えて、フル解像度のピークを重ねない。 */
export const PHOTO_DECODE_CONCURRENCY = 2;

export const IMAGE_LOAD_ERROR = "画像を読み込めませんでした";
export const HEIC_UNSUPPORTED_MESSAGE =
  "HEIC はこのブラウザで読めません。設定で写真を互換性優先（JPEG）にするか、スクショを使ってね";

/** HEIC を ImageBitmap か、既存パスへ渡す JPEG/PNG Blob にする。テストで差し替え可能。 */
export type HeicConverter = (blob: Blob) => Promise<ImageBitmap | Blob>;

/** Android Chrome 向け。orientation 付きが落ちても、options なし → HTMLImage → FileReader と続ける。 */
export const PHOTO_DECODE_ATTEMPTS = [
  "bitmap-orient",
  "bitmap-plain",
  "bitmap-typed-orient",
  "bitmap-typed-plain",
  "html-object-url",
  "html-data-url",
] as const;

export type ImageSignature = "jpeg" | "png" | "webp" | "gif" | "bmp" | "avif" | "heic" | "unknown";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "avif",
  "tif",
  "tiff",
  "heic",
  "heif",
  "hif",
]);

const NON_IMAGE_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "mov",
  "m4v",
  "avi",
  "mkv",
  "mp3",
  "wav",
  "aac",
  "m4a",
  "pdf",
  "txt",
  "zip",
  "json",
  "html",
  "csv",
]);

const HEIC_EXTENSIONS = new Set(["heic", "heif", "hif"]);
const HEIC_MIMES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

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

export async function tryInOrder<T>(attempts: ReadonlyArray<() => Promise<T>>): Promise<T> {
  let last: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      last = error;
    }
  }
  if (last instanceof Error) throw last;
  throw new Error(IMAGE_LOAD_ERROR);
}

export function fileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function sniffImageSignature(bytes: Uint8Array): ImageSignature {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "webp";
  }
  if (bytes.length >= 6) {
    const gif = ascii(bytes, 0, 6);
    if (gif === "GIF87a" || gif === "GIF89a") return "gif";
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return "bmp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    if (brand === "avif" || brand === "avis") return "avif";
    if (HEIC_BRANDS.has(brand)) return "heic";
  }
  return "unknown";
}

export function mimeFromSignature(signature: ImageSignature): string {
  switch (signature) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "avif":
      return "image/avif";
    case "heic":
      return "image/heic";
    default:
      return "";
  }
}

export function mimeFromExtension(name: string): string {
  switch (fileExtension(name)) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "avif":
      return "image/avif";
    case "tif":
    case "tiff":
      return "image/tiff";
    case "heic":
    case "heif":
    case "hif":
      return "image/heic";
    default:
      return "";
  }
}

export function guessImageMime(file: { name: string; type: string }, signature: ImageSignature = "unknown"): string {
  const fromSig = mimeFromSignature(signature);
  if (fromSig) return fromSig;
  const type = file.type.trim().toLowerCase();
  if (type.startsWith("image/") && type !== "image/*") return type;
  return mimeFromExtension(file.name);
}

export function isHeicLike(
  file: { name: string; type: string },
  signature: ImageSignature = "unknown",
): boolean {
  if (signature === "heic") return true;
  const type = file.type.trim().toLowerCase();
  if (HEIC_MIMES.has(type)) return true;
  return HEIC_EXTENSIONS.has(fileExtension(file.name));
}

/**
 * Android のギャラリーは `file.type` が空や octet-stream のことがある。
 * MIME が空でも拡張子・中身で画像なら残す。明らかに画像でないものだけ落とす。
 */
export function isLikelyImageFile(file: { name: string; type: string }): boolean {
  const type = file.type.trim().toLowerCase();
  if (type.startsWith("image/")) return true;
  const ext = fileExtension(file.name);
  if (IMAGE_EXTENSIONS.has(ext)) return true;
  if (NON_IMAGE_EXTENSIONS.has(ext)) return false;
  return type === "" || type === "application/octet-stream";
}

export function selectImageFiles(files: readonly File[]): File[] {
  return files.filter((file) => isLikelyImageFile(file));
}

export async function loadPhotos(
  files: File[],
  options: {
    onProgress?: (current: number, total: number) => void;
    convertHeic?: HeicConverter;
    onError?: (error: unknown) => void;
  } = {},
): Promise<LoadedPhoto[]> {
  const report = options.onError ?? reportError;
  const imageFiles = selectImageFiles(files);
  const total = imageFiles.length;
  const failures: Error[] = [];
  const started: LoadedPhoto[] = [];
  let loadedCount = 0;
  try {
    const results = await mapLimit(imageFiles, PHOTO_DECODE_CONCURRENCY, async (file) => {
      try {
        const photo = await loadPhoto(file, options.convertHeic);
        started.push(photo);
        loadedCount += 1;
        options.onProgress?.(loadedCount, total);
        return photo;
      } catch (error) {
        failures.push(error instanceof Error ? error : new Error(IMAGE_LOAD_ERROR));
        return null;
      }
    });
    const loaded = results.filter((photo): photo is LoadedPhoto => photo !== null);
    if (loaded.length > 0) {
      for (const failure of failures) {
        report(failure);
      }
      return loaded;
    }
    if (failures.length > 0) throw pickLoadError(failures);
    return [];
  } catch (error) {
    revokePhotos(started);
    throw error;
  }
}

async function loadPhoto(file: File, convertHeic?: HeicConverter): Promise<LoadedPhoto> {
  const full = await decodeFullBitmap(file, { convertHeic });
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

export function decodeAttemptNames(file: { name: string; type: string }, signature: ImageSignature = "unknown"): string[] {
  const mime = guessImageMime(file, signature);
  const needsTyped = Boolean(mime) && file.type.trim().toLowerCase() !== mime;
  return PHOTO_DECODE_ATTEMPTS.filter((name) => needsTyped || !name.startsWith("bitmap-typed"));
}

export async function decodeRasterBitmap(file: File, signature: ImageSignature = "unknown"): Promise<ImageBitmap> {
  const mime = guessImageMime(file, signature);
  const typed = typedBlob(file, mime);
  const jobs: Record<(typeof PHOTO_DECODE_ATTEMPTS)[number], () => Promise<ImageBitmap>> = {
    "bitmap-orient": () => bitmapFromBlob(file, { imageOrientation: "from-image" }),
    "bitmap-plain": () => bitmapFromBlob(file),
    "bitmap-typed-orient": () => bitmapFromBlob(typed, { imageOrientation: "from-image" }),
    "bitmap-typed-plain": () => bitmapFromBlob(typed),
    "html-object-url": () => bitmapFromObjectUrl(typed),
    "html-data-url": () => bitmapFromDataUrl(typed),
  };

  try {
    return await tryInOrder(decodeAttemptNames(file, signature).map((name) => jobs[name as (typeof PHOTO_DECODE_ATTEMPTS)[number]]));
  } catch {
    throw new Error(IMAGE_LOAD_ERROR);
  }
}

export async function decodeFullBitmap(
  file: File,
  options: { convertHeic?: HeicConverter } = {},
): Promise<ImageBitmap> {
  const header = await peekFileHeader(file);
  const signature = sniffImageSignature(header);
  if (isHeicLike(file, signature)) {
    return decodeHeicBitmap(file, options.convertHeic ?? convertHeicWithLib);
  }
  return decodeRasterBitmap(file, signature);
}

async function decodeHeicBitmap(file: File, convertHeic: HeicConverter): Promise<ImageBitmap> {
  try {
    return await tryInOrder([
      () => bitmapFromBlob(file, { imageOrientation: "from-image" }),
      () => bitmapFromBlob(file),
    ]);
  } catch {
    // Safari などネイティブ対応以外は lib で JPEG/PNG 相当にして既存パスへ。
  }
  let converted: ImageBitmap | Blob;
  try {
    converted = await convertHeic(file);
  } catch {
    throw new Error(HEIC_UNSUPPORTED_MESSAGE);
  }
  if (isImageBitmapLike(converted)) {
    return assertBitmap(converted);
  }
  const jpeg = new File([converted], withJpegName(file.name), {
    type: converted.type && converted.type.startsWith("image/") ? converted.type : "image/jpeg",
  });
  try {
    return await decodeRasterBitmap(jpeg, "jpeg");
  } catch {
    throw new Error(HEIC_UNSUPPORTED_MESSAGE);
  }
}

/** HEIC のときだけ動的 import。JPEG/PNG/WebP の初期バンドルには載せない。 */
export async function convertHeicWithLib(blob: Blob): Promise<ImageBitmap | Blob> {
  try {
    const { heicTo } = await import("heic-to");
    try {
      return await heicTo({
        blob,
        type: "bitmap",
        options: { imageOrientation: "from-image" },
      });
    } catch {
      const jpeg = await heicTo({ blob, type: "image/jpeg", quality: 0.9 });
      if (!(jpeg instanceof Blob) || jpeg.size < 8) {
        throw new Error(HEIC_UNSUPPORTED_MESSAGE);
      }
      return jpeg;
    }
  } catch {
    throw new Error(HEIC_UNSUPPORTED_MESSAGE);
  }
}

function isImageBitmapLike(value: ImageBitmap | Blob): value is ImageBitmap {
  return typeof value === "object" && value !== null && "width" in value && "height" in value && "close" in value;
}

function withJpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim();
  return `${base || "photo"}.jpg`;
}

async function peekFileHeader(file: Blob, length = 16): Promise<Uint8Array> {
  try {
    const buffer = await file.slice(0, length).arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return new Uint8Array();
  }
}

function typedBlob(file: File, mime: string): Blob {
  const current = file.type.trim().toLowerCase();
  if (!mime || current === mime) return file;
  return new Blob([file], { type: mime });
}

async function bitmapFromBlob(blob: Blob, options?: ImageBitmapOptions): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") {
    throw new Error(IMAGE_LOAD_ERROR);
  }
  const bitmap = options ? await createImageBitmap(blob, options) : await createImageBitmap(blob);
  return assertBitmap(bitmap);
}

async function bitmapFromObjectUrl(blob: Blob): Promise<ImageBitmap> {
  const url = URL.createObjectURL(blob);
  try {
    return await bitmapFromHtmlSrc(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function bitmapFromDataUrl(blob: Blob): Promise<ImageBitmap> {
  const dataUrl = await readAsDataURL(blob);
  return bitmapFromHtmlSrc(dataUrl);
}

async function bitmapFromHtmlSrc(src: string): Promise<ImageBitmap> {
  const image = await loadHtmlImage(src);
  if (typeof createImageBitmap === "function") {
    try {
      return assertBitmap(await createImageBitmap(image, { imageOrientation: "from-image" }));
    } catch {
      try {
        return assertBitmap(await createImageBitmap(image));
      } catch {
        return canvasBitmapFromImage(image);
      }
    }
  }
  return canvasBitmapFromImage(image);
}

async function canvasBitmapFromImage(image: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }): Promise<ImageBitmap> {
  const width = Math.max(1, Math.round(image.naturalWidth || image.width || 0));
  const height = Math.max(1, Math.round(image.naturalHeight || image.height || 0));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(IMAGE_LOAD_ERROR);
  ctx.drawImage(image, 0, 0, width, height);
  try {
    if (typeof createImageBitmap !== "function") {
      throw new Error(IMAGE_LOAD_ERROR);
    }
    return assertBitmap(await createImageBitmap(canvas));
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function assertBitmap(bitmap: ImageBitmap): ImageBitmap {
  if (bitmap.width < 1 || bitmap.height < 1) {
    bitmap.close();
    throw new Error(IMAGE_LOAD_ERROR);
  }
  return bitmap;
}

function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader !== "function") {
      reject(new Error(IMAGE_LOAD_ERROR));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result.length > 0) resolve(result);
      else reject(new Error(IMAGE_LOAD_ERROR));
    };
    reader.onerror = () => reject(new Error(IMAGE_LOAD_ERROR));
    reader.readAsDataURL(blob);
  });
}

async function downscaleBitmap(source: ImageBitmap, width: number, height: number): Promise<ImageBitmap> {
  try {
    return assertBitmap(
      await createImageBitmap(source, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: "high",
      }),
    );
  } catch {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像を縮小できませんでした");
    ctx.drawImage(source, 0, 0, width, height);
    try {
      return assertBitmap(await createImageBitmap(canvas));
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
    image.onerror = () => reject(new Error(IMAGE_LOAD_ERROR));
    image.src = src;
  });
}

function pickLoadError(failures: readonly Error[]): Error {
  const heic = failures.find((error) => error.message === HEIC_UNSUPPORTED_MESSAGE);
  return heic ?? failures[0] ?? new Error(IMAGE_LOAD_ERROR);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

export function revokePhotos(photos: readonly LoadedPhoto[]): void {
  for (const photo of photos) {
    URL.revokeObjectURL(photo.thumbUrl);
    photo.bitmap.close();
  }
}

/** 横 1280 をカバーできること。テストとコメント用。 */
export const PHOTO_OUTPUT_EDGE = Math.max(OUTPUTS.portrait.width, OUTPUTS.landscape.width);
