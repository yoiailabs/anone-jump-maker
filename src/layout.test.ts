import { describe, expect, it } from "vitest";
import {
  BLUR_COVER_SCALE,
  JUMP_AMPLITUDE,
  JUMP_DURATION,
  OUTPUTS,
  containDest,
  coverDest,
  isAspectMode,
  jumpAmount,
  jumpOffsetPx,
  mainPanelRect,
  outputSize,
  rectToUvBottomLeft,
  usesBlurBackdrop,
  videoOverlayRect,
} from "./layout.ts";

const slots = [0, 0.467, 0.933, 1.467];

describe("aspect helpers", () => {
  it("accepts only the two export modes", () => {
    expect(isAspectMode("portrait")).toBe(true);
    expect(isAspectMode("landscape")).toBe(true);
    expect(isAspectMode("square")).toBe(false);
  });

  it("sizes portrait 9:16 and landscape 16:9", () => {
    expect(outputSize("portrait")).toEqual({ width: 720, height: 1280 });
    expect(outputSize("landscape")).toEqual({ width: 1280, height: 720 });
    expect(OUTPUTS.portrait.width / OUTPUTS.portrait.height).toBeCloseTo(9 / 16, 5);
    expect(OUTPUTS.landscape.width / OUTPUTS.landscape.height).toBeCloseTo(16 / 9, 5);
  });

  it("uses the blur backdrop only in portrait", () => {
    expect(usesBlurBackdrop("portrait")).toBe(true);
    expect(usesBlurBackdrop("landscape")).toBe(false);
  });
});

describe("mainPanelRect", () => {
  it("fills the landscape canvas (no letterbox panel)", () => {
    expect(mainPanelRect(1280, 720, "landscape")).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  });

  it("places a centered 16:9 panel on the portrait canvas", () => {
    const panel = mainPanelRect(720, 1280, "portrait");
    expect(panel.x).toBe(0);
    expect(panel.w).toBe(720);
    expect(panel.w / panel.h).toBeCloseTo(16 / 9, 5);
    expect(panel.y).toBeCloseTo((1280 - panel.h) / 2, 5);
    expect(panel.y).toBeGreaterThan(100);
    expect(panel.y + panel.h).toBeLessThan(1280 - 100);
  });
});

describe("coverDest / containDest", () => {
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

  it("contains 9:16 video on a 16:9 canvas", () => {
    const dest = containDest(360, 640, 1280, 720);
    expect(dest.h).toBeCloseTo(720, 5);
    expect(dest.w).toBeLessThan(1280);
    expect(dest.x).toBeGreaterThan(0);
  });
});

describe("videoOverlayRect", () => {
  it("covers the portrait canvas", () => {
    const dest = videoOverlayRect(720, 1280, 360, 640, "portrait");
    expect(dest.w).toBeCloseTo(720, 5);
    expect(dest.h).toBeCloseTo(1280, 5);
  });

  it("contains the template on landscape so the jump is not cropped", () => {
    const dest = videoOverlayRect(1280, 720, 360, 640, "landscape");
    expect(dest.h).toBeCloseTo(720, 5);
    expect(dest.w).toBeLessThan(500);
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

  it("offsets only the portrait blur layer, upward in canvas space", () => {
    expect(jumpOffsetPx(0.12, slots, 1280, "landscape")).toBe(0);
    const up = jumpOffsetPx(0.12, slots, 1280, "portrait");
    expect(up).toBeLessThan(0);
    expect(Math.abs(up)).toBeLessThan(1280 * JUMP_AMPLITUDE + 1e-6);
  });

  it("handles an empty slot list", () => {
    expect(jumpAmount(1, [])).toBe(0);
  });
});
