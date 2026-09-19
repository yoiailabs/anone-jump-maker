import { afterEach, describe, expect, it } from "vitest";
import { beginTemplateVideoLoad, createTemplateVideo } from "./app.ts";
import { PREVIEW_RESOLUTION_SCALE } from "./canvas-size.ts";
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
import { mainPanelRect, TEMPLATES } from "./layout.ts";
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
      resolutionScale: PREVIEW_RESOLUTION_SCALE,
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
      compositor.draw(video, [photo], timeline, 0.12, "zoom", "blur-weak");
      expect(compositor.canvas.width).toBe(304);
      expect(compositor.canvas.height).toBe(540);
      const portrait = sampleCenter(compositor.canvas);
      expect(portrait[0] + portrait[1] + portrait[2]).toBeGreaterThan(20);
    } finally {
      photo.bitmap.close();
      compositor.destroy();
    }
  });

  it("does not paint a white seam on the top edge of the portrait 16:9 panel", async () => {
    const timeline = { slots: [0, 0.5], slotPhotoOrder: [0, 1] };
    const rest = 7 / 30;
    const photo = await makePhoto("#3a6ea5");
    const character = makeTemplateLikeCharacter();
    const video = document.createElement("video");

    for (const scale of [1, PREVIEW_RESOLUTION_SCALE]) {
      const compositor = createCompositor({
        resolutionScale: scale,
        createKeyer: () => null,
      });
      try {
        compositor.setAspect("portrait");
        compositor.draw(video, [photo], timeline, rest, "jump", "none", {
          source: character,
          width: character.width,
          height: character.height,
        });
        const panel = mainPanelRect(compositor.canvas.width, compositor.canvas.height, "portrait");
        assertNoBrightSeam(compositor.canvas, panel.y);

        compositor.setAspect("landscape");
        compositor.draw(video, [photo], timeline, rest, "jump", "none");
        expect(compositor.canvas.height).toBeGreaterThan(0);
        const ctx = compositor.canvas.getContext("2d");
        expect(ctx).toBeTruthy();
        const top = ctx!.getImageData(8, 0, 8, 1).data;
        expect(top[0] + top[1] + top[2]).toBeGreaterThan(40);
        expect(top[3]).toBe(255);
      } finally {
        compositor.destroy();
      }
    }

    photo.bitmap.close();
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

  it("puts packed RGBA onto a canvas", () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    expect(ctx).toBeTruthy();
    const data = new Uint8ClampedArray([12, 34, 56, 255]);
    putRgbaOnCanvas(canvas, ctx!, { data, width: 1, height: 1 });
    expect(canvas.width).toBe(1);
    expect(canvas.height).toBe(1);
    expect([...ctx!.getImageData(0, 0, 1, 1).data]).toEqual([12, 34, 56, 255]);
  });
});

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

/** Real vertical.mp4: black letterbox, 1px dark-green antialias at y=312, solid green 313–654. */
function makeTemplateLikeCharacter(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 608;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 608, 1080);
  ctx.fillStyle = "rgb(0, 48, 0)";
  ctx.fillRect(0, 312, 608, 1);
  ctx.fillStyle = "rgb(20, 182, 54)";
  ctx.fillRect(0, 313, 608, 342);
  ctx.fillStyle = "#111111";
  ctx.fillRect(220, 400, 160, 220);
  return canvas;
}

function rowMeanLuma(ctx: CanvasRenderingContext2D, y: number, x: number, width: number): number {
  const data = ctx.getImageData(x, y, width, 1).data;
  let sum = 0;
  const n = width;
  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    sum += data[o]! * 0.299 + data[o + 1]! * 0.587 + data[o + 2]! * 0.114;
  }
  return sum / n;
}

function assertNoBrightSeam(canvas: HTMLCanvasElement, panelY: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const y0 = Math.round(panelY);
  const x = Math.floor(canvas.width * 0.08);
  const width = Math.max(8, Math.floor(canvas.width * 0.84));
  const start = Math.max(0, y0 - 2);
  const end = Math.min(canvas.height - 1, y0 + 4);
  const lumas: number[] = [];
  for (let y = start; y <= end; y += 1) {
    lumas.push(rowMeanLuma(ctx, y, x, width));
  }
  for (let i = 1; i < lumas.length - 1; i += 1) {
    const luma = lumas[i]!;
    const prev = lumas[i - 1]!;
    const next = lumas[i + 1]!;
    const spike = luma > prev + 28 && luma > next + 28;
    expect(spike && luma > 180, `bright seam at y=${start + i} lumas=${lumas.map((v) => v.toFixed(1)).join(",")}`).toBe(
      false,
    );
  }
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
