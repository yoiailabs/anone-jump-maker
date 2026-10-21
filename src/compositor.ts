import { charaIrisCenter, drawCharaIris } from "./charairis.ts";
import { applySoftwareBlur } from "./blur.ts";
import { ensureCanvasSize, scaleCanvasSize } from "./canvas-size.ts";
import {
  createGpuKeyer,
  gpuKeyTexImageSource,
  pickKeyingBackend,
  shouldUseGpuFrame,
  type GpuKeyDebug,
  type GpuKeyer,
  type KeyingBackend,
} from "./keying-gpu.ts";
import { keyImageData } from "./keying.ts";
import {
  characterDest,
  characterOutlinePx,
  portraitCutY,
  characterScale,
  characterShiftY,
  coverDest,
  DEFAULT_ASPECT,
  DEFAULT_CHARACTER_SIZE,
  filterBlurPx,
  hasFrameFx,
  hasImageFilter,
  mainPanelRect,
  OUTPUTS,
  PHOTO_BASE_COLOR,
  outputSize,
  plateCoverScale,
  plateRestShiftFrac,
  STAGE_MAX_REM,
  swapFx,
  templateBandRect,
  type AspectMode,
  type CharacterSize,
  type ImageFilter,
  type SwapFx,
  type SwapStyle,
} from "./layout.ts";
import { composeDetailActive, studioTrace, traceChildSync, traceCompose } from "./perf-trace.ts";
import type { LoadedPhoto } from "./photos.ts";
import { DEFAULT_LOCALE, songCreditLine, type Locale } from "./i18n.ts";
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

/** Preview and export share `draw()`; GPU keying is preferred when WebGL exists. */
export const KEYING_PREFERRED = "webgl" as const;
export const KEYING_FALLBACK = "cpu" as const;
export const KEYING_EXPORT_PATH = "shared-compositor" as const;

export type KeyingDebug = {
  backend: KeyingBackend;
  context: GpuKeyDebug["context"] | "none";
  renderer: string;
  vendor: string;
  software: boolean;
};

export function describeKeying(backend: KeyingBackend, debug?: GpuKeyDebug): KeyingDebug {
  if (backend === "webgl" && debug) {
    return { backend, ...debug };
  }
  return { backend: "cpu", context: "none", renderer: "", vendor: "", software: false };
}

/**
 * 保存は使えるならファイルから RGBA コピーしたキャンバス、
 * 能力検出が落ちたら HTML video をキャラ源にする。どちらも同じ compositor `draw()` に渡す。
 */
export type CharacterFrame = {
  source: CanvasImageSource;
  width: number;
  height: number;
};

export function resolveCharacterSource(
  video: HTMLVideoElement,
  override?: CharacterFrame,
): CharacterFrame | null {
  if (override && override.width > 0 && override.height > 0) return override;
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  return { source: video, width: video.videoWidth, height: video.videoHeight };
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
    character?: CharacterFrame,
    characterSize?: CharacterSize,
  ) => number;
  setAspect: (mode: AspectMode) => void;
  setResolutionScale: (scale: number) => void;
  resolutionScale: () => number;
  aspect: () => AspectMode;
  /** 前の再生・書き出しで残ったキャラテクスチャ（最終ポーズ）を捨てる。 */
  resetCharacter: () => void;
  destroy: () => void;
  kind: "2d";
  keying: KeyingBackend;
  keyingDebug: () => KeyingDebug;
};

