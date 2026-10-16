import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import { afterEach, describe, expect, it } from "vitest";
import { beginTemplateVideoLoad, createTemplateVideo } from "./app.ts";
import { previewResolutionScale } from "./canvas-size.ts";
import { createCompositor } from "./compositor.ts";
import {
  EXPORT_FPS,
  exportJumpVideo,
  hasWebCodecsVideoEncoder,
  putRgbaOnCanvas,
  seekVideo,
  UNSUPPORTED_EXPORT_MESSAGE,
} from "./export.ts";
import { createGpuKeyer } from "./keying-gpu.ts";
import { JUMP_DROP_FRAC, JUMP_DROP_FRAC_PORTRAIT, OUTPUTS, TEMPLATES } from "./layout.ts";
import { pickOfflinePlan } from "./offline-encode.ts";
import { loadPhotos, type LoadedPhoto } from "./photos.ts";

afterEach(() => {
  document.querySelectorAll("canvas, video").forEach((el) => el.remove());
});

describe("createTemplateVideo", () => {
  it("marks the element playsinline for iOS Safari and does not preload the file", () => {
    const video = createTemplateVideo("landscape");
    expect(video.playsInline).toBe(true);
    expect(video.getAttribute("playsinline")).toBe("");
    expect(video.getAttribute("webkit-playsinline")).toBe("");
    expect(video.className).toBe("offscreen-video");
    expect(video.preload).toBe("none");
    expect(video.getAttribute("src")).toBeNull();
    expect(video.dataset.templateSrc).toBe(TEMPLATES.landscape.video);
    video.remove();
  });
});

describe("beginTemplateVideoLoad", () => {
  it("assigns src and switches preload to auto once", () => {
    const video = createTemplateVideo("portrait");
    beginTemplateVideoLoad(video);
    expect(video.preload).toBe("auto");
    expect(video.getAttribute("src")).toBe(TEMPLATES.portrait.video);
    beginTemplateVideoLoad(video);
    expect(video.getAttribute("src")).toBe(TEMPLATES.portrait.video);
    video.remove();
  });
});

