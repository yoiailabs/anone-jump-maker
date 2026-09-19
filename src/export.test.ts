import { beforeEach, describe, expect, it, vi } from "vitest";
import { PREVIEW_RESOLUTION_SCALE, scaleCanvasSize } from "./canvas-size.ts";
import { swapFx, outputSize } from "./layout.ts";
import { PREVIEW_FPS } from "./playback.ts";
import { pickOfflinePlan } from "./offline-encode.ts";
import { slotForTime } from "./timeline.ts";
import {
  EXPORT_ABORTED_MESSAGE,
  EXPORT_AUDIO_SOURCE,
  EXPORT_CHARACTER_FALLBACK,
  EXPORT_CHARACTER_PIXELS,
  EXPORT_CHARACTER_SOURCE,
  EXPORT_FALLBACK,
  EXPORT_FPS,
  EXPORT_PATH,
  EXPORT_PROBE_TIMEOUT_MS,
  SEEK_PRESENT_TIMEOUT_MS,
  SEEK_TIMEOUT_MS,
  SEEK_TIMEOUT_RETRIES,
  TEMPLATE_FRAME_FROZEN_MESSAGE,
  TEMPLATE_FRAME_MISSING_MESSAGE,
  UNSUPPORTED_EXPORT_MESSAGE,
  assertCharacterAdvanced,
  characterFrameFromCanvas,
  chooseExportCharacterPath,
  copySampleRgba,
  exportJumpVideo,
  exportProgressPercent,
  fingerprintRgba,
  firstResolved,
  frameTimes,
  hasWebCodecsVideoEncoder,
  isAbortError,
  packedRgba,
  paintDecodedExportFrame,
  seekVideo,
  templateFrameMatchesTime,
  throwIfAborted,
} from "./export.ts";

describe("offline export plan", () => {
  it("saves by seeking frames, not MediaRecorder", () => {
    expect(EXPORT_PATH).toBe("offline");
    expect(EXPORT_AUDIO_SOURCE).toBe("template-file");
    expect(EXPORT_FALLBACK).toBe("none");
  });

  it("keeps full template resolution and 30fps for offline save", () => {
    expect(EXPORT_FPS).toBe(30);
    expect(outputSize("portrait")).toEqual({ width: 608, height: 1080 });
    expect(outputSize("landscape")).toEqual({ width: 1280, height: 720 });
    expect(scaleCanvasSize(608, 1080, 1)).toEqual({ width: 608, height: 1080 });
    expect(scaleCanvasSize(1280, 720, 1)).toEqual({ width: 1280, height: 720 });
    expect(PREVIEW_RESOLUTION_SCALE).toBeLessThan(1);
    expect(scaleCanvasSize(1280, 720, PREVIEW_RESOLUTION_SCALE)).not.toEqual({ width: 1280, height: 720 });
    expect(PREVIEW_FPS).toBe(24);
    expect(PREVIEW_FPS).not.toBe(EXPORT_FPS);
  });

  it("muxes template-file audio so preview mute cannot silence a saved video", () => {
    expect(EXPORT_AUDIO_SOURCE).toBe("template-file");
  });

  it("keys the saved character from a file-decoded frame when that path works", () => {
    expect(EXPORT_CHARACTER_SOURCE).toBe("capability-branch");
    expect(EXPORT_CHARACTER_PIXELS).toBe("rgba-copyTo");
    expect(EXPORT_CHARACTER_FALLBACK).toBe("html-video-seek");
    expect(EXPORT_AUDIO_SOURCE).toBe("template-file");
  });

  it("emits one timestamp per frame without passing the duration", () => {
    const times = frameTimes(15.54, 30);
    expect(times).toHaveLength(466);
    expect(times[0]).toBe(0);
    expect(times.at(-1)).toBeLessThan(15.54);
    expect(times[1]! - times[0]!).toBeCloseTo(1 / 30, 5);
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]!).toBeGreaterThan(times[i - 1]!);
    }
  });

  it("returns a single zero frame when duration is empty", () => {
    expect(frameTimes(0, 30)).toEqual([0]);
    expect(frameTimes(Number.NaN, EXPORT_FPS)).toEqual([0]);
    expect(frameTimes(1, 0)).toEqual(frameTimes(1, EXPORT_FPS));
  });

  it("keeps hop and swap on the planned timestamp", () => {
    const slots = [0, 0.533, 1.0];
    const t = frameTimes(1, 30)[10]!;
    expect(t).toBeCloseTo(10 / 30, 8);
    expect(slotForTime(t, slots)).toBe(0);
    expect(swapFx(t, slots, "jump")).toEqual(swapFx(t, slots, "jump"));
    expect(swapFx(t, slots, "zoom")).toEqual(swapFx(t, slots, "zoom"));
    // the export clock lands exactly on slot starts stored as frame/30
    const exact = [0, 59 / 30, 118 / 30];
    expect(slotForTime(frameTimes(4, 30)[59]!, exact)).toBe(1);
    expect(slotForTime(frameTimes(4, 30)[118]!, exact)).toBe(2);
    expect(slotForTime(frameTimes(4, 30)[117]!, exact)).toBe(1);
  });
});

