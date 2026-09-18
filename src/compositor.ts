import { applySoftwareBlur } from "./blur.ts";
import { ensureCanvasSize, scaleCanvasSize } from "./canvas-size.ts";
import { keyImageData } from "./keying.ts";
import {
  BLUR_COVER_SCALE,
  BLUR_DIM,
  PANEL_DIVIDER_PX,
  ZOOM_BACKDROP_BLUR_FRAC,
  characterDest,
  characterOutlinePx,
  characterScale,
  characterShiftY,
  coverDest,
  DEFAULT_ASPECT,
  filterBlurPx,
  hasFrameFx,
  hasImageFilter,
  mainPanelRect,
  OUTPUTS,
  outputSize,
  plateCoverScale,
  plateRestShiftFrac,
  STAGE_MAX_REM,
  swapFx,
  templateBandRect,
  usesBlurBackdrop,
  type AspectMode,
  type ImageFilter,
  type SwapFx,
  type SwapStyle,
} from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";
import { photoForSlot, slotForTime, type SlotTimeline } from "./timeline.ts";

export { BLUR_SOURCE, OUTPUT, OUTPUTS, STAGE_MAX_REM, type AspectMode } from "./layout.ts";

/** 全面 FX（横ブラー・RGB ずれ）はキャラも含めた合成後の本編に掛ける。写真だけではない。 */
export const FRAME_FX_TARGET = "composited-main" as const;

/** ジャンプのフラッシュは写真層に乗せ、キャラは薄い全面分だけ。 */
export const JUMP_FLASH_TARGET = "photo-plate" as const;

/** 画像フィルターは写真層だけ。線画キャラとクレジットには掛けない。 */
export const IMAGE_FILTER_TARGET = "photo-plate" as const;

/** iOS / Safari は ctx.filter が無効なので、画素の箱型ぼかしを使う。 */
export const IMAGE_FILTER_BLUR_IMPL = "image-data-box" as const;

/**
 * ImageBitmap を WebGL に直接 texImage2D し、かつ UNPACK_FLIP_Y_WEBGL=1 にすると
 * ブラウザによっては（ImageBitmap が既に GL 向け Y 反転済みのため）写真だけ上下逆になる。
 * 写真は Canvas2D に描いてから使う。
 */
export const PHOTO_UPLOAD_PATH = "canvas2d-blit" as const;

/**
 * 写真層（blit + レイアウト + 画像フィルター）はオフスクリーンに残し、
 * スロット／写真／幾何が同じなら毎フレーム描き直さない。
 */
export const PHOTO_PLATE_CACHE = "offscreen-canvas" as const;

export type PhotoPlateCacheKey = {
  photoId: string;
  bitmapW: number;
  bitmapH: number;
  plateSlot: number;
  swapStyle: SwapStyle;
  imageFilter: ImageFilter;
  aspect: AspectMode;
  panelW: number;
  panelH: number;
  scale: number;
  dy: number;
  backdrop: boolean;
};

export type PhotoPlateCacheInput = {
  photo: Pick<LoadedPhoto, "id"> & { bitmap: Pick<LoadedPhoto["bitmap"], "width" | "height"> };
  plateSlot: number;
  swapStyle: SwapStyle;
  imageFilter: ImageFilter;
  aspect: AspectMode;
  panelW: number;
  panelH: number;
  fx: Pick<SwapFx, "scale" | "dy" | "backdrop">;
};

/** 時刻依存のキーイング／全面 FX／ジャンプフラッシュはキーに入れない。 */
export function photoPlateCacheKey(input: PhotoPlateCacheInput): PhotoPlateCacheKey {
  return {
    photoId: input.photo.id,
    bitmapW: input.photo.bitmap.width,
    bitmapH: input.photo.bitmap.height,
    plateSlot: input.plateSlot,
    swapStyle: input.swapStyle,
    imageFilter: input.imageFilter,
    aspect: input.aspect,
    panelW: input.panelW,
    panelH: input.panelH,
    scale: input.fx.scale,
    dy: input.fx.dy,
    backdrop: input.fx.backdrop,
  };
}

