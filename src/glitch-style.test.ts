import { describe, expect, it } from "vitest";
import { glitchEnvelope, glitchStyle } from "./glitch-style.ts";

describe("glitch styles", () => {
  it("is independent of call order and returns fresh parameters", () => {
    const styles = Array.from({ length: 60 }, (_, i) => glitchStyle(i + 1));
    for (let i = 59; i >= 0; i--) expect(glitchStyle(i + 1)).toEqual(styles[i]);
    const changed = glitchStyle(1);
    changed.strength = 99;
    expect(glitchStyle(1)).toEqual(styles[0]);
  });

  it("shuffles complete cycles with distinct neighbors, including every cycle boundary", () => {
    const orders = new Set<string>();
    for (let cut = 1; cut <= 1000; cut++) {
      const style = glitchStyle(cut);
      const next = glitchStyle(cut + 1);
      expect(style.preset, `cut ${cut}`).not.toBe(next.preset);
      // 本数はピークで最低 2 本違う。微小な乱数だけによる見かけの差ではない。
      expect(Math.abs(style.slices - next.slices)).toBeGreaterThanOrEqual(2);
      if (cut % 5 === 1) {
        const cycle = Array.from({ length: 5 }, (_, i) => glitchStyle(cut + i).preset);
        expect(new Set(cycle).size).toBe(5);
        orders.add(cycle.join(","));
      }
    }
    expect(orders.size).toBeGreaterThan(5);
  });

  it("keeps all parameters within restrained ranges", () => {
    for (let cut = 1; cut <= 1000; cut++) {
      const s = glitchStyle(cut);
      expect(s.strength).toBeGreaterThanOrEqual(0.7);
      expect(s.strength).toBeLessThanOrEqual(1.3);
      expect([-1, 0, 1]).toContain(s.direction);
      expect(s.slices).toBeGreaterThanOrEqual(6);
      expect(s.slices).toBeLessThanOrEqual(14);
      expect(s.thickness[0]).toBeGreaterThanOrEqual(0.008);
      expect(s.thickness[1]).toBeLessThanOrEqual(0.085);
      expect(s.thickness[0]).toBeLessThan(s.thickness[1]);
      // 太さと本数を同時に大きくしない。移動も短辺の約 1/4 以内に抑える。
      expect(s.slices * s.thickness[1] * s.strength).toBeLessThan(0.56);
      expect(0.18 * s.strength).toBeLessThan(0.24);
      expect(s.fragments).toBeGreaterThanOrEqual(2);
      expect(s.fragments).toBeLessThanOrEqual(6);
      expect(s.fragmentBand).toBeGreaterThanOrEqual(0.2);
      expect(s.fragmentBand).toBeLessThanOrEqual(0.8);
      expect([-1, 1]).toContain(s.rgbDirection);
      expect([0, 1, 2]).toContain(s.rgbLead);
      expect(s.rgbScale).toBeGreaterThanOrEqual(0.8);
      expect(s.rgbScale).toBeLessThanOrEqual(1.15);
      expect(Math.abs(s.rgbVertical)).toBeLessThanOrEqual(0.35);
      expect([-1, -2]).toContain(s.peak);
      expect(s.jitter).toBeGreaterThanOrEqual(0);
      expect(s.jitter).toBeLessThanOrEqual(0.004);
    }
  });

  it.each([-1, -2] as const)("peaks at frame %i within the 5/4 window and leaves frame 0 clean", (peak) => {
    const frames = Array.from({ length: 15 }, (_, i) => i - 7);
    expect(frames.filter((f) => glitchEnvelope(f, peak) > 0)).toEqual([-5, -4, -3, -2, -1, 1, 2, 3, 4]);
    expect(frames.filter((f) => glitchEnvelope(f, peak) === 1)).toEqual([peak]);
    const tail = [1, 2, 3, 4].map((f) => glitchEnvelope(f, peak));
    expect(tail[0]).toBeLessThanOrEqual(0.45);
    expect(tail).toEqual([...tail].sort((a, b) => b - a));
  });
});