export function createCompositor(options?: {
  resolutionScale?: number;
  createKeyer?: () => GpuKeyer | null;
  locale?: Locale;
}): Compositor {
  const measureKeyer = () => {
    const create = options?.createKeyer ?? createGpuKeyer;
    const parent = studioTrace.keyerParent();
    if (!parent) return create();
    return traceChildSync(parent, "compositor.keyer_init", (span) => {
      const created = create();
      span?.setAttribute("keying", pickKeyingBackend(created));
      return created;
    });
  };
  let gpuKeyer = measureKeyer();
  let keying = pickKeyingBackend(gpuKeyer);
  let keyingDebug = describeKeying(keying, gpuKeyer?.debug);
  let mode: AspectMode = DEFAULT_ASPECT;
  let resolutionScale = options?.resolutionScale ?? 1;
  const locale = options?.locale ?? DEFAULT_LOCALE;
  const canvas = document.createElement("canvas");
  applyCanvasSize(canvas, mode, resolutionScale);
  canvas.className = "stage-canvas";
  canvas.setAttribute("aria-label", "合成プレビュー");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas2D が使えません");

  const main = document.createElement("canvas");
  const mainCtx = main.getContext("2d", { alpha: false });
  if (!mainCtx) throw new Error("Canvas2D が使えません");

  const photoTiles = document.createElement("canvas");
  const photoTilesCtx = photoTiles.getContext("2d");
  if (!photoTilesCtx) throw new Error("Canvas2D が使えません");

  const keyed = document.createElement("canvas");
  const keyedCtx = keyed.getContext("2d", { willReadFrequently: true });
  if (!keyedCtx) throw new Error("Canvas2D が使えません");

  const halo = document.createElement("canvas");
  const haloCtx = halo.getContext("2d");
  if (!haloCtx) throw new Error("Canvas2D が使えません");

  const fxA = document.createElement("canvas");
  const fxACtx = fxA.getContext("2d", { alpha: false });
  if (!fxACtx) throw new Error("Canvas2D が使えません");

  const fxB = document.createElement("canvas");
  const fxBCtx = fxB.getContext("2d", { alpha: false });
  if (!fxBCtx) throw new Error("Canvas2D が使えません");

  const fxPad = document.createElement("canvas");
  const fxPadCtx = fxPad.getContext("2d", { alpha: false });
  if (!fxPadCtx) throw new Error("Canvas2D が使えません");

  const blur = document.createElement("canvas");
  const blurCtx = blur.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!blurCtx) throw new Error("Canvas2D が使えません");

  const dropGpuKeyer = () => {
    const debug = gpuKeyer?.debug;
    gpuKeyer?.destroy();
    gpuKeyer = null;
    keying = "cpu";
    keyingDebug = debug
      ? { backend: "cpu", ...debug }
      : describeKeying("cpu");
  };
  const surfaces: FxSurfaces = {
    photoTiles,
    photoTilesCtx,
    keyed,
    keyedCtx,
    halo,
    haloCtx,
    fxA,
    fxACtx,
    fxB,
    fxBCtx,
    fxPad,
    fxPadCtx,
    blur,
    blurCtx,
    get gpuKeyer() {
      return gpuKeyer;
    },
    dropGpuKeyer,
  };

  const draw = (
    video: HTMLVideoElement,
    photos: readonly LoadedPhoto[],
    timeline: SlotTimeline,
    time = video.currentTime,
    swapStyle: SwapStyle = "jump",
    imageFilter: ImageFilter = "none",
    character?: CharacterFrame,
    characterSize: CharacterSize = DEFAULT_CHARACTER_SIZE,
  ) => {
    const { slots } = timeline;
    const slot = slotForTime(time, slots);
    applyCanvasSize(canvas, mode, resolutionScale);
    const w = canvas.width;
    const h = canvas.height;
    const panel = mainPanelRect(w, h, mode);
    const fx = swapFx(time, slots, swapStyle, mode);
    const plate = photoForSlot(photos, fx.plateSlot);
    const characterSource = resolveCharacterSource(video, character);

    composeMain(
      main,
      mainCtx,
      surfaces,
      plate,
      characterSource,
      fx,
      swapStyle,
      panel,
      mode,
      imageFilter,
      characterSize,
      time,
      fx.reveal ? photoForSlot(photos, fx.reveal.nextSlot) : undefined,
    );
    if (composeDetailActive()) {
      traceCompose("compose.output", () => {
        paintFrame(ctx, main, w, h);
      });
    } else {
      paintFrame(ctx, main, w, h);
    }
    paintSongCredit(ctx, w, h, mode, locale);
    return slot;
  };

  return {
    canvas,
    draw,
    kind: "2d",
    get keying() {
      return keying;
    },
    keyingDebug() {
      return keyingDebug;
    },
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
    resetCharacter() {
      dropGpuKeyer();
      gpuKeyer = measureKeyer();
      keying = pickKeyingBackend(gpuKeyer);
      keyingDebug = describeKeying(keying, gpuKeyer?.debug);
    },
    destroy() {
      dropGpuKeyer();
      canvas.width = 0;
      canvas.height = 0;
      main.width = 0;
      main.height = 0;
      photoTiles.width = 0;
      photoTiles.height = 0;
      keyed.width = 0;
      keyed.height = 0;
      halo.width = 0;
      halo.height = 0;
      fxA.width = 0;
      fxA.height = 0;
      fxB.width = 0;
      fxB.height = 0;
      fxPad.width = 0;
      fxPad.height = 0;
      blur.width = 0;
      blur.height = 0;
    },
  };
}

