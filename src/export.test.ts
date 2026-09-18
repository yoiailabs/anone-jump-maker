import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREVIEW_RESOLUTION_SCALE, scaleCanvasSize } from "./canvas-size.ts";
import { swapFx, outputSize } from "./layout.ts";
import { PREVIEW_FPS } from "./playback.ts";
import { pickOfflinePlan } from "./offline-encode.ts";
import { slotForTime } from "./timeline.ts";
import {
  EXPORT_AUDIO_SOURCE,
  EXPORT_FALLBACK,
  EXPORT_FPS,
  EXPORT_PATH,
  SEEK_PRESENT_TIMEOUT_MS,
  UNSUPPORTED_EXPORT_MESSAGE,
  composeExportFrame,
  exportJumpVideo,
  frameTimes,
  hasWebCodecsVideoEncoder,
  seekVideo,
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

describe("seekVideo / composeExportFrame", () => {
  beforeEach(() => {
    if (!("HTMLMediaElement" in globalThis)) {
      Object.assign(globalThis, { HTMLMediaElement: { HAVE_CURRENT_DATA: 2 } });
    }
    if (!("window" in globalThis)) {
      Object.assign(globalThis, { window: globalThis });
    }
  });

  it("registers requestVideoFrameCallback before assigning currentTime", async () => {
    const video = createVideo();
    const pending = seekVideo(asVideo(video), 1.2);
    expect(video.events.indexOf("rvfc")).toBe(0);
    expect(video.events.indexOf("seek")).toBe(1);
    video.dispatch("seeked");
    video.present(1.2);
    await pending;
  });

  it("does not draw until a presented frame matches the sought time", async () => {
    const video = createVideo();
    const order: string[] = [];
    const pending = composeExportFrame(asVideo(video), 0.4, () => {
      order.push("draw");
    });
    video.dispatch("seeked");
    await Promise.resolve();
    expect(order).toEqual([]);
    video.present(0);
    await Promise.resolve();
    expect(order).toEqual([]);
    video.present(0.4);
    await pending;
    expect(order).toEqual(["draw"]);
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
      const pending = seekVideo(asVideo(video), 1.2);
      video.dispatch("seeked");
      await vi.advanceTimersByTimeAsync(SEEK_PRESENT_TIMEOUT_MS);
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });
});