describe("createCompositor", () => {
  it("paints a photo plate at preview resolution in both aspects", async () => {
    const compositor = createCompositor({
      resolutionScale: previewResolutionScale("landscape"),
      createKeyer: () => null,
    });
    const photo = await makePhoto("#e24a3d");
    const video = document.createElement("video");
    const timeline = { slots: [0, 0.5], slotPhotoOrder: [0, 1] };
    try {
      expect(compositor.aspect()).toBe("landscape");
      expect(compositor.canvas.width).toBe(640);
      expect(compositor.canvas.height).toBe(360);
      expect(compositor.keying).toBe("cpu");

      const slot = compositor.draw(video, [photo], timeline, 0, "jump", "none");
      expect(slot).toBe(0);
      const landscape = sampleCenter(compositor.canvas);
      expect(landscape[0]).toBeGreaterThan(80);
      expect(landscape[3]).toBe(255);

      compositor.setAspect("portrait");
      compositor.setResolutionScale(previewResolutionScale("portrait"));
      compositor.draw(video, [photo], timeline, 0.12, "zoom", "blur-weak");
      expect(compositor.canvas.width).toBe(360);
      expect(compositor.canvas.height).toBe(640);
      expect(compositor.canvas.width * compositor.canvas.height).toBe(640 * 360);
      const portrait = sampleCenter(compositor.canvas);
      expect(portrait[0] + portrait[1] + portrait[2]).toBeGreaterThan(20);
    } finally {
      photo.bitmap.close();
      compositor.destroy();
    }
  });

  it("matches portrait jump travel to the short side on the preview draw path", async () => {
    const compositor = createCompositor({
      resolutionScale: previewResolutionScale("landscape"),
      createKeyer: () => null,
    });
    const photo = await makeStripePhoto();
    const video = document.createElement("video");
    const timeline = { slots: [0, 0.5], slotPhotoOrder: [0, 1] };
    const restTime = 7 / 30;
    const shift = (mode: "portrait" | "landscape") => {
      compositor.setAspect(mode);
      compositor.setResolutionScale(previewResolutionScale(mode));
      compositor.draw(video, [photo], timeline, restTime, "jump", "none");
      const rest = markerRow(compositor.canvas);
      compositor.draw(video, [photo], timeline, 0, "jump", "none");
      const cut = markerRow(compositor.canvas);
      return {
        travel: cut - rest,
        width: compositor.canvas.width,
        height: compositor.canvas.height,
      };
    };
    try {
      const landscape = shift("landscape");
      const portrait = shift("portrait");
      expect(landscape).toMatchObject({ width: 640, height: 360 });
      expect(portrait).toMatchObject({ width: 360, height: 640 });
      expect(landscape.travel).toBeCloseTo(JUMP_DROP_FRAC * landscape.height, 0);
      expect(portrait.travel).toBeCloseTo(JUMP_DROP_FRAC_PORTRAIT * portrait.height, 0);
      expect(portrait.travel / portrait.width).toBeCloseTo(JUMP_DROP_FRAC, 3);
      expect(landscape.travel / landscape.height).toBeCloseTo(JUMP_DROP_FRAC, 3);
    } finally {
      photo.bitmap.close();
      compositor.destroy();
    }
  });

  it("draws standard and scaled character plates at 1.2 and 1.4", async () => {
    const compositor = createCompositor({
      resolutionScale: 1,
      createKeyer: () => null,
    });
    const photo = await makePhoto("#22ccee");
    const characterCanvas = document.createElement("canvas");
    characterCanvas.width = 1280;
    characterCanvas.height = 720;
    const cctx = characterCanvas.getContext("2d");
    expect(cctx).toBeTruthy();
    cctx!.fillStyle = "#20b836";
    cctx!.fillRect(0, 0, 1280, 720);
    cctx!.fillStyle = "#111111";
    cctx!.fillRect(0, 360, 1280, 360);
    const character = { source: characterCanvas, width: 1280, height: 720 };
    const video = document.createElement("video");
    const timeline = { slots: [0, 0.5], slotPhotoOrder: [0, 1] };
    const sample = (x: number, y: number) => {
      const ctx = compositor.canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      return ctx.getImageData(x, y, 1, 1).data;
    };
    const luma = (px: Uint8ClampedArray) => (px[0] ?? 0) + (px[1] ?? 0) + (px[2] ?? 0);
    try {
      compositor.draw(video, [photo], timeline, 0.2, "zoom", "none", character, "standard");
      const standardUpper = sample(640, 280);
      const standardLower = sample(640, 540);
      expect(luma(standardUpper)).toBeGreaterThan(80);
      expect(luma(standardLower)).toBeLessThan(80);

      compositor.draw(video, [photo], timeline, 0.2, "zoom", "none", character, "1.2");
      expect(luma(sample(640, 250))).toBeGreaterThan(80);
      expect(luma(sample(640, 400))).toBeLessThan(80);

      compositor.draw(video, [photo], timeline, 0.2, "zoom", "none", character, "1.4");
      expect(luma(sample(640, 280))).toBeLessThan(80);
      expect(luma(sample(640, 540))).toBeLessThan(80);
    } finally {
      photo.bitmap.close();
      compositor.destroy();
    }
  });
});