describe("offline capability", () => {
  it("detects a missing VideoEncoder in this environment", () => {
    expect(hasWebCodecsVideoEncoder()).toBe(typeof VideoEncoder === "function");
  });

  it("returns no offline plan when WebCodecs video encode is unavailable", async () => {
    if (hasWebCodecsVideoEncoder()) return;
    expect(await pickOfflinePlan(608, 1080)).toBeNull();
  });

  it("fails with an explicit message instead of falling back to recording", async () => {
    if (hasWebCodecsVideoEncoder()) return;
    await expect(
      exportJumpVideo({
        video: { currentSrc: "", src: "", duration: 1 } as HTMLVideoElement,
        canvas: { width: 608, height: 1080 } as HTMLCanvasElement,
        draw: () => undefined,
        duration: 1,
        fps: 30,
      }),
    ).rejects.toThrow(UNSUPPORTED_EXPORT_MESSAGE);
  });

  it("rejects with AbortError when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      exportJumpVideo({
        video: { currentSrc: "", src: "", duration: 1 } as HTMLVideoElement,
        canvas: { width: 608, height: 1080 } as HTMLCanvasElement,
        draw: () => undefined,
        duration: 1,
        fps: 30,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError", message: EXPORT_ABORTED_MESSAGE });
  });
});

describe("export progress and cancel", () => {
  it("maps frame counts onto 0–100%", () => {
    expect(exportProgressPercent(0, 466)).toBe(0);
    expect(exportProgressPercent(0, 0)).toBe(0);
    expect(exportProgressPercent(-1, 10)).toBe(0);
    expect(exportProgressPercent(1, 466)).toBe(0);
    expect(exportProgressPercent(233, 466)).toBe(50);
    expect(exportProgressPercent(465, 466)).toBe(99);
    expect(exportProgressPercent(466, 466)).toBe(100);
    expect(exportProgressPercent(500, 466)).toBe(100);
  });

  it("throws AbortError only when the signal is aborted", () => {
    expect(() => throwIfAborted()).not.toThrow();
    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow();
    const controller = new AbortController();
    controller.abort();
    expect(() => throwIfAborted(controller.signal)).toThrow(EXPORT_ABORTED_MESSAGE);
    try {
      throwIfAborted(controller.signal);
    } catch (error) {
      expect(isAbortError(error)).toBe(true);
    }
  });
});

type FrameCallback = (now: number, metadata?: { mediaTime?: number }) => void;