export function samePhotoPlateCacheKey(a: PhotoPlateCacheKey, b: PhotoPlateCacheKey): boolean {
  return (
    a.photoId === b.photoId &&
    a.bitmapW === b.bitmapW &&
    a.bitmapH === b.bitmapH &&
    a.plateSlot === b.plateSlot &&
    a.swapStyle === b.swapStyle &&
    a.imageFilter === b.imageFilter &&
    a.aspect === b.aspect &&
    a.panelW === b.panelW &&
    a.panelH === b.panelH &&
    a.scale === b.scale &&
    a.dy === b.dy &&
    a.backdrop === b.backdrop
  );
}

export type PhotoPlateCache = {
  /** 同じキーなら true（再利用）。変わっていれば false（再描画して記録）。 */
  reuse: (key: PhotoPlateCacheKey) => boolean;
  draws: () => number;
  hits: () => number;
};

export function createPhotoPlateCache(): PhotoPlateCache {
  let last: PhotoPlateCacheKey | undefined;
  let draws = 0;
  let hits = 0;
  return {
    reuse(key) {
      if (last && samePhotoPlateCacheKey(last, key)) {
        hits += 1;
        return true;
      }
      last = key;
      draws += 1;
      return false;
    },
    draws() {
      return draws;
    },
    hits() {
      return hits;
    },
  };
}

export type Compositor = {
  canvas: HTMLCanvasElement;
  draw: (
    video: HTMLVideoElement,
    photos: readonly LoadedPhoto[],
    timeline: SlotTimeline,
    time?: number,
    swapStyle?: SwapStyle,
    imageFilter?: ImageFilter,
  ) => number;
  setAspect: (mode: AspectMode) => void;
  setResolutionScale: (scale: number) => void;
  resolutionScale: () => number;
  aspect: () => AspectMode;
  destroy: () => void;
  kind: "2d";
};