type FxSurfaces = {
  photoTiles: HTMLCanvasElement;
  photoTilesCtx: CanvasRenderingContext2D;
  keyed: HTMLCanvasElement;
  keyedCtx: CanvasRenderingContext2D;
  halo: HTMLCanvasElement;
  haloCtx: CanvasRenderingContext2D;
  fxA: HTMLCanvasElement;
  fxACtx: CanvasRenderingContext2D;
  fxB: HTMLCanvasElement;
  fxBCtx: CanvasRenderingContext2D;
  fxPad: HTMLCanvasElement;
  fxPadCtx: CanvasRenderingContext2D;
  blur: HTMLCanvasElement;
  blurCtx: CanvasRenderingContext2D;
  gpuKeyer: GpuKeyer | null;
  dropGpuKeyer: () => void;
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
  plate: LoadedPhoto | undefined,
  character: CharacterFrame | null,
  fx: SwapFx,
  style: SwapStyle,
  panel: { w: number; h: number },
  mode: AspectMode,
  imageFilter: ImageFilter,
  characterSize: CharacterSize,
  time: number,
  nextPlate?: LoadedPhoto,
): void {
  main.width = Math.max(1, Math.round(panel.w));
  main.height = Math.max(1, Math.round(panel.h));
  const mw = main.width;
  const mh = main.height;
  resetCtx(mainCtx);
  mainCtx.fillStyle = PHOTO_BASE_COLOR;
  mainCtx.fillRect(0, 0, mw, mh);

  if (plate) {
    if (composeDetailActive()) {
      traceCompose("compose.photo", () => drawPhotoPlate(mainCtx, surfaces, plate, fx, style, mw, mh));
      traceCompose("compose.filter", () => applyPhotoFilter(main, mainCtx, surfaces, imageFilter));
    } else {
      drawPhotoPlate(mainCtx, surfaces, plate, fx, style, mw, mh);
      applyPhotoFilter(main, mainCtx, surfaces, imageFilter);
    }
    if (style === "charairis" && fx.reveal && nextPlate) {
      const { progress } = fx.reveal;
      const reveal = () => {
        let source: ImageBitmap | HTMLCanvasElement = nextPlate.bitmap;
        if (hasImageFilter(imageFilter)) {
          // 全面FX用の既存作業面を窓内だけ借りる。写真を個別に加工して境界の色混ざりを防ぐ。
          const { fxA, fxACtx } = surfaces;
          ensureCanvasSize(fxA, mw, mh);
          resetCtx(fxACtx);
          fxACtx.fillStyle = PHOTO_BASE_COLOR;
          fxACtx.fillRect(0, 0, mw, mh);
          const dest = coverDest(source.width, source.height, mw, mh);
          fxACtx.drawImage(source, dest.x, dest.y, dest.w, dest.h);
          applyPhotoFilter(fxA, fxACtx, surfaces, imageFilter);
          source = fxA;
        }
        // 白フチと影は写真フィルターの後で描く。
        drawCharaIris(mainCtx, source, mw, mh, progress, charaIrisCenter(time, mw, mh, mode, characterSize));
      };
      if (composeDetailActive()) traceCompose("compose.photo", reveal);
      else reveal();
    }
  }

  if (character) {
    if (composeDetailActive()) {
      traceCompose("compose.character", () => drawCharacter(mainCtx, surfaces, character, mw, mh, mode, characterSize));
    } else {
      drawCharacter(mainCtx, surfaces, character, mw, mh, mode, characterSize);
    }
  }

  if (composeDetailActive() && (hasFrameFx(fx) || fx.flashGlobal > 0.002)) {
    traceCompose("compose.fx", () => {
      if (hasFrameFx(fx)) applyFrameFx(main, mainCtx, surfaces, fx);
      if (fx.flashGlobal > 0.002) {
        resetCtx(mainCtx);
        mainCtx.fillStyle = `rgba(255, 255, 255, ${fx.flashGlobal})`;
        mainCtx.fillRect(0, 0, mw, mh);
      }
    });
  } else {
    if (hasFrameFx(fx)) {
      applyFrameFx(main, mainCtx, surfaces, fx);
    }
    if (fx.flashGlobal > 0.002) {
      resetCtx(mainCtx);
      mainCtx.fillStyle = `rgba(255, 255, 255, ${fx.flashGlobal})`;
      mainCtx.fillRect(0, 0, mw, mh);
    }
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

/**
 * 写真層。ズームで縮んだときはプレートの縁で鏡映し、色と輝度を連続させる。
 * ジャンプのフラッシュ（加算＋スクリーン）は写真層にだけ乗せる。
 */
function drawPhotoPlate(
  ctx: CanvasRenderingContext2D,
  surfaces: FxSurfaces,
  photo: LoadedPhoto,
  fx: SwapFx,
  style: SwapStyle,
  mw: number,
  mh: number,
): void {
  const bitmap = photo.bitmap;
  resetCtx(ctx);
  const dest = plateDest(bitmap.width, bitmap.height, mw, mh, fx, style);
  // cover 矩形の丸め誤差ではなく実倍率で判定し、backdrop の閾値未満の縮みも補完する。
  if (style === "zoom" && fx.scale < 1) {
    const { photoTiles, photoTilesCtx: tilesCtx } = surfaces;
    photoTiles.width = mw;
    photoTiles.height = mh;
    // 小数位置で接するタイルの被覆率を加算する。source-over では境界に下地が残る。
    // 透明な面で合成してから既存の下地に重ね、透過部分にも同じ下地色を残す。
    tilesCtx.globalCompositeOperation = "lighter";
    for (const row of [-1, 0, 1]) {
      for (const col of [-1, 0, 1]) {
        const x = dest.x + col * dest.w;
        const y = dest.y + row * dest.h;
        if (x >= mw || x + dest.w <= 0 || y >= mh || y + dest.h <= 0) continue;
        const sx = col === 0 ? 1 : -1;
        const sy = row === 0 ? 1 : -1;
        tilesCtx.setTransform(sx, 0, 0, sy, x + (sx < 0 ? dest.w : 0), y + (sy < 0 ? dest.h : 0));
        tilesCtx.drawImage(bitmap, 0, 0, dest.w, dest.h);
      }
    }
    ctx.drawImage(photoTiles, 0, 0);
  } else {
    ctx.drawImage(bitmap, dest.x, dest.y, dest.w, dest.h);
  }
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
  surfaces: FxSurfaces,
  character: CharacterFrame,
  mw: number,
  mh: number,
  mode: AspectMode,
  characterSize: CharacterSize,
): void {
  const fallback = outputSize(mode);
  const vw = character.width || fallback.width;
  const vh = character.height || fallback.height;
  const band = templateBandRect(vw, vh, mode);
  const placed = characterDest(mw, mh, characterScale(mode, characterSize), characterShiftY(mh, mode), mode);
  // 横は従来どおり本編サイズでキーしてから拡大する。縦は置いたプレートの解像度でキーする。
  const keyW = mode === "portrait" ? Math.max(1, Math.round(placed.w)) : mw;
  const keyH = mode === "portrait" ? Math.max(1, Math.round(placed.h)) : mh;
  const keyedSource = keyCharacterBand(surfaces, character, band, keyW, keyH);
  paintCharacterOverlay(mainCtx, surfaces, keyedSource, placed, keyW, keyH, mw, mode);
}

function keyCharacterBand(
  surfaces: FxSurfaces,
  character: CharacterFrame,
  band: { x: number; y: number; w: number; h: number },
  mw: number,
  mh: number,
): CanvasImageSource {
  const gpu = surfaces.gpuKeyer;
  if (gpu?.isLost()) {
    surfaces.dropGpuKeyer();
  } else {
    const source = gpuKeyTexImageSource(character.source);
    const framed = Boolean(
      source && gpu?.keyVideoBand(source, character.width, character.height, band, mw, mh),
    );
    if (shouldUseGpuFrame(gpu, framed)) {
      return gpu.canvas;
    }
  }

  const { keyed, keyedCtx } = surfaces;
  keyed.width = mw;
  keyed.height = mh;
  keyedCtx.clearRect(0, 0, mw, mh);
  keyedCtx.drawImage(character.source, band.x, band.y, band.w, band.h, 0, 0, mw, mh);
  const image = keyedCtx.getImageData(0, 0, mw, mh);
  keyImageData(image);
  keyedCtx.putImageData(image, 0, 0);
  return keyed;
}

function paintCharacterOverlay(
  mainCtx: CanvasRenderingContext2D,
  { halo, haloCtx }: FxSurfaces,
  keyedSource: CanvasImageSource,
  dest: { x: number; y: number; w: number; h: number },
  keyW: number,
  keyH: number,
  mw: number,
  mode: AspectMode,
): void {
  halo.width = keyW;
  halo.height = keyH;
  haloCtx.clearRect(0, 0, keyW, keyH);
  haloCtx.globalCompositeOperation = "source-over";
  haloCtx.drawImage(keyedSource, 0, 0);
  haloCtx.globalCompositeOperation = "source-in";
  haloCtx.fillStyle = "#ffffff";
  haloCtx.fillRect(0, 0, keyW, keyH);
  haloCtx.globalCompositeOperation = "source-over";

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
  // 縦だけ: 素材の固定カットより下には白縁を描かない。横の縁と、カットより上のパーツの縁は残す。
  const clipBottom = mode === "portrait" ? portraitCutY(dest) : null;
  resetCtx(mainCtx);
  if (clipBottom != null) {
    mainCtx.save();
    mainCtx.beginPath();
    mainCtx.rect(-o * 4, -o * 4, mw + o * 8, clipBottom + o * 4);
    mainCtx.clip();
  }
  for (const [ox, oy] of ring) {
    mainCtx.drawImage(halo, dest.x + ox, dest.y + oy, dest.w, dest.h);
  }
  if (clipBottom != null) mainCtx.restore();
  mainCtx.drawImage(keyedSource, dest.x, dest.y, dest.w, dest.h);
}

/** 横モーションブラーのコピー数。長さに応じて増やし、平均合成で滑らかにする。 */
export function blurTapCount(blurPx: number): number {
  if (blurPx < 1) return 1;
  return Math.min(15, Math.max(3, Math.round(blurPx / 2.5) | 1));
}

/** 横ずらしのサンプル範囲を端の画素で延長する。各タップを一度で描き、隙間や二重加算を防ぐ。 */
function padFrameX(
  source: HTMLCanvasElement,
  { fxPad, fxPadCtx }: FxSurfaces,
  pad: number,
): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  ensureCanvasSize(fxPad, w + pad * 2, h);
  resetCtx(fxPadCtx);
  fxPadCtx.imageSmoothingEnabled = false;
  fxPadCtx.drawImage(source, pad, 0);
  fxPadCtx.drawImage(source, 0, 0, 1, h, 0, 0, pad, h);
  fxPadCtx.drawImage(source, w - 1, 0, 1, h, pad + w, 0, pad, h);
  return fxPad;
}

/**
 * 参考ズーム（hagikaze_sami）の全面 FX。合成済み本編（写真＋キャラ）に対して
 * 行波打ち → 横モーションブラー → RGB 横ずれ（R 右・B 左）→ 白加算／灰かぶり の順。
 */
function applyFrameFx(
  main: HTMLCanvasElement,
  mainCtx: CanvasRenderingContext2D,
  surfaces: FxSurfaces,
  fx: SwapFx,
): void {
  const w = main.width;
  const h = main.height;
  const { fxA, fxACtx, fxB, fxBCtx } = surfaces;
  const waveAmp = fx.wave * w;
  const blurPx = fx.blur * w;
  const rgbPx = fx.rgb * w;
  const pad = Math.ceil(Math.max(waveAmp, blurPx / 2, rgbPx)) + 1;
  fxA.width = w;
  fxA.height = h;
  fxB.width = w;
  fxB.height = h;
  resetCtx(fxACtx);
  resetCtx(fxBCtx);

  // 1) 波打ち: 行帯ごとに横へずらしながら main → fxA
  if (waveAmp >= 0.5) {
    const padded = padFrameX(main, surfaces, pad);
    const bands = 24;
    for (let i = 0; i < bands; i += 1) {
      // 行帯の境界を整数画素に揃え、小数高さで生じる被覆の隙間もなくす。
      const y = Math.round(i * h / bands);
      const bh = Math.round((i + 1) * h / bands) - y;
      if (bh === 0) continue;
      const dx = Math.sin((i / bands) * Math.PI * 3.4 + fx.blur * 40) * waveAmp;
      fxACtx.drawImage(padded, 0, y, padded.width, bh, dx - pad, y, padded.width, bh);
    }
  } else {
    fxACtx.drawImage(main, 0, 0);
  }

  // 2) 横モーションブラー: fxA を N 回ずらして平均 → fxB
  const taps = blurTapCount(blurPx);
  if (taps > 1) {
    const padded = padFrameX(fxA, surfaces, pad);
    for (let i = 0; i < taps; i += 1) {
      const t = i / (taps - 1) - 0.5;
      fxBCtx.globalAlpha = 1 / (i + 1);
      fxBCtx.drawImage(padded, t * blurPx - pad, 0);
    }
    fxBCtx.globalAlpha = 1;
  } else {
    fxBCtx.drawImage(fxA, 0, 0);
  }

  // 3) RGB 横ずれ: fxB をチャンネル分解して加算合成で main に戻す
  resetCtx(mainCtx);
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
      mainCtx.drawImage(padFrameX(fxA, surfaces, pad), dx - pad, 0);
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

function paintFrame(ctx: CanvasRenderingContext2D, main: HTMLCanvasElement, w: number, h: number): void {
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

export const SONG_CREDIT = songCreditLine();

/** 横短辺×この比。縦はプレビュー CSS スケールで横と同じ見た目になるよう小さくする。 */
export const SONG_CREDIT_FONT_FRAC = 0.055;

/** 横プレビュー（26rem / 1920）でのクレジットの画面上サイズに、縦を合わせる。 */
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
 * 縦横とも画面右下。縦は全面写真の上なので、キャラの水平カット（y≈75.8%）より下に置く。
 * どちらも小さな inset。縦の字の大きさはプレビューの見た目が横と揃うよう小さめ。
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
  return {
    fontSize,
    pad,
    x: canvasW - pad,
    y: canvasH - pad,
    textAlign: "right",
    textBaseline: "bottom",
  };
}

const SONG_CREDIT_FONT =
  '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif';

function paintSongCredit(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: AspectMode,
  locale: Locale = DEFAULT_LOCALE,
): void {
  const credit = songCreditLine(locale);
  const layout = songCreditLayout(w, h, mode);
  let { fontSize, x, y, textAlign, textBaseline, pad } = layout;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  const maxWidth = Math.max(1, w - pad * 2);
  ctx.font = `500 ${fontSize}px ${SONG_CREDIT_FONT}`;
  while (fontSize > 10 && ctx.measureText(credit).width > maxWidth) {
    fontSize -= 1;
    ctx.font = `500 ${fontSize}px ${SONG_CREDIT_FONT}`;
  }
  ctx.textAlign = textAlign;
  ctx.textBaseline = textBaseline;
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = Math.max(3, Math.round(fontSize * 0.32));
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.06));
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fillText(credit, x, y);
  ctx.restore();
}