type VideoStub = {
  currentTime: number;
  duration: number;
  readyState: number;
  pause: () => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
  requestVideoFrameCallback: (cb: FrameCallback) => number;
  cancelVideoFrameCallback: (handle: number) => void;
  dispatch: (type: string) => void;
  present: (mediaTime: number) => void;
  events: string[];
};

function createVideo(init?: Partial<Pick<VideoStub, "currentTime" | "duration" | "readyState">>): VideoStub {
  const listeners = new Map<string, Set<() => void>>();
  const frameCallbacks: FrameCallback[] = [];
  const events: string[] = [];
  let shown = init?.currentTime ?? 0;
  return {
    events,
    duration: init?.duration ?? 10,
    readyState: init?.readyState ?? 2,
    get currentTime() {
      return shown;
    },
    set currentTime(value: number) {
      events.push("seek");
      shown = value;
    },
    pause() {},
    addEventListener(type, fn) {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    requestVideoFrameCallback(cb) {
      events.push("rvfc");
      frameCallbacks.push(cb);
      return frameCallbacks.length;
    },
    cancelVideoFrameCallback() {
      frameCallbacks.length = 0;
    },
    dispatch(type) {
      events.push(type);
      for (const fn of [...(listeners.get(type) ?? [])]) fn();
    },
    present(mediaTime) {
      const cb = frameCallbacks.shift();
      cb?.(0, { mediaTime });
    },
  };
}

function asVideo(video: VideoStub): HTMLVideoElement {
  return video as unknown as HTMLVideoElement;
}

type StuckVideoStub = VideoStub & { assigns: () => number };

function createStuckVideo(): StuckVideoStub {
  const video = createVideo({ currentTime: 0, readyState: 2 });
  let assigns = 0;
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get() {
      return 0;
    },
    set() {
      assigns += 1;
      video.events.push("seek");
    },
  });
  return Object.assign(video, { assigns: () => assigns });
}