export function createCompositor(options?: { resolutionScale?: number }): Compositor {
  let mode: AspectMode = DEFAULT_ASPECT;
  let resolutionScale = options?.resolutionScale ?? 1;
  const canvas = document.createElement("canvas");
  applyCanvasSize(canvas, mode, resolutionScale);
  canvas.className = "stage-canvas";
  canvas.setAttribute("aria-label", "合成プレビュー");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas2D が使えません");

  const main = document.createElement("canvas");
  const mainCtx = main.getContext("2d", { alpha: false });
  if (!mainCtx) throw new Error("Canvas2D が使えません");

  const keyed = document.createElement("canvas");
  const keyedCtx = keyed.getContext("2d", { willReadFrequently: true });
  if (!keyedCtx) throw new Error("Canvas2D が使えません");

  const scratch = document.createElement("canvas");
  const scratchCtx = scratch.getContext("2d", { alpha: false });
  if (!scratchCtx) throw new Error("Canvas2D が使えません");

  const halo = document.createElement("canvas");
  const haloCtx = halo.getContext("2d");
  if (!haloCtx) throw new Error("Canvas2D が使えません");

  const fxA = document.createElement("canvas");
  const fxACtx = fxA.getContext("2d", { alpha: false });
  if (!fxACtx) throw new Error("Canvas2D が使えません");

  const fxB = document.createElement("canvas");
  const fxBCtx = fxB.getContext("2d", { alpha: false });
  if (!fxBCtx) throw new Error("Canvas2D が使えません");

  const blur = document.createElement("canvas");
  const blurCtx = blur.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!blurCtx) throw new Error("Canvas2D が使えません");

  const plateLayer = document.createElement("canvas");
  const plateLayerCtx = plateLayer.getContext("2d", { alpha: false });
  if (!plateLayerCtx) throw new Error("Canvas2D が使えません");
  const plateCache = createPhotoPlateCache();

  const surfaces: FxSurfaces = { keyed, keyedCtx, halo, haloCtx, fxA, fxACtx, fxB, fxBCtx, blur, blurCtx };

  const draw = (
    video: HTMLVideoElement,
    photos: readonly LoadedPhoto[],
    timeline: SlotTimeline,
    time = video.currentTime,
    swapStyle: SwapStyle = "jump",
    imageFilter: ImageFilter = "none",
  ) => {
    const { slots, slotPhotoOrder } = timeline;
    const slot = slotForTime(time, slots);
    applyCanvasSize(canvas, mode, resolutionScale);
    const w = canvas.width;
    const h = canvas.height;
    const panel = mainPanelRect(w, h, mode);
    const fx = swapFx(time, slots, swapStyle);
    const plate = photoForSlot(photos, fx.plateSlot, slotPhotoOrder);

    composeMain(
      main,
      mainCtx,
      surfaces,
      plateLayer,
      plateLayerCtx,
      plateCache,
      plate,
      video,
      fx,
      swapStyle,
      panel,
      mode,
      imageFilter,
    );
    if (usesBlurBackdrop(mode)) {
      paintOutput(ctx, scratch, scratchCtx, main, panel, w, h);
    } else {
      paintLandscape(ctx, main, w, h);
    }
    paintSongCredit(ctx, w, h, mode);
    return slot;
  };

  return {
    canvas,
    draw,
    kind: "2d",
    setAspect(next) {
      mode = next;
      applyCanvasSize(canvas, mode, resolutionScale);
    },
    setResolutionScale(next) {
      const safe = Number.isFinite(next) && next > 0 ? next : 1;
      if (safe === resolutionScale) return;
      resolutionScale = safe;
      applyCanvasSize(canvas, mode, resolutionScale);
    },
    resolutionScale() {
      return resolutionScale;
    },
    aspect() {
      return mode;
    },
    destroy() {
      canvas.width = 0;
      canvas.height = 0;
      main.width = 0;
      main.height = 0;
      keyed.width = 0;
      keyed.height = 0;
      scratch.width = 0;
      scratch.height = 0;
      halo.width = 0;
      halo.height = 0;
      fxA.width = 0;
      fxA.height = 0;
      fxB.width = 0;
      fxB.height = 0;
      blur.width = 0;
      blur.height = 0;
      plateLayer.width = 0;
      plateLayer.height = 0;
    },
  };
}

type FxSurfaces = {
  keyed: HTMLCanvasElement;
  keyedCtx: CanvasRenderingContext2D;
  halo: HTMLCanvasElement;
  haloCtx: CanvasRenderingContext2D;
  fxA: HTMLCanvasElement;
  fxACtx: CanvasRenderingContext2D;
  fxB: HTMLCanvasElement;
  fxBCtx: CanvasRenderingContext2D;
  blur: HTMLCanvasElement;
  blurCtx: CanvasRenderingContext2D;
};

function applyCanvasSize(canvas: HTMLCanvasElement, mode: AspectMode, scale: number): void {
  const size = outputSize(mode);
  const bitmap = scaleCanvasSize(size.width, size.height, scale);
  ensureCanvasSize(canvas, bitmap.width, bitmap.height);
}

function composeMain(
  main: HTMLCanvasElement,
  mainCtx: CanvasRenderingContext2D,
  surfaces: FxSurfaces,
  plateLayer: HTMLCanvasElement,
  plateLayerCtx: CanvasRenderingContext2D,
  plateCache: PhotoPlateCache,
  plate: LoadedPhoto | undefined,
  video: HTMLVideoElement,
  fx: SwapFx,
  style: SwapStyle,
  panel: { w: number; h: number },
  mode: AspectMode,
  imageFilter: ImageFilter,
): void {
  main.width = Math.max(1, Math.round(panel.w));
  main.height = Math.max(1, Math.round(panel.h));
  const mw = main.width;
  const mh = main.height;
  resetCtx(mainCtx);
  mainCtx.fillStyle = "#0a0806";
  mainCtx.fillRect(0, 0, mw, mh);

  if (plate) {
    const key = photoPlateCacheKey({
      photo: plate,
      plateSlot: fx.plateSlot,
      swapStyle: style,
      imageFilter,
      aspect: mode,
      panelW: mw,
      panelH: mh,
      fx,
    });
    if (!plateCache.reuse(key)) {
      paintCachedPhotoPlate(plateLayer, plateLayerCtx, surfaces, plate, fx, style, imageFilter, mw, mh);
    }
    resetCtx(mainCtx);
    mainCtx.drawImage(plateLayer, 0, 0);
    applyPlateFlash(mainCtx, plate, fx, style, mw, mh);
  }

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    drawCharacter(mainCtx, surfaces, video, mw, mh, mode);
  }

  if (hasFrameFx(fx)) {
    applyFrameFx(main, mainCtx, surfaces, fx);
  }

  if (fx.flashGlobal > 0.002) {
    resetCtx(mainCtx);
    mainCtx.fillStyle = `rgba(255, 255, 255, ${fx.flashGlobal})`;
    mainCtx.fillRect(0, 0, mw, mh);
  }
}

