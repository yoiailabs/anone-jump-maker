import { ensureCanvasSize } from "./canvas-size.ts";
import { keyImageData } from "./keying.ts";
import {
  BLUR_COVER_SCALE,
  BLUR_DIM,
  PANEL_DIVIDER_PX,
  characterDest,
  characterOutlinePx,
  characterScale,
  characterShiftY,
  coverDest,
  jumpOffsetPx,
  mainPanelRect,
  outputSize,
  sharpCoverScale,
  swapChromaPx,
  swapFx,
  swapSlidePx,
  templateBandRect,
  usesBlurBackdrop,
  type AspectMode,
} from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";
import { photoForSlot, slotForTime } from "./timeline.ts";

export { BLUR_SOURCE, OUTPUT, OUTPUTS, type AspectMode } from "./layout.ts";

/**
 * ImageBitmap を WebGL に直接 texImage2D し、かつ UNPACK_FLIP_Y_WEBGL=1 にすると
 * ブラウザによっては（ImageBitmap が既に GL 向け Y 反転済みのため）写真だけ上下逆になる。
 * 写真は Canvas2D に描いてから使う。
 */
export const PHOTO_UPLOAD_PATH = "canvas2d-blit" as const;

export type Compositor = {
  canvas: HTMLCanvasElement;
  draw: (video: HTMLVideoElement, photos: readonly LoadedPhoto[], slots: readonly number[]) => number;
  setAspect: (mode: AspectMode) => void;
  aspect: () => AspectMode;
  destroy: () => void;
  kind: "2d";
};

export function createCompositor(): Compositor {
  let mode: AspectMode = "portrait";
  const canvas = document.createElement("canvas");
  applyCanvasSize(canvas, mode);
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

  const draw = (video: HTMLVideoElement, photos: readonly LoadedPhoto[], slots: readonly number[]) => {
    const time = video.currentTime;
    const slot = slotForTime(time, slots);
    const photo = photoForSlot(photos, slot);
    applyCanvasSize(canvas, mode);
    const w = canvas.width;
    const h = canvas.height;
    const panel = mainPanelRect(w, h, mode);
    const hopY = jumpOffsetPx(time, slots, h);
    const fx = swapFx(time, slots);

    composeMain(main, mainCtx, keyed, keyedCtx, halo, haloCtx, photo, video, hopY, fx, panel, h, mode);
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
      applyCanvasSize(canvas, mode);
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
    },
  };
}

function applyCanvasSize(canvas: HTMLCanvasElement, mode: AspectMode): void {
  const size = outputSize(mode);
  ensureCanvasSize(canvas, size.width, size.height);
}

function composeMain(
  main: HTMLCanvasElement,
  mainCtx: CanvasRenderingContext2D,
  keyed: HTMLCanvasElement,
  keyedCtx: CanvasRenderingContext2D,
  halo: HTMLCanvasElement,
  haloCtx: CanvasRenderingContext2D,
  photo: LoadedPhoto | undefined,
  video: HTMLVideoElement,
  hopY: number,
  fx: ReturnType<typeof swapFx>,
  panel: { w: number; h: number },
  canvasH: number,
  mode: AspectMode,
): void {
  main.width = Math.max(1, Math.round(panel.w));
  main.height = Math.max(1, Math.round(panel.h));
  const mw = main.width;
  const mh = main.height;
  mainCtx.setTransform(1, 0, 0, 1, 0, 0);
  mainCtx.filter = "none";
  mainCtx.fillStyle = "#0a0806";
  mainCtx.fillRect(0, 0, mw, mh);

  if (photo) {
    const dest = coverDest(photo.bitmap.width, photo.bitmap.height, mw, mh, {
      scale: sharpCoverScale(canvasH, mh) * fx.punch,
      offsetY: hopY,
      dx: swapSlidePx(fx, mw),
    });
    drawPhotoPlate(mainCtx, photo, dest, fx.skew, swapChromaPx(fx, mw));
  }

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
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
    for (const [ox, oy] of ring) {
      mainCtx.drawImage(halo, dest.x + ox, dest.y + oy, dest.w, dest.h);
    }
    mainCtx.drawImage(keyed, dest.x, dest.y, dest.w, dest.h);
  }

  if (fx.flash > 0.004) {
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.filter = "none";
    mainCtx.globalAlpha = 1;
    mainCtx.fillStyle = `rgba(255, 255, 255, ${fx.flash})`;
    mainCtx.fillRect(0, 0, mw, mh);
  }
}

function drawPhotoPlate(
  ctx: CanvasRenderingContext2D,
  photo: LoadedPhoto,
  dest: { x: number; y: number; w: number; h: number },
  skew: number,
  chromaPx: number,
): void {
  ctx.save();
  ctx.setTransform(1, 0, skew, 1, 0, 0);
  ctx.drawImage(photo.bitmap, dest.x, dest.y, dest.w, dest.h);
  if (chromaPx >= 0.6) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.4;
    ctx.drawImage(photo.bitmap, dest.x - chromaPx, dest.y, dest.w, dest.h);
    ctx.drawImage(photo.bitmap, dest.x + chromaPx, dest.y, dest.w, dest.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
}

function paintLandscape(ctx: CanvasRenderingContext2D, main: HTMLCanvasElement, w: number, h: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.drawImage(main, 0, 0, w, h);
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

/** 旧 short×0.022（縦 13 / 横 16）の約 2.5 倍。ピルなし白文字。 */
export const SONG_CREDIT_FONT_FRAC = 0.055;

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
  const fontSize = Math.max(28, Math.round(short * SONG_CREDIT_FONT_FRAC));
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
