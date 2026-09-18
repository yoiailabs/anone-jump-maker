import { describe, expect, it } from "vitest";
import { swapFx } from "./layout.ts";
import { pickOfflinePlan } from "./offline-encode.ts";
import { slotForTime } from "./timeline.ts";
import {
  EXPORT_AUDIO_SOURCE,
  EXPORT_FALLBACK,
  EXPORT_FPS,
  EXPORT_PATH,
  UNSUPPORTED_EXPORT_MESSAGE,
  exportJumpVideo,
  frameTimes,
  hasWebCodecsVideoEncoder,
} from "./export.ts";

describe("offline export plan", () => {
  it("saves by seeking frames, not MediaRecorder", () => {
    expect(EXPORT_PATH).toBe("offline");
    expect(EXPORT_AUDIO_SOURCE).toBe("template-file");
    expect(EXPORT_FALLBACK).toBe("none");
  });

  it("keeps export at 30fps independent of preview paint rate", () => {
    expect(EXPORT_FPS).toBe(30);
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