function resetCtx(ctx: CanvasRenderingContext2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/** 写真の cover 矩形。`fx.scale` は基準 cover に対する倍率、`fx.dy` はパネル高さ比の縦ずれ。 */
export function plateDest(
  photoW: number,
  photoH: number,
  panelW: number,
  panelH: number,
  fx: Pick<SwapFx, "scale" | "dy">,
  style: SwapStyle,
): { x: number; y: number; w: number; h: number } {
  return coverDest(photoW, photoH, panelW, panelH, {
    scale: plateCoverScale(style) * fx.scale,
    offsetY: (plateRestShiftFrac(style) + fx.dy) * panelH,
  });
}

function paintCachedPhotoPlate(
  plateLayer: HTMLCanvasElement,
  plateLayerCtx: CanvasRenderingContext2D,
  surfaces: FxSurfaces,
  photo: LoadedPhoto,
  fx: SwapFx,
  style: SwapStyle,
  imageFilter: ImageFilter,
  mw: number,
  mh: number,
): void {
  ensureCanvasSize(plateLayer, mw, mh);
  resetCtx(plateLayerCtx);
  plateLayerCtx.fillStyle = "#0a0806";
  plateLayerCtx.fillRect(0, 0, mw, mh);
  drawPhotoPlate(plateLayerCtx, photo, fx, style, mw, mh);
  applyPhotoFilter(plateLayer, plateLayerCtx, surfaces, imageFilter);
}

/**
 * 写真層。ズームで縮んだときは同じ写真の cover ぼかしを後ろに敷いて黒帯を見せない。
 * ジャンプのフラッシュはキャッシュせず、合成時に毎フレーム乗せる。
 */
function drawPhotoPlate(
  ctx: CanvasRenderingContext2D,
  photo: LoadedPhoto,
  fx: SwapFx,
  style: SwapStyle,
  mw: number,
  mh: number,
): void {
  const bitmap = photo.bitmap;
  resetCtx(ctx);
  if (fx.backdrop) {
    const full = coverDest(bitmap.width, bitmap.height, mw, mh, { scale: 1.06 });
    ctx.save();
    ctx.filter = `blur(${Math.max(2, Math.round(mw * ZOOM_BACKDROP_BLUR_FRAC))}px)`;
    ctx.drawImage(bitmap, full.x, full.y, full.w, full.h);
    ctx.restore();
    ctx.fillStyle = "rgba(10, 8, 6, 0.25)";
    ctx.fillRect(0, 0, mw, mh);
  }
  const dest = plateDest(bitmap.width, bitmap.height, mw, mh, fx, style);
  ctx.drawImage(bitmap, dest.x, dest.y, dest.w, dest.h);
}

/** ジャンプのフラッシュ（加算＋スクリーン）は写真層にだけ乗せる。 */
function applyPlateFlash(
  ctx: CanvasRenderingContext2D,
  photo: LoadedPhoto,
  fx: SwapFx,
  style: SwapStyle,
  mw: number,
  mh: number,
): void {
  if (fx.flashAdd <= 0.002 && fx.flashScreen <= 0.002) return;
  const dest = plateDest(photo.bitmap.width, photo.bitmap.height, mw, mh, fx, style);
  resetCtx(ctx);
  if (fx.flashAdd > 0.002) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 255, 255, ${fx.flashAdd})`;
    ctx.fillRect(dest.x, dest.y, dest.w, dest.h);
    ctx.globalCompositeOperation = "source-over";
  }
  if (fx.flashScreen > 0.002) {
    ctx.fillStyle = `rgba(255, 255, 255, ${fx.flashScreen})`;
    ctx.fillRect(dest.x, dest.y, dest.w, dest.h);
  }
}

function drawCharacter(
  mainCtx: CanvasRenderingContext2D,
  { keyed, keyedCtx, halo, haloCtx }: FxSurfaces,
  video: HTMLVideoElement,
  mw: number,
  mh: number,
  mode: AspectMode,
): void {
  const fallback = outputSize(mode);
  const vw = video.videoWidth || fallback.width;
  const vh = video.videoHeight || fallback.height;
  const band = templateBandRect(vw, vh, mode);
  keyed.width = mw;
  keyed.height = mh;
  keyedCtx.clearRect(0, 0, mw, mh);
  keyedCtx.drawImage(video, band.x, band.y, band.w, band.h, 0, 0, mw, mh);
  const image = keyedCtx.getImageData(0, 0, mw, mh);
  keyImageData(image);
  keyedCtx.putImageData(image, 0, 0);

  halo.width = mw;
  halo.height = mh;
  haloCtx.clearRect(0, 0, mw, mh);
  haloCtx.globalCompositeOperation = "source-over";
  haloCtx.drawImage(keyed, 0, 0);
  haloCtx.globalCompositeOperation = "source-in";
  haloCtx.fillStyle = "#ffffff";
  haloCtx.fillRect(0, 0, mw, mh);
  haloCtx.globalCompositeOperation = "source-over";

  const dest = characterDest(mw, mh, characterScale(mode), characterShiftY(mh, mode));
  const o = characterOutlinePx(mw);
  const ring: ReadonlyArray<readonly [number, number]> = [
    [-o, 0],
    [o, 0],
    [0, -o],
    [0, o],
    [-o, -o],
    [o, -o],
    [-o, o],
    [o, o],
  ];
  resetCtx(mainCtx);
  for (const [ox, oy] of ring) {
    mainCtx.drawImage(halo, dest.x + ox, dest.y + oy, dest.w, dest.h);
  }
  mainCtx.drawImage(keyed, dest.x, dest.y, dest.w, dest.h);
}

/** 横モーションブラーのコピー数。長さに応じて増やし、平均合成で滑らかにする。 */
export function blurTapCount(blurPx: number): number {
  if (blurPx < 1) return 1;
  return Math.min(15, Math.max(3, Math.round(blurPx / 2.5) | 1));
}

/**
 * 参考ズーム（hagikaze_sami）の全面 FX。合成済み本編（写真＋キャラ）に対して
 * 行波打ち → 横モーションブラー → RGB 横ずれ（R 右・B 左）→ 白加算／灰かぶり の順。
 */
function applyFrameFx(
  main: HTMLCanvasElement,
  mainCtx: CanvasRenderingContext2D,
  { fxA, fxACtx, fxB, fxBCtx }: FxSurfaces,
  fx: SwapFx,
): void {
  const w = main.width;
  const h = main.height;
  fxA.width = w;
  fxA.height = h;
  fxB.width = w;
  fxB.height = h;
  resetCtx(fxACtx);
  resetCtx(fxBCtx);

  // 1) 波打ち: 行帯ごとに横へずらしながら main → fxA
  const waveAmp = fx.wave * w;
  if (waveAmp >= 0.5) {
    const bands = 24;
    const bh = h / bands;
    for (let i = 0; i < bands; i += 1) {
      const y = i * bh;
      const dx = Math.sin((i / bands) * Math.PI * 3.4 + fx.blur * 40) * waveAmp;
      fxACtx.drawImage(main, 0, y, w, bh, dx, y, w, bh);
    }
  } else {
    fxACtx.drawImage(main, 0, 0);
  }

  // 2) 横モーションブラー: fxA を N 回ずらして平均 → fxB
  const blurPx = fx.blur * w;
  const taps = blurTapCount(blurPx);
  if (taps > 1) {
    for (let i = 0; i < taps; i += 1) {
      const t = i / (taps - 1) - 0.5;
      fxBCtx.globalAlpha = 1 / (i + 1);
      fxBCtx.drawImage(fxA, t * blurPx, 0);
    }
    fxBCtx.globalAlpha = 1;
  } else {
    fxBCtx.drawImage(fxA, 0, 0);
  }

  // 3) RGB 横ずれ: fxB をチャンネル分解して加算合成で main に戻す
  resetCtx(mainCtx);
  const rgbPx = fx.rgb * w;
  if (rgbPx >= 0.5) {
    mainCtx.fillStyle = "#000";
    mainCtx.fillRect(0, 0, w, h);
    const channels: ReadonlyArray<readonly [string, number]> = [
      ["#ff0000", rgbPx],
      ["#00ff00", 0],
      ["#0000ff", -rgbPx],
    ];
    for (const [color, dx] of channels) {
      resetCtx(fxACtx);
      fxACtx.drawImage(fxB, 0, 0);
      fxACtx.globalCompositeOperation = "multiply";
      fxACtx.fillStyle = color;
      fxACtx.fillRect(0, 0, w, h);
      fxACtx.globalCompositeOperation = "source-over";
      mainCtx.globalCompositeOperation = "lighter";
      mainCtx.drawImage(fxA, dx, 0);
      if (dx !== 0) {
        // ずらして空いた端は同じチャンネルを端で埋める
        const edgeW = Math.ceil(Math.abs(dx));
        const sx = dx > 0 ? 0 : w - edgeW;
        const dxEdge = dx > 0 ? 0 : w - edgeW;
        mainCtx.drawImage(fxA, sx, 0, edgeW, h, dxEdge, 0, edgeW, h);
      }
    }
    mainCtx.globalCompositeOperation = "source-over";
  } else {
    mainCtx.drawImage(fxB, 0, 0);
  }

  // 4) 明度: 白加算（std を保つ）と灰かぶり（コントラスト低下）
  resetCtx(mainCtx);
  if (fx.lift > 0.002) {
    mainCtx.globalCompositeOperation = "lighter";
    mainCtx.fillStyle = `rgba(255, 255, 255, ${fx.lift})`;
    mainCtx.fillRect(0, 0, w, h);
    mainCtx.globalCompositeOperation = "source-over";
  }
  if (fx.haze > 0.002) {
    mainCtx.fillStyle = `rgba(100, 100, 100, ${fx.haze})`;
    mainCtx.fillRect(0, 0, w, h);
  }
}

function paintLandscape(ctx: CanvasRenderingContext2D, main: HTMLCanvasElement, w: number, h: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.drawImage(main, 0, 0, w, h);
}

/**
 * 写真層だけをぼかす。キャラ描画の前に呼ぶ。
 * iOS / Safari では Canvas2D filter が無効なので画素ぼかしを使う。
 */
function applyPhotoFilter(
  main: HTMLCanvasElement,
  mainCtx: CanvasRenderingContext2D,
  { blur, blurCtx }: FxSurfaces,
  filter: ImageFilter,
): void {
  if (!hasImageFilter(filter)) return;
  const px = filterBlurPx(filter, Math.max(main.width, main.height));
  applySoftwareBlur(main, mainCtx, blur, blurCtx, px);
}

function paintOutput(
  ctx: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  scratchCtx: CanvasRenderingContext2D,
  main: HTMLCanvasElement,
  panel: { x: number; y: number; w: number; h: number },
  w: number,
  h: number,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.fillStyle = "#0a0806";
  ctx.fillRect(0, 0, w, h);

  scratch.width = Math.max(40, Math.round(w * 0.28));
  scratch.height = Math.max(40, Math.round(h * 0.28));
  const sw = scratch.width;
  const sh = scratch.height;
  scratchCtx.fillStyle = "#0a0806";
  scratchCtx.fillRect(0, 0, sw, sh);
  const blurDest = coverDest(main.width, main.height, sw, sh, { scale: BLUR_COVER_SCALE });
  scratchCtx.drawImage(main, blurDest.x, blurDest.y, blurDest.w, blurDest.h);

  ctx.save();
  ctx.filter = "blur(16px)";
  ctx.drawImage(scratch, -24, -24, w + 48, h + 48);
  ctx.filter = "none";
  ctx.fillStyle = BLUR_DIM;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.drawImage(main, panel.x, panel.y, panel.w, panel.h);

  ctx.fillStyle = "rgba(8, 6, 4, 0.85)";
  const half = PANEL_DIVIDER_PX / 2;
  ctx.fillRect(0, panel.y - half, w, PANEL_DIVIDER_PX);
  ctx.fillRect(0, panel.y + panel.h - half, w, PANEL_DIVIDER_PX);
}

export const SONG_CREDIT = "♪ あのね - ナナツカゼ";

/** 横短辺×この比。縦はプレビュー CSS スケールで横と同じ見た目になるよう小さくする。 */
export const SONG_CREDIT_FONT_FRAC = 0.055;

/** 横プレビュー（26rem / 1280）でのクレジットの画面上サイズに、縦を合わせる。 */
export function songCreditFontSize(mode: AspectMode, resolutionScale = 1): number {
  const landscapeShort = Math.min(OUTPUTS.landscape.width, OUTPUTS.landscape.height);
  const landscapeFont = Math.max(12, Math.round(landscapeShort * SONG_CREDIT_FONT_FRAC));
  const scale = Number.isFinite(resolutionScale) && resolutionScale > 0 ? resolutionScale : 1;
  const scaled = (font: number) => Math.max(1, Math.round(font * scale));
  if (mode === "landscape") return scaled(landscapeFont);
  const canvasPerRem =
    (OUTPUTS.portrait.width / STAGE_MAX_REM.portrait) * (STAGE_MAX_REM.landscape / OUTPUTS.landscape.width);
  return scaled(Math.max(12, Math.round(landscapeFont * canvasPerRem)));
}

export type SongCreditLayout = {
  fontSize: number;
  pad: number;
  /** 右寄せアンカーの x。 */
  x: number;
  /** 縦はパネル直下（top）、横は画面下端（bottom）。 */
  y: number;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

/**
 * 縦: 中央 16:9 本編の真下・下帯の右上。
 * 横: 画面全体の右下。どちらも小さな inset。
 */
export function songCreditLayout(
  canvasW: number,
  canvasH: number,
  mode: AspectMode = canvasW < canvasH ? "portrait" : "landscape",
): SongCreditLayout {
  const short = Math.min(canvasW, canvasH);
  const fullW = OUTPUTS[mode].width;
  const resolutionScale = fullW > 0 ? canvasW / fullW : 1;
  const fontSize = songCreditFontSize(mode, resolutionScale);
  const pad = Math.max(8, Math.round(short * 0.016));
  const x = canvasW - pad;
  if (mode === "portrait") {
    const panel = mainPanelRect(canvasW, canvasH, mode);
    return {
      fontSize,
      pad,
      x,
      y: panel.y + panel.h + pad,
      textAlign: "right",
      textBaseline: "top",
    };
  }
  return {
    fontSize,
    pad,
    x,
    y: canvasH - pad,
    textAlign: "right",
    textBaseline: "bottom",
  };
}

function paintSongCredit(ctx: CanvasRenderingContext2D, w: number, h: number, mode: AspectMode): void {
  const { fontSize, x, y, textAlign, textBaseline } = songCreditLayout(w, h, mode);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.font = `500 ${fontSize}px "Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif`;
  ctx.textAlign = textAlign;
  ctx.textBaseline = textBaseline;
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = Math.max(3, Math.round(fontSize * 0.32));
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.06));
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fillText(SONG_CREDIT, x, y);
  ctx.restore();
}
