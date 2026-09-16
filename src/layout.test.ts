import { describe, expect, it } from "vitest";
import {
  BLUR_COVER_SCALE,
  BLUR_SOURCE,
  JUMP_AMPLITUDE,
  JUMP_DURATION,
  MAIN_PANEL_Y_FRAC,
  OUTPUT,
  PANEL_DIVIDER_PX,
  coverDest,
  jumpAmount,
  jumpOffsetPx,
  mainPanelRect,
  outputSize,
  rectToUvBottomLeft,
  sharpCoverScale,
  templateBandRect,
} from "./layout.ts";

const slots = [0, 0.467, 0.933, 1.467];

describe("output size", () => {
  it("is portrait 9:16 only", () => {
    expect(outputSize()).toEqual({ width: 720, height: 1280 });
    expect(OUTPUT).toEqual({ width: 720, height: 1280 });
    expect(OUTPUT.width / OUTPUT.height).toBeCloseTo(9 / 16, 5);
  });

  it("keeps a thin divider and extra blur zoom", () => {
    expect(BLUR_COVER_SCALE).toBeGreaterThan(1.1);
    expect(PANEL_DIVIDER_PX).toBeGreaterThanOrEqual(1);
    expect(PANEL_DIVIDER_PX).toBeLessThanOrEqual(3);
    expect(BLUR_SOURCE).toBe("main-frame");
  });
});

describe("mainPanelRect", () => {
  it("places a full-width 16:9 panel on the template green band", () => {
    const panel = mainPanelRect(720, 1280);
    expect(panel.x).toBe(0);
    expect(panel.w).toBe(720);
    expect(panel.w / panel.h).toBeCloseTo(16 / 9, 5);
    expect(panel.y / 1280).toBeCloseTo(MAIN_PANEL_Y_FRAC, 5);
    expect(panel.y / 1280).toBeCloseTo(0.2889, 3);
    expect((panel.y + panel.h) / 1280).toBeCloseTo(0.6056, 3);
    expect(panel.x + panel.w).toBe(720);
  });
});

describe("templateBandRect", () => {
  it("crops the same 16:9 band from a 9:16 template", () => {
    const band = templateBandRect(360, 640);
    expect(band.x).toBe(0);
    expect(band.w).toBe(360);
    expect(band.y / 640).toBeCloseTo(MAIN_PANEL_Y_FRAC, 5);
    expect(band.h / 360).toBeCloseTo(9 / 16, 5);
  });
});

describe("coverDest / sharpCoverScale", () => {
  it("covers a landscape photo onto 9:16 by cropping the sides", () => {
    const dest = coverDest(1920, 1080, 720, 1280);
    expect(dest.h).toBeCloseTo(1280, 5);
    expect(dest.w).toBeGreaterThan(720);
    expect(dest.x).toBeLessThan(0);
  });

  it("applies extra scale and a vertical jump without shrinking below the dest", () => {
    const dest = coverDest(1920, 1080, 720, 1280, { scale: BLUR_COVER_SCALE, offsetY: -40 });
    expect(dest.h).toBeGreaterThan(1280);
    expect(dest.y).toBeLessThan((1280 - dest.h) / 2);
  });

  it("scales the sharp 16:9 photo enough that a full hop stays inside the panel", () => {
    const panel = mainPanelRect(720, 1280);
    const scale = sharpCoverScale(1280, panel.h);
    const hop = 1280 * JUMP_AMPLITUDE;
    expect(scale).toBeGreaterThan(1);
    expect((scale - 1) * panel.h).toBeGreaterThanOrEqual(2 * hop - 1e-6);
    const dest = coverDest(1920, 1080, panel.w, panel.h, {
      dx: panel.x,
      dy: panel.y,
      scale,
      offsetY: -hop,
    });
    expect(dest.y).toBeLessThanOrEqual(panel.y + 1e-6);
    expect(dest.y + dest.h).toBeGreaterThanOrEqual(panel.y + panel.h - 1e-6);
  });
});

describe("rectToUvBottomLeft", () => {
  it("flips Y from canvas-top to WebGL-bottom", () => {
    const [x, y, w, h] = rectToUvBottomLeft({ x: 0, y: 0, w: 128, h: 64 }, 256, 128);
    expect(x).toBeCloseTo(0);
    expect(w).toBeCloseTo(0.5);
    expect(h).toBeCloseTo(0.5);
    expect(y).toBeCloseTo(0.5);
  });
});

describe("jumpAmount", () => {
  it("starts a hop on each cut slot and returns to rest", () => {
    expect(jumpAmount(0, slots)).toBe(0);
    expect(jumpAmount(0.08, slots)).toBeGreaterThan(0.4);
    const peakAt = JUMP_DURATION * 0.34;
    expect(jumpAmount(peakAt, slots)).toBeCloseTo(1, 2);
    expect(jumpAmount(JUMP_DURATION + 0.02, slots)).toBe(0);
  });

  it("restarts at the next photo/cut slot", () => {
    expect(jumpAmount(0.467, slots)).toBe(0);
    expect(jumpAmount(0.467 + 0.1, slots)).toBeGreaterThan(0.5);
    expect(jumpAmount(0.4, slots)).toBe(0);
  });

  it("offsets upward in canvas space for the sharp 16:9 photo", () => {
    const up = jumpOffsetPx(0.12, slots, 1280);
    expect(up).toBeLessThan(0);
    expect(Math.abs(up)).toBeCloseTo(1280 * JUMP_AMPLITUDE * jumpAmount(0.12, slots), 5);
    const panel = mainPanelRect(720, 1280);
    const rest = coverDest(1920, 1080, panel.w, panel.h, { dx: panel.x, dy: panel.y });
    const hopped = coverDest(1920, 1080, panel.w, panel.h, {
      dx: panel.x,
      dy: panel.y,
      offsetY: up,
    });
    expect(hopped.y).toBeLessThan(rest.y);
    expect(hopped.y - rest.y).toBeCloseTo(up, 5);
  });

  it("handles an empty slot list", () => {
    expect(jumpAmount(1, [])).toBe(0);
    expect(jumpOffsetPx(0.12, [], 1280)).toBe(0);
  });
});
