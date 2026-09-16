import { describe, expect, it } from "vitest";
import { pickOfflinePlan } from "./offline-encode.ts";
import { EXPORT_FPS, frameTimes, hasWebCodecsVideoEncoder } from "./export.ts";

describe("frameTimes", () => {
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
});

describe("offline capability", () => {
  it("detects a missing VideoEncoder in this environment", () => {
    expect(hasWebCodecsVideoEncoder()).toBe(typeof VideoEncoder === "function");
  });

  it("returns no offline plan when WebCodecs video encode is unavailable", async () => {
    if (hasWebCodecsVideoEncoder()) return;
    expect(await pickOfflinePlan(720, 1280)).toBeNull();
  });
});