describe("createGpuKeyer", () => {
  it("keys a green plate when WebGL is available", () => {
    const keyer = createGpuKeyer();
    if (!keyer) {
      expect(keyer).toBeNull();
      return;
    }
    try {
      expect(keyer.debug?.context).toMatch(/webgl/);
      const plate = document.createElement("canvas");
      plate.width = 64;
      plate.height = 36;
      const ctx = plate.getContext("2d");
      expect(ctx).toBeTruthy();
      ctx!.fillStyle = "#20b836";
      ctx!.fillRect(0, 0, 64, 36);
      ctx!.fillStyle = "#111111";
      ctx!.fillRect(22, 8, 20, 20);
      expect(keyer.keyVideoBand(plate, 64, 36, { x: 0, y: 0, w: 64, h: 36 }, 64, 36)).toBe(true);
      const pixels = keyer.canvas.getContext("2d")
        ? null
        : (() => {
            const out = document.createElement("canvas");
            out.width = 64;
            out.height = 36;
            const outCtx = out.getContext("2d");
            outCtx?.drawImage(keyer.canvas, 0, 0);
            return outCtx?.getImageData(2, 2, 1, 1).data;
          })();
      if (pixels) {
        expect(pixels[3]).toBeLessThan(40);
      }
    } finally {
      keyer.destroy();
    }
  });
});

describe("loadPhotos", () => {
  it("decodes a JPEG file into a working bitmap", async () => {
    const file = await jpegFile();
    const photos = await loadPhotos([file]);
    expect(photos).toHaveLength(1);
    expect(photos[0]?.bitmap.width).toBeGreaterThan(0);
    expect(photos[0]?.bitmap.height).toBeGreaterThan(0);
    photos[0]?.bitmap.close();
    URL.revokeObjectURL(photos[0]?.thumbUrl ?? "");
  });
});

