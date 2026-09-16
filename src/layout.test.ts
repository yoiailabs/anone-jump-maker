import { describe, expect, it } from "vitest";
import {
  BLUR_COVER_SCALE,
  JUMP_AMPLITUDE,
  JUMP_DURATION,
  MAIN_PANEL_Y_SHIFT,
  OUTPUT,
  PANEL_DIVIDER_PX,
  coverDest,
  jumpAmount,
  jumpOffsetPx,
  mainPanelRect,
  outputSize,
  rectToUvBottomLeft,
  sharpCoverScale,
  videoOverlayRect,
} from "./layout.ts";

const slots = [0, 0.467, 0.933, 1.467];

describe("output size", () => {
  it("is portrait 9:16 only", () => {
    expect(outputSize()).toEqual({ width: 720, height: 1280 });
    expect(OUTPUT).toEqual({ width: 720, height: 1280 });
    expect(OUTPUT.width / OUTPUT.height).toBeCloseTo(9 / 16, 5);
  });

  it("zooms the blur cover more than the sharp panel and keeps a thin divider", () => {
    expect(BLUR_COVER_SCALE).toBeGreaterThan(1.4);
    expect(PANEL_DIVIDER_PX).toBeGreaterThanOrEqual(2);
    expect(PANEL_DIVIDER_PX).toBeLessThanOrEqual(5);
  });
});

describe("mainPanelRect", () => {
  it("places a full-width 16:9 panel below canvas center, on the character band", () => {
    const panel = mainPanelRect(720, 1280);
    const centeredY = (1280 - panel.h) / 2;
    expect(panel.x).toBe(0);
    expect(panel.w).toBe(720);
    expect(panel.w / panel.h).toBeCloseTo(16 / 9, 5);
    expect(MAIN_PANEL_Y_SHIFT).toBeGreaterThan(0);
    expect(panel.y).toBeCloseTo(centeredY + 1280 * MAIN_PANEL_Y_SHIFT, 5);
    expect(panel.y).toBeGreaterThan(centeredY + 80);
    // テンプレキャラの胴〜足元（およそ 0.50–0.76）に下端が乗る
    expect(panel.y + panel.h).toBeGreaterThan(1280 * 0.73);
    expect(panel.y + panel.h).toBeLessThan(1280 * 0.82);
    expect(panel.y + panel.h).toBeLessThan(1280 - 80);
    expect(panel.x + panel.w).toBe(720);
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

describe("videoOverlayRect", () => {
  it("covers the portrait canvas", () => {
    const dest = videoOverlayRect(720, 1280, 360, 640);
    expect(dest.w).toBeCloseTo(720, 5);
    expect(dest.h).toBeCloseTo(1280, 5);
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

  it("offsets upward in canvas space for both blur and the sharp 16:9 photo", () => {
    const up = jumpOffsetPx(0.12, slots, 1280);
    expect(up).toBeLessThan(0);
    expect(Math.abs(up)).toBeLessThan(1280 * JUMP_AMPLITUDE + 1e-6);
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