describe("decoded export frames", () => {
  it("accepts a sample at or just before the export timestamp", () => {
    expect(templateFrameMatchesTime(0, 0)).toBe(true);
    expect(templateFrameMatchesTime(10 / 30, 10 / 30)).toBe(true);
    expect(templateFrameMatchesTime(9 / 30, 10 / 30)).toBe(true);
    expect(templateFrameMatchesTime(1 / 30, 0)).toBe(true);
    expect(templateFrameMatchesTime(0, 10 / 30)).toBe(false);
    expect(templateFrameMatchesTime(1.2, 0.4)).toBe(false);
  });

  it("draws from the decoded canvas and rejects a frozen first frame", () => {
    const drawn: Array<{ time: number; width: number }> = [];
    const canvas = { width: 1920, height: 1080 };
    paintDecodedExportFrame(0.4, { canvas, timestamp: 0.4 }, (time, character) => {
      drawn.push({ time, width: character?.width ?? 0 });
    });
    expect(drawn).toEqual([{ time: 0.4, width: 1920 }]);
    expect(characterFrameFromCanvas(canvas).width).toBe(1920);
    expect(() => paintDecodedExportFrame(0.4, { canvas, timestamp: 0 }, () => undefined)).toThrow(
      TEMPLATE_FRAME_MISSING_MESSAGE,
    );
    expect(() => paintDecodedExportFrame(0.4, null, () => undefined)).toThrow(TEMPLATE_FRAME_MISSING_MESSAGE);
  });

  it("rejects an empty or undersized RGBA layout", () => {
    expect(() => packedRgba(new Uint8Array(4), 2, 2, 8)).toThrow(TEMPLATE_FRAME_MISSING_MESSAGE);
    expect(() => packedRgba(new Uint8Array(), 1, 1, 4)).toThrow(TEMPLATE_FRAME_MISSING_MESSAGE);
  });

  it("packs strided RGBA and fingerprints a grid of pixels", () => {
    const width = 2;
    const height = 2;
    const stride = 16;
    const src = new Uint8Array(stride * height);
    src.set([1, 2, 3, 255, 4, 5, 6, 255], 0);
    src.set([7, 8, 9, 255, 10, 11, 12, 255], stride);
    const packed = packedRgba(src, width, height, stride);
    expect([...packed]).toEqual([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
    const a = fingerprintRgba(packed, width, height);
    packed[0] = 40;
    expect(fingerprintRgba(packed, width, height)).not.toBe(a);
  });

  it("uses RGBA copy when the probe can decode two advancing frames", () => {
    const ok = {
      copiedFirst: true,
      copiedLater: true,
      firstTimeOk: true,
      laterTimeOk: true,
      pixelsAdvanced: true,
    };
    expect(chooseExportCharacterPath(ok)).toBe(EXPORT_CHARACTER_PIXELS);
    expect(chooseExportCharacterPath({ ...ok, copiedFirst: false })).toBe(EXPORT_CHARACTER_FALLBACK);
    expect(chooseExportCharacterPath({ ...ok, copiedLater: false })).toBe(EXPORT_CHARACTER_FALLBACK);
    expect(chooseExportCharacterPath({ ...ok, firstTimeOk: false })).toBe(EXPORT_CHARACTER_FALLBACK);
    expect(chooseExportCharacterPath({ ...ok, laterTimeOk: false })).toBe(EXPORT_CHARACTER_FALLBACK);
    expect(chooseExportCharacterPath({ ...ok, pixelsAdvanced: false })).toBe(EXPORT_CHARACTER_FALLBACK);
  });

  it("rejects a character fingerprint that is still the first frame after 1s", () => {
    expect(() => assertCharacterAdvanced(1, 1, 0.5)).not.toThrow();
    expect(() => assertCharacterAdvanced(1, 2, 1)).not.toThrow();
    expect(() => assertCharacterAdvanced(1, 1, 1)).toThrow(TEMPLATE_FRAME_FROZEN_MESSAGE);
  });

  it("copies a sample to tight RGBA via copyTo", async () => {
    const width = 2;
    const height = 1;
    const pixels = new Uint8Array([9, 8, 7, 255, 1, 2, 3, 255]);
    const frame = await copySampleRgba({
      timestamp: 0.2,
      codedWidth: width,
      codedHeight: height,
      allocationSize: () => pixels.byteLength,
      async copyTo(dest) {
        const bytes = dest instanceof Uint8Array ? dest : new Uint8Array(dest as ArrayBuffer);
        bytes.set(pixels);
        return [{ stride: width * 4 }];
      },
    });
    expect(frame.timestamp).toBe(0.2);
    expect(frame.width).toBe(2);
    expect([...frame.data]).toEqual([9, 8, 7, 255, 1, 2, 3, 255]);
    expect(frame.fingerprint).toBe(fingerprintRgba(frame.data, 2, 1));
  });

  it("rejects a sample with no coded size", async () => {
    await expect(
      copySampleRgba({
        timestamp: 0,
        codedWidth: 0,
        codedHeight: 10,
        allocationSize: () => 0,
        async copyTo() {},
      }),
    ).rejects.toThrow(TEMPLATE_FRAME_MISSING_MESSAGE);
  });
});

describe("seekVideo", () => {
  beforeEach(() => {
    if (!("HTMLMediaElement" in globalThis)) {
      Object.assign(globalThis, { HTMLMediaElement: { HAVE_CURRENT_DATA: 2 } });
    }
    if (!("window" in globalThis)) {
      Object.assign(globalThis, { window: globalThis });
    }
  });

  it("waits only for seeked by default so html-video-seek does not pay rVFC per frame", async () => {
    const video = createVideo();
    const pending = seekVideo(asVideo(video), 1.2);
    expect(video.events).toEqual(["seek"]);
    expect(video.events).not.toContain("rvfc");
    video.dispatch("seeked");
    await pending;
  });

  it("registers requestVideoFrameCallback before assigning currentTime when present wait is requested", async () => {
    const video = createVideo();
    const pending = seekVideo(asVideo(video), 1.2, { waitForPresented: true });
    expect(video.events.indexOf("rvfc")).toBe(0);
    expect(video.events.indexOf("seek")).toBe(1);
    video.dispatch("seeked");
    video.present(1.2);
    await pending;
  });

  it("waits longer than the old 2500ms budget and retries on timeout", () => {
    expect(SEEK_TIMEOUT_MS).toBeGreaterThan(2500);
    expect(SEEK_TIMEOUT_RETRIES).toBeGreaterThan(0);
  });

  it("returns immediately when the frame is already current", async () => {
    const video = createVideo({ currentTime: 1.2, readyState: 2 });
    video.events.length = 0;
    await seekVideo(asVideo(video), 1.2);
    expect(video.events).toEqual([]);
  });

  it("resolves after seeked even if the presented-frame wait times out", async () => {
    vi.useFakeTimers();
    try {
      const video = createVideo();
      const pending = seekVideo(asVideo(video), 1.2, { waitForPresented: true });
      video.dispatch("seeked");
      await vi.advanceTimersByTimeAsync(SEEK_PRESENT_TIMEOUT_MS);
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects when the video errors without retrying", async () => {
    const video = createVideo();
    const pending = seekVideo(asVideo(video), 1.2);
    video.dispatch("error");
    await expect(pending).rejects.toThrow("シークに失敗しました");
    expect(video.events.filter((event) => event === "seek")).toHaveLength(1);
  });

  it("resolves on a near-match after the longer wait", async () => {
    vi.useFakeTimers();
    try {
      const video = createVideo();
      Object.defineProperty(video, "currentTime", {
        configurable: true,
        get() {
          return 1.19;
        },
        set() {
          video.events.push("seek");
        },
      });
      const pending = seekVideo(asVideo(video), 1.2);
      await vi.advanceTimersByTimeAsync(SEEK_TIMEOUT_MS);
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries currentTime after a timeout, then succeeds on seeked", async () => {
    vi.useFakeTimers();
    try {
      const video = createStuckVideo();
      const pending = seekVideo(asVideo(video), 1.2);
      expect(video.assigns()).toBe(1);
      await vi.advanceTimersByTimeAsync(SEEK_TIMEOUT_MS - 1);
      expect(video.assigns()).toBe(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(video.assigns()).toBe(2);
      video.dispatch("seeked");
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects only after the timeout retries are exhausted", async () => {
    vi.useFakeTimers();
    try {
      const video = createStuckVideo();
      const pending = seekVideo(asVideo(video), 1.2);
      let settled = false;
      void pending.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      await vi.advanceTimersByTimeAsync(2500);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(SEEK_TIMEOUT_MS * (SEEK_TIMEOUT_RETRIES + 1) - 2500);
      expect(video.assigns()).toBe(1 + SEEK_TIMEOUT_RETRIES);
      await expect(pending).rejects.toThrow("シークがタイムアウトしました");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("iOS export timing", () => {
  it("does not wait the present-timeout on every html-video-seek frame", () => {
    const frames = frameTimes(15.54, 30);
    expect(frames).toHaveLength(466);
    expect(frames.length * SEEK_PRESENT_TIMEOUT_MS).toBe(186_400);
    expect(EXPORT_PROBE_TIMEOUT_MS).toBe(1200);
    expect(EXPORT_PROBE_TIMEOUT_MS).toBeLessThan(frames.length * SEEK_PRESENT_TIMEOUT_MS);
  });

  it("takes the first finished probe result so a hung software decode can fall back", async () => {
    let later = 0;
    const result = await firstResolved([
      new Promise<string>(() => undefined),
      Promise.resolve(EXPORT_CHARACTER_FALLBACK),
    ]);
    later = 1;
    expect(result).toBe(EXPORT_CHARACTER_FALLBACK);
    expect(later).toBe(1);
  });
});
