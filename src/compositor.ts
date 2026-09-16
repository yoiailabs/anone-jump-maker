import { keyImageData } from "./keying.ts";
import {
  BLUR_COVER_SCALE,
  BLUR_DIM,
  OUTPUT,
  PANEL_DIVIDER_PX,
  coverDest,
  jumpOffsetPx,
  mainPanelRect,
  sharpCoverScale,
  templateBandRect,
} from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";
import { photoForSlot, slotForTime } from "./timeline.ts";

export { BLUR_SOURCE, OUTPUT } from "./layout.ts";

/**
 * ImageBitmap を WebGL に直接 texImage2D し、かつ UNPACK_FLIP_Y_WEBGL=1 にすると
 * ブラウザによっては（ImageBitmap が既に GL 向け Y 反転済みのため）写真だけ上下逆になる。
 * 写真は Canvas2D に描いてから使う。
 */
export const PHOTO_UPLOAD_PATH = "canvas2d-blit" as const;

export type Compositor = {
  canvas: HTMLCanvasElement;
  draw: (video: HTMLVideoElement, photos: readonly LoadedPhoto[], slots: readonly number[]) => number;
  destroy: () => void;
  kind: "2d";
};

export function createCompositor(): Compositor {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT.width;
  canvas.height = OUTPUT.height;
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

  const draw = (video: HTMLVideoElement, photos: readonly LoadedPhoto[], slots: readonly number[]) => {
    const slot = slotForTime(video.currentTime, slots);
    const photo = photoForSlot(photos, slot);
    canvas.width = OUTPUT.width;
    canvas.height = OUTPUT.height;
    const w = canvas.width;
    const h = canvas.height;
    const panel = mainPanelRect(w, h);
    const hopY = jumpOffsetPx(video.currentTime, slots, h);

    composeMain(main, mainCtx, keyed, keyedCtx, photo, video, hopY, panel, h);
    paintOutput(ctx, scratch, scratchCtx, main, panel, w, h);
    return slot;
  };

  return {
    canvas,
    draw,
    kind: "2d",
    destroy() {
      canvas.width = 0;
      canvas.height = 0;
      main.width = 0;
      main.height = 0;
      keyed.width = 0;
      keyed.height = 0;
      scratch.width = 0;
      scratch.height = 0;
    },
  };
}

function composeMain(
  main: HTMLCanvasElement,
  mainCtx: CanvasRenderingContext2D,
  keyed: HTMLCanvasElement,
  keyedCtx: CanvasRenderingContext2D,
  photo: LoadedPhoto | undefined,
  video: HTMLVideoElement,
  hopY: number,
  panel: { w: number; h: number },
  canvasH: number,
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
      scale: sharpCoverScale(canvasH, mh),
      offsetY: hopY,
    });
    mainCtx.drawImage(photo.bitmap, dest.x, dest.y, dest.w, dest.h);
  }

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    const vw = video.videoWidth || OUTPUT.width;
    const vh = video.videoHeight || OUTPUT.height;
    const band = templateBandRect(vw, vh);
    keyed.width = mw;
    keyed.height = mh;
    keyedCtx.clearRect(0, 0, mw, mh);
    keyedCtx.drawImage(video, band.x, band.y, band.w, band.h, 0, 0, mw, mh);
    const image = keyedCtx.getImageData(0, 0, mw, mh);
    keyImageData(image);
    keyedCtx.putImageData(image, 0, 0);
    mainCtx.drawImage(keyed, 0, 0);
  }
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

  scratch.width = Math.max(40, Math.round(w * 0.12));
  scratch.height = Math.max(40, Math.round(h * 0.12));
  const sw = scratch.width;
  const sh = scratch.height;
  scratchCtx.fillStyle = "#0a0806";
  scratchCtx.fillRect(0, 0, sw, sh);
  const blurDest = coverDest(main.width, main.height, sw, sh, { scale: BLUR_COVER_SCALE });
  scratchCtx.drawImage(main, blurDest.x, blurDest.y, blurDest.w, blurDest.h);

  ctx.save();
  ctx.filter = "blur(42px)";
  ctx.drawImage(scratch, -56, -56, w + 112, h + 112);
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
