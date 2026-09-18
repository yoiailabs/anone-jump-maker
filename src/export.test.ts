import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { swapFx } from "./layout.ts";
import { pickOfflinePlan } from "./offline-encode.ts";
import { slotForTime } from "./timeline.ts";
import {
  EXPORT_AUDIO_SOURCE,
  EXPORT_FALLBACK,
  EXPORT_FPS,
  EXPORT_PATH,
  SEEK_TIMEOUT_MS,
  SEEK_TIMEOUT_RETRIES,
  UNSUPPORTED_EXPORT_MESSAGE,
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

type VideoStub = {
  currentTime: number;
  duration: number;
  readyState: number;
  pause: () => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
  dispatch: (type: string) => void;
};

function createVideo(init?: Partial<Pick<VideoStub, "currentTime" | "duration" | "readyState">>): VideoStub {
  const listeners = new Map<string, Set<() => void>>();
  return {
    currentTime: init?.currentTime ?? 0,
    duration: init?.duration ?? 10,
    readyState: init?.readyState ?? 0,
    pause() {},
    addEventListener(type, fn) {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    dispatch(type) {
      for (const fn of [...(listeners.get(type) ?? [])]) fn();
    },
  };
}

function asVideo(video: VideoStub): HTMLVideoElement {
  return video as unknown as HTMLVideoElement;
}

function createStuckVideo() {
  const video = createVideo();
  let shown = 0;
  let assigns = 0;
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get() {
      return shown;
    },
    set() {
      assigns += 1;
    },
  });
  return {
    video,
    assigns: () => assigns,
  };
}

describe("seekVideo", () => {
  beforeEach(() => {
    if (!("HTMLMediaElement" in globalThis)) {
      Object.assign(globalThis, { HTMLMediaElement: { HAVE_CURRENT_DATA: 2 } });
    }
    if (!("window" in globalThis)) {
      Object.assign(globalThis, { window: globalThis });
    }
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately when the frame is already current", async () => {
    const video = createVideo({ currentTime: 1.2, duration: 10, readyState: 2 });
    let assigned = false;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get() {
        return 1.2;
      },
      set() {
        assigned = true;
      },
    });
    await seekVideo(asVideo(video), 1.2);
    expect(assigned).toBe(false);
  });

  it("resolves on seeked without waiting for the timeout", async () => {
    const video = createVideo();
    const pending = seekVideo(asVideo(video), 1.2);
    video.dispatch("seeked");
    await pending;
  });

  it("resolves on a near-match after the longer wait", async () => {
    const video = createVideo();
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get() {
        return 1.19;
      },
      set() {},
    });
    const pending = seekVideo(asVideo(video), 1.2);
    await vi.advanceTimersByTimeAsync(SEEK_TIMEOUT_MS);
    await pending;
  });

  it("retries currentTime after a timeout, then succeeds on seeked", async () => {
    const stuck = createStuckVideo();
    const pending = seekVideo(asVideo(stuck.video), 1.2);
    expect(stuck.assigns()).toBe(1);
    await vi.advanceTimersByTimeAsync(SEEK_TIMEOUT_MS - 1);
    expect(stuck.assigns()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(stuck.assigns()).toBe(2);
    stuck.video.dispatch("seeked");
    await pending;
  });

  it("rejects only after the timeout retries are exhausted", async () => {
    const stuck = createStuckVideo();
    const pending = seekVideo(asVideo(stuck.video), 1.2);
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
    expect(stuck.assigns()).toBe(1 + SEEK_TIMEOUT_RETRIES);
    await expect(pending).rejects.toThrow("シークがタイムアウトしました");
  });

  it("rejects when the video errors", async () => {
    const video = createVideo();
    const pending = seekVideo(asVideo(video), 1.2);
    video.dispatch("error");
    await expect(pending).rejects.toThrow("シークに失敗しました");
  });
});
