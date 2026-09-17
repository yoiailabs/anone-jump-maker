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
  effectiveSwapStyle,
  jumpOffsetPx,
  mainPanelRect,
  OUTPUTS,
  outputSize,
  sharpCoverScale,
  swapChromaPx,
  swapFx,
  swapSlidePx,
  templateBandRect,
  usesBlurBackdrop,
  zoomPlateScales,
  type AspectMode,
  type SwapFx,
  type SwapStyle,
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
  draw: (
    video: HTMLVideoElement,
    photos: readonly LoadedPhoto[],
    slots: readonly number[],
    time?: number,
    swapStyle?: SwapStyle,
  ) => number;
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

  const warp = document.createElement("canvas");
  const warpCtx = warp.getContext("2d", { alpha: false });
  if (!warpCtx) throw new Error("Canvas2D が使えません");

  const draw = (
    video: HTMLVideoElement,
    photos: readonly LoadedPhoto[],
    slots: readonly number[],
    time = video.currentTime,
    swapStyle: SwapStyle = "jump",
  ) => {
    const style = effectiveSwapStyle(mode, swapStyle);
    const slot = slotForTime(time, slots);
    const photo = photoForSlot(photos, slot);
    applyCanvasSize(canvas, mode);
    const w = canvas.width;
    const h = canvas.height;
    const panel = mainPanelRect(w, h, mode);
    const hopY = jumpOffsetPx(time, slots, h, style);
    const fx = swapFx(time, slots, style);
    const incoming = fx.cutIndex > 0 ? photoForSlot(photos, fx.cutIndex) : photo;
    const outgoing = fx.cutIndex > 0 ? photoForSlot(photos, fx.cutIndex - 1) : undefined;

    composeMain(
      main,
      mainCtx,
      keyed,
      keyedCtx,
      halo,
      haloCtx,
      warp,
      warpCtx,
      photo,
      outgoing,
      incoming,
      video,
      hopY,
      fx,
      panel,
      h,
      mode,
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
      warp.width = 0;
      warp.height = 0;
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
  warp: HTMLCanvasElement,
  warpCtx: CanvasRenderingContext2D,
  photo: LoadedPhoto | undefined,
  outgoing: LoadedPhoto | undefined,
  incoming: LoadedPhoto | undefined,
  video: HTMLVideoElement,
  hopY: number,
  fx: SwapFx,
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

  const plate = incoming ?? photo;
  if (plate) {
    const dest = coverDest(plate.bitmap.width, plate.bitmap.height, mw, mh, {
      scale: sharpCoverScale(canvasH, mh) * fx.punch,
      offsetY: hopY,
      dx: swapSlidePx(fx, mw),
    });
    if (fx.zoomBlur > 0.02) {
      drawZoomWarpPlate(mainCtx, warp, warpCtx, outgoing ?? plate, plate, dest, fx, swapChromaPx(fx, mw));
    } else {
      drawPhotoPlate(mainCtx, plate, dest, fx.skew, swapChromaPx(fx, mw));
    }
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
    if (fx.smear > 0.03) {
      smearCharacter(mainCtx, keyed, halo, dest, ring, fx.smear);
    }
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

function smearCharacter(
  ctx: CanvasRenderingContext2D,
  keyed: HTMLCanvasElement,
  halo: HTMLCanvasElement,
  dest: { x: number; y: number; w: number; h: number },
  ring: ReadonlyArray<readonly [number, number]>,
  amount: number,
): void {
  const smearPx = Math.max(3, dest.w * 0.011 * amount);
  const copies: ReadonlyArray<readonly [number, number, number]> = [
    [-smearPx, 0, 0.34],
    [smearPx, 0, 0.34],
    [0, smearPx * 0.22, 0.16],
  ];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  for (const [sx, sy, alpha] of copies) {
    ctx.globalAlpha = alpha * amount;
    for (const [ox, oy] of ring) {
      ctx.drawImage(halo, dest.x + ox + sx, dest.y + oy + sy, dest.w, dest.h);
    }
    ctx.drawImage(keyed, dest.x + sx, dest.y + sy, dest.w, dest.h);
  }
  const grow = 1 + 0.04 * amount;
  const w = dest.w * grow;
  const h = dest.h * grow;
  ctx.globalAlpha = 0.14 * amount;
  ctx.drawImage(keyed, dest.x - (w - dest.w) / 2, dest.y - (h - dest.h) / 2, w, h);
  ctx.restore();
}

/**
 * 参考横のズームアウト。出ていく写真は中心へ縮み、入ってくる写真は寄った状態から引く。
 * 放射ブラー＋横ストリーク＋ RGB ずれ＋軽い波打ち。
 */
function drawZoomWarpPlate(
  ctx: CanvasRenderingContext2D,
  warp: HTMLCanvasElement,
  warpCtx: CanvasRenderingContext2D,
  outgoing: LoadedPhoto,
  incoming: LoadedPhoto,
  dest: { x: number; y: number; w: number; h: number },
  fx: SwapFx,
  chromaPx: number,
): void {
  const mw = ctx.canvas.width;
  const mh = ctx.canvas.height;
  warp.width = mw;
  warp.height = mh;
  warpCtx.setTransform(1, 0, 0, 1, 0, 0);
  warpCtx.filter = "none";
  warpCtx.globalAlpha = 1;
  warpCtx.globalCompositeOperation = "source-over";
  warpCtx.fillStyle = "#0a0806";
  warpCtx.fillRect(0, 0, mw, mh);

  const { outgoing: outScale, incoming: inScale } = zoomPlateScales(fx);
  const outAlpha = (1 - fx.mix) * 0.88;
  if (outAlpha > 0.02) {
    paintRadialStreaks(
      warpCtx,
      outgoing,
      dest,
      outScale,
      outAlpha,
      fx.zoomBlur,
      fx.whip,
      chromaPx,
    );
  }
  const inAlpha = Math.min(1, 0.4 + fx.mix * 0.6);
  paintRadialStreaks(
    warpCtx,
    incoming,
    dest,
    inScale,
    inAlpha,
    fx.zoomBlur * Math.max(0.4, fx.mix),
    fx.whip * 0.7,
    chromaPx * 0.8,
  );

  blitWavedPlate(ctx, warp, fx.wave, fx.zoomBlur);
}

function paintCopy(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha: number,
  chromaPx: number,
): void {
  if (chromaPx >= 0.5 && alpha > 0.04) {
    ctx.globalAlpha = alpha * 0.55;
    ctx.filter = "sepia(1) saturate(14) hue-rotate(-22deg)";
    ctx.drawImage(bitmap, x - chromaPx, y, w, h);
    ctx.filter = "sepia(1) saturate(14) hue-rotate(158deg)";
    ctx.drawImage(bitmap, x + chromaPx, y, w, h);
    ctx.filter = "none";
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(bitmap, x, y, w, h);
}

function paintRadialStreaks(
  ctx: CanvasRenderingContext2D,
  photo: LoadedPhoto,
  dest: { x: number; y: number; w: number; h: number },
  scale: number,
  alpha: number,
  blur: number,
  whip: number,
  chromaPx: number,
): void {
  const cx = dest.x + dest.w / 2;
  const cy = dest.y + dest.h / 2;
  const steps = Math.max(6, Math.round(5 + 8 * blur));
  const grow = 0.48 * blur + Math.max(0, scale - 1) * 0.28;
  const bitmap = photo.bitmap;

  ctx.save();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";

  for (let i = steps; i >= 1; i -= 1) {
    const t = i / steps;
    // ズームアウトの放射ブラーは内側（より小さいコピー）へ伸ばす。
    const s = Math.max(0.12, scale * (1 - grow * t));
    const w = dest.w * s;
    const h = dest.h * s;
    paintCopy(ctx, bitmap, cx - w / 2, cy - h / 2, w, h, alpha * 0.18 * (1 - t * 0.45), chromaPx);
  }

  const streak = dest.w * 0.046 * whip;
  const n = Math.max(0, Math.round(5 * whip));
  const w0 = dest.w * scale;
  const h0 = dest.h * scale;
  for (let i = n; i >= 1; i -= 1) {
    const t = i / n;
    const ghost = alpha * 0.16 * (1 - t * 0.35);
    paintCopy(ctx, bitmap, cx - w0 / 2 - streak * t, cy - h0 / 2, w0, h0, ghost, chromaPx);
    paintCopy(ctx, bitmap, cx - w0 / 2 + streak * t, cy - h0 / 2, w0, h0, ghost, chromaPx);
  }

  paintCopy(ctx, bitmap, cx - w0 / 2, cy - h0 / 2, w0, h0, alpha, chromaPx);
  ctx.restore();
}

function blitWavedPlate(ctx: CanvasRenderingContext2D, plate: HTMLCanvasElement, wave: number, amount: number): void {
  const w = plate.width;
  const h = plate.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  const waveAmp = h * 0.018 * wave;
  const bands = wave > 0.04 ? 16 : 1;
  if (bands <= 1) {
    ctx.drawImage(plate, 0, 0);
    ctx.restore();
    return;
  }
  const bh = h / bands;
  for (let i = 0; i < bands; i += 1) {
    const y = i * bh;
    const dx = Math.sin((i / bands) * Math.PI * 3.4 + amount * 6) * waveAmp;
    ctx.drawImage(plate, 0, y, w, bh, dx, y, w, bh);
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

/** 横短辺×この比。縦も同じ fontSize を使う（短辺基準だと縦だけ大きく見える）。 */
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
  const landscapeShort = Math.min(OUTPUTS.landscape.width, OUTPUTS.landscape.height);
  const fontSize = Math.max(28, Math.round(landscapeShort * SONG_CREDIT_FONT_FRAC));
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