describe("seekVideo / exportJumpVideo", () => {
  it("seeks a stub video and encodes a few frames when WebCodecs exist", async () => {
    const video = stubSeekableVideo(0.2);
    await seekVideo(video, 0.1);
    expect(video.currentTime).toBeCloseTo(0.1, 3);

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 36;
    const ctx = canvas.getContext("2d");
    expect(ctx).toBeTruthy();
    const draw = () => {
      ctx!.fillStyle = "#334455";
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
    };

    if (!hasWebCodecsVideoEncoder()) {
      await expect(
        exportJumpVideo({ video, canvas, draw, duration: 0.2, fps: EXPORT_FPS }),
      ).rejects.toThrow(UNSUPPORTED_EXPORT_MESSAGE);
      return;
    }

    const plan = await pickOfflinePlan(canvas.width, canvas.height);
    if (!plan) {
      await expect(
        exportJumpVideo({ video, canvas, draw, duration: 0.2, fps: EXPORT_FPS }),
      ).rejects.toThrow(UNSUPPORTED_EXPORT_MESSAGE);
      return;
    }

    const result = await exportJumpVideo({
      video,
      canvas,
      draw,
      duration: 0.2,
      fps: EXPORT_FPS,
    });
    expect(result.mode).toBe("offline");
    expect(result.blob.size).toBeGreaterThan(32);
    expect(result.extension).toMatch(/^(mp4|webm)$/);

    const controller = new AbortController();
    controller.abort();
    await expect(
      exportJumpVideo({
        video,
        canvas,
        draw,
        duration: 0.2,
        fps: EXPORT_FPS,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("renders a portrait export at 1080x1920", async () => {
    const compositor = createCompositor({ resolutionScale: 1, createKeyer: () => null });
    compositor.setAspect("portrait");
    const photo = await makePhoto("#3d8bff");
    const video = document.createElement("video");
    const timeline = { slots: [0, 0.5] };
    try {
      compositor.draw(video, [photo], timeline, 0, "zoom", "none");
      expect(compositor.canvas.width).toBe(OUTPUTS.portrait.width);
      expect(compositor.canvas.height).toBe(OUTPUTS.portrait.height);
      expect(compositor.canvas.width).toBe(1080);
      expect(compositor.canvas.height).toBe(1920);

      const encoder = hasWebCodecsVideoEncoder();
      const plan = encoder ? await pickOfflinePlan(compositor.canvas.width, compositor.canvas.height) : null;
      console.info(`portrait-export encoder=${encoder} plan=${plan?.videoCodec ?? "none"}`);
      if (!plan) return;

      const exportVideo = stubSeekableVideo(1);
      const started = performance.now();
      const result = await exportJumpVideo({
        video: exportVideo,
        canvas: compositor.canvas,
        draw: (time) => {
          compositor.draw(video, [photo], timeline, time, "zoom", "none");
        },
        duration: 1,
        fps: EXPORT_FPS,
      });
      const elapsedMs = performance.now() - started;
      expect(result.blob.size).toBeGreaterThan(1000);
      const input = new Input({ source: new BlobSource(result.blob), formats: ALL_FORMATS });
      try {
        const track = await input.getPrimaryVideoTrack();
        expect(track).toBeTruthy();
        expect(track?.displayWidth).toBe(1080);
        expect(track?.displayHeight).toBe(1920);
      } finally {
        input.dispose();
      }
      // One second stands in for the 15.7s template. Logged for the size/time note.
      console.info(
        `portrait-export-1s bytes=${result.blob.size} ms=${Math.round(elapsedMs)} codec=${plan.videoCodec}`,
      );
    } finally {
      photo.bitmap.close();
      compositor.destroy();
    }
  }, 120_000);

  it("puts packed RGBA onto a canvas", () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    expect(ctx).toBeTruthy();
    const data = new Uint8ClampedArray([12, 34, 56, 255]);
    putRgbaOnCanvas(canvas, ctx!, { data, width: 1, height: 1 });
    expect(canvas.width).toBe(1);
    expect(canvas.height).toBe(1);
    expect([...ctx!.getImageData(0, 0, 1, 1).data]).toEqual([12, 34, 56, 255]);
    const next = new Uint8ClampedArray([7, 8, 9, 255]);
    putRgbaOnCanvas(canvas, ctx!, { data: next, width: 1, height: 1 });
    expect([...ctx!.getImageData(0, 0, 1, 1).data]).toEqual([7, 8, 9, 255]);
  });
});

async function makeStripePhoto(): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#101010";
  ctx.fillRect(0, 0, 1920, 1080);
  ctx.fillStyle = "#ff00ff";
  ctx.fillRect(0, 536, 1920, 8);
  const bg = ctx.getImageData(10, 10, 1, 1).data;
  const stripe = ctx.getImageData(10, 540, 1, 1).data;
  if ((bg[0] ?? 0) > 40 || (stripe[0] ?? 0) < 250 || (stripe[1] ?? 255) > 5) {
    throw new Error(`source bg=${[...bg]} stripe=${[...stripe]}`);
  }
  const bitmap = await createImageBitmap(canvas);
  return { id: "stripe", name: "stripe.png", bitmap, thumbUrl: canvas.toDataURL("image/png") };
}

function markerRow(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const x = Math.floor(canvas.width / 2);
  const column = ctx.getImageData(x, 0, 1, canvas.height).data;
  let weight = 0;
  let sum = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    const i = y * 4;
    const r = column[i] ?? 0;
    const g = column[i + 1] ?? 0;
    const b = column[i + 2] ?? 0;
    // Magenta stripe. The cut flash lifts green, so score magenta against gray.
    const mag = Math.max(0, r + b - g * 2 - 80);
    weight += mag;
    sum += mag * (y + 0.5);
  }
  if (weight === 0) throw new Error("jump marker missing");
  return sum / weight;
}

async function makePhoto(color: string): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 48, 32);
  const bitmap = await createImageBitmap(canvas);
  return { id: color, name: `${color}.png`, bitmap, thumbUrl: canvas.toDataURL("image/png") };
}

function sampleCenter(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  return ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
}

async function jpegFile(): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 24;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#3a7";
  ctx.fillRect(0, 0, 32, 24);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("jpeg"))), "image/jpeg", 0.8);
  });
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

function stubSeekableVideo(duration: number): HTMLVideoElement {
  const video = document.createElement("video");
  let time = 0;
  Object.defineProperty(video, "duration", { configurable: true, get: () => duration });
  Object.defineProperty(video, "readyState", { configurable: true, get: () => 4 });
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => time,
    set: (value: number) => {
      time = value;
      queueMicrotask(() => video.dispatchEvent(new Event("seeked")));
    },
  });
  video.pause = () => undefined;
  return video;
}
