import { describe, expect, it } from "vitest";
import {
  BLUR_COVER_SCALE,
  BLUR_SOURCE,
  CHAR_OUTLINE_PX,
  CHAR_SCALE,
  CHAR_SHIFT_Y,
  LANDSCAPE_CHAR_SCALE,
  JUMP_AMPLITUDE,
  JUMP_DURATION,
  JUMP_PEAK_U,
  SWAP_DURATION,
  SWAP_FLASH_PEAK,
  SWAP_PRE_ROLL,
  ZOOM_DURATION,
  ZOOM_FLASH_PEAK,
  ZOOM_PRE_ROLL,
  OUTPUT,
  OUTPUTS,
  PANEL_DIVIDER_PX,
  TEMPLATE_BAND_H,
  TEMPLATE_BAND_Y,
  characterDest,
  characterOutlinePx,
  characterScale,
  characterShiftY,
  coverDest,
  isAspectMode,
  jumpAmount,
  jumpOffsetPx,
  mainPanelRect,
  outputSize,
  rectToUvBottomLeft,
  sharpCoverScale,
  effectiveSwapStyle,
  isSwapStyle,
  swapChromaPx,
  swapFx,
  swapSlidePx,
  templateBandRect,
  usesBlurBackdrop,
} from "./layout.ts";

const slots = [0, 0.467, 0.933, 1.467];

describe("output size", () => {
  it("matches the 608x1080 template", () => {
    expect(outputSize()).toEqual({ width: 608, height: 1080 });
    expect(outputSize("portrait")).toEqual({ width: 608, height: 1080 });
    expect(OUTPUT).toEqual({ width: 608, height: 1080 });
    expect(OUTPUT.width / OUTPUT.height).toBeCloseTo(608 / 1080, 5);
  });

  it("uses 1280x720 for landscape preview and save", () => {
    expect(outputSize("landscape")).toEqual({ width: 1280, height: 720 });
    expect(OUTPUTS.landscape).toEqual({ width: 1280, height: 720 });
    expect(OUTPUTS.landscape.width / OUTPUTS.landscape.height).toBeCloseTo(16 / 9, 5);
  });

  it("treats only portrait as a blur-band canvas", () => {
    expect(usesBlurBackdrop("portrait")).toBe(true);
    expect(usesBlurBackdrop("landscape")).toBe(false);
    expect(isAspectMode("landscape")).toBe(true);
    expect(isAspectMode("square")).toBe(false);
  });

  it("uses a main-frame blur with a 1px divider", () => {
    expect(BLUR_COVER_SCALE).toBe(1);
    expect(PANEL_DIVIDER_PX).toBe(1);
    expect(BLUR_SOURCE).toBe("main-frame");
  });
});

describe("characterDest", () => {
  it("scales the keyed band up and bottom-aligns it in the 16:9", () => {
    expect(CHAR_SCALE).toBeCloseTo(1.7, 5);
    expect(CHAR_OUTLINE_PX).toBe(2);
    const dest = characterDest(608, 342);
    expect(dest.w).toBeCloseTo(608 * CHAR_SCALE, 5);
    expect(dest.h).toBeCloseTo(342 * CHAR_SCALE, 5);
    expect(dest.x).toBeCloseTo((608 - dest.w) / 2, 5);
    expect(dest.y + dest.h).toBeCloseTo(342, 5);
    expect(dest.y).toBeLessThan(0);
  });

  it("shifts the portrait character down so the 16:9 and blur match the reference", () => {
    expect(CHAR_SHIFT_Y).toBe(80);
    expect(characterShiftY(TEMPLATE_BAND_H, "portrait")).toBe(80);
    expect(characterShiftY(TEMPLATE_BAND_H, "landscape")).toBe(0);
    const dest = characterDest(608, 342, CHAR_SCALE, characterShiftY(342, "portrait"));
    expect(dest.y + dest.h).toBeCloseTo(342 + CHAR_SHIFT_Y, 5);
    expect(dest.y).toBeLessThan(0);
    // still overflows the panel top (scale 1.7), just less than a pure bottom-align
    const flush = characterDest(608, 342, CHAR_SCALE, 0);
    expect(dest.y).toBeGreaterThan(flush.y);
  });

  it("uses a slightly smaller scale on landscape so the photo stays visible", () => {
    expect(characterScale("portrait")).toBe(CHAR_SCALE);
    expect(characterScale("landscape")).toBe(LANDSCAPE_CHAR_SCALE);
    expect(LANDSCAPE_CHAR_SCALE).toBeGreaterThan(1);
    expect(LANDSCAPE_CHAR_SCALE).toBeLessThan(CHAR_SCALE);
    const dest = characterDest(OUTPUTS.landscape.width, OUTPUTS.landscape.height, LANDSCAPE_CHAR_SCALE);
    expect(dest.w).toBeCloseTo(1280 * LANDSCAPE_CHAR_SCALE, 5);
    expect(dest.h).toBeCloseTo(720 * LANDSCAPE_CHAR_SCALE, 5);
    expect(dest.x).toBeCloseTo((1280 - dest.w) / 2, 5);
    expect(dest.y + dest.h).toBeCloseTo(720, 5);
    expect(dest.y).toBeLessThan(0);
    expect(characterOutlinePx(608)).toBe(2);
    expect(characterOutlinePx(1280)).toBe(4);
  });
});

describe("mainPanelRect", () => {
  it("places a full-width 16:9 panel on the measured green band", () => {
    const panel = mainPanelRect(OUTPUT.width, OUTPUT.height);
    expect(panel.x).toBe(0);
    expect(panel.w).toBe(608);
    expect(panel.y).toBe(TEMPLATE_BAND_Y);
    expect(panel.h).toBe(TEMPLATE_BAND_H);
    expect(panel.w / panel.h).toBeCloseTo(16 / 9, 5);
    expect(panel.y / OUTPUT.height).toBeCloseTo(0.2889, 3);
    expect((panel.y + panel.h) / OUTPUT.height).toBeCloseTo(0.6056, 3);
  });

  it("fills the landscape canvas with the 16:9 main frame", () => {
    const panel = mainPanelRect(OUTPUTS.landscape.width, OUTPUTS.landscape.height, "landscape");
    expect(panel).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  });
});

describe("templateBandRect", () => {
  it("crops the same 16:9 band from the template", () => {
    const band = templateBandRect(608, 1080);
    expect(band).toEqual({ x: 0, y: 312, w: 608, h: 342 });
  });

  it("uses the full landscape template frame", () => {
    expect(templateBandRect(1920, 1080, "landscape")).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  });
});

describe("coverDest / sharpCoverScale", () => {
  it("covers a landscape photo onto 608x1080 by cropping the sides", () => {
    const dest = coverDest(1920, 1080, 608, 1080);
    expect(dest.h).toBeCloseTo(1080, 5);
    expect(dest.w).toBeGreaterThan(608);
    expect(dest.x).toBeLessThan(0);
  });

  it("cover-maps the 16:9 main frame onto the full canvas", () => {
    const dest = coverDest(608, 342, 608, 1080, { scale: BLUR_COVER_SCALE });
    expect(dest.h).toBeCloseTo(1080, 5);
    expect(dest.w).toBeGreaterThan(608);
    expect(dest.y).toBeCloseTo(0, 5);
  });

  it("scales the sharp 16:9 photo enough that a full hop stays inside the panel", () => {
    const panel = mainPanelRect(OUTPUT.width, OUTPUT.height);
    const scale = sharpCoverScale(OUTPUT.height, panel.h);
    const hop = OUTPUT.height * JUMP_AMPLITUDE;
    expect(hop).toBeCloseTo(34, 5);
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
    const peakAt = JUMP_DURATION * JUMP_PEAK_U;
    expect(peakAt).toBeCloseTo(6.5 / 30, 5);
    expect(jumpAmount(peakAt, slots)).toBeCloseTo(1, 2);
    expect(jumpAmount(JUMP_DURATION + 0.02, slots)).toBe(0);
  });

  it("matches the measured 30fps envelope (rise ~6-7, rounded peak, land ~13)", () => {
    expect(JUMP_DURATION).toBeCloseTo(13 / 30, 8);
    expect(JUMP_PEAK_U).toBeCloseTo(0.5, 5);
    const at = (frame: number) => jumpAmount(frame / 30, slots);
    expect(at(0)).toBe(0);
    expect(at(3)).toBeGreaterThan(0.55);
    expect(at(3)).toBeLessThan(0.75);
    expect(at(6)).toBeGreaterThan(0.95);
    expect(at(7)).toBeGreaterThan(0.95);
    expect(at(6)).toBeGreaterThan(at(3));
    expect(at(10)).toBeGreaterThan(0.55);
    expect(at(10)).toBeLessThan(at(7));
    expect(at(13)).toBe(0);
    // old 0.34-peak curve reached ~1 by frame 4; the reference is still climbing then
    expect(at(4)).toBeLessThan(0.9);
  });

  it("restarts at the next photo/cut slot", () => {
    expect(jumpAmount(0.467, slots)).toBe(0);
    expect(jumpAmount(0.467 + 0.1, slots)).toBeGreaterThan(0.5);
    expect(jumpAmount(JUMP_DURATION + 0.01, slots)).toBe(0);
    expect(JUMP_DURATION + 0.01).toBeLessThan(slots[1]!);
  });

  it("also hops the landscape photo on the same cut curve", () => {
    const up = jumpOffsetPx(0.12, slots, OUTPUTS.landscape.height);
    expect(up).toBeLessThan(0);
    expect(Math.abs(up)).toBeCloseTo(OUTPUTS.landscape.height * JUMP_AMPLITUDE * jumpAmount(0.12, slots), 5);
    const rest = coverDest(1920, 1080, 1280, 720);
    const hopped = coverDest(1920, 1080, 1280, 720, { offsetY: up });
    expect(hopped.y).toBeLessThan(rest.y);
  });

  it("offsets upward in canvas space for the sharp 16:9 photo", () => {
    const up = jumpOffsetPx(0.12, slots, OUTPUT.height);
    expect(up).toBeLessThan(0);
    expect(Math.abs(up)).toBeCloseTo(OUTPUT.height * JUMP_AMPLITUDE * jumpAmount(0.12, slots), 5);
    const panel = mainPanelRect(OUTPUT.width, OUTPUT.height);
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
    expect(jumpOffsetPx(0.12, [], OUTPUT.height)).toBe(0);
  });
});

describe("swapFx", () => {
  it("does nothing on the opening slot (no previous photo)", () => {
    const fx = swapFx(0.02, slots);
    expect(fx.amount).toBe(0);
    expect(fx.flash).toBe(0);
    expect(fx.punch).toBe(1);
  });

  it("starts a white flash one frame before the cut", () => {
    const pre = swapFx(slots[1]! - SWAP_PRE_ROLL * 0.6, slots);
    expect(pre.flash).toBeGreaterThan(0.2);
    expect(pre.flash).toBeLessThan(SWAP_FLASH_PEAK);
    expect(pre.punch).toBeGreaterThan(1);
  });

  it("peaks at the cut then dies within a few frames", () => {
    const at = swapFx(slots[1]!, slots);
    const later = swapFx(slots[1]! + SWAP_DURATION + 0.02, slots);
    expect(at.flash).toBeGreaterThan(0.7);
    expect(at.punch).toBeGreaterThan(1.1);
    expect(Math.abs(swapSlidePx(at, 1280))).toBeGreaterThan(4);
    expect(swapChromaPx(at, 1280)).toBeGreaterThan(1);
    expect(later.flash).toBe(0);
    expect(later.punch).toBe(1);
  });

  it("is idle with one slot or none", () => {
    expect(swapFx(0.5, [0]).flash).toBe(0);
    expect(swapFx(0.5, []).flash).toBe(0);
  });
});

describe("landscape swap styles", () => {
  it("keeps zoom as a landscape-only choice", () => {
    expect(isSwapStyle("jump")).toBe(true);
    expect(isSwapStyle("zoom")).toBe(true);
    expect(isSwapStyle("slide")).toBe(false);
    expect(effectiveSwapStyle("portrait", "zoom")).toBe("jump");
    expect(effectiveSwapStyle("landscape", "zoom")).toBe("zoom");
    expect(effectiveSwapStyle("landscape", "jump")).toBe("jump");
  });

  it("drops hop on zoom and keeps the jump envelope otherwise", () => {
    const hopped = jumpOffsetPx(0.12, slots, OUTPUTS.landscape.height, "jump");
    expect(hopped).toBeLessThan(0);
    expect(jumpOffsetPx(0.12, slots, OUTPUTS.landscape.height, "zoom")).toBe(0);
    expect(jumpOffsetPx(0.12, slots, OUTPUT.height, "zoom")).toBe(0);
  });

  it("uses a short radial warp with rgb split, not a white flash", () => {
    const jump = swapFx(slots[1]!, slots, "jump");
    const zoom = swapFx(slots[1]!, slots, "zoom");
    const rest = swapFx(0.8, slots, "zoom");
    const after = swapFx(slots[1]! + ZOOM_DURATION + 0.01, slots, "zoom");
    expect(zoom.flash).toBe(0);
    expect(zoom.flash).toBeLessThanOrEqual(ZOOM_FLASH_PEAK);
    expect(jump.flash).toBeGreaterThan(0.7);
    expect(zoom.punch).toBeGreaterThan(1.05);
    expect(zoom.punch).toBeLessThan(1.25);
    expect(zoom.zoomBlur).toBeGreaterThan(0.5);
    expect(jump.zoomBlur).toBe(0);
    expect(zoom.slide).toBe(0);
    expect(zoom.skew).toBe(0);
    expect(zoom.chroma).toBeGreaterThan(0.5);
    expect(zoom.whip).toBeGreaterThan(0.3);
    expect(zoom.wave).toBeGreaterThan(0.1);
    expect(zoom.smear).toBeGreaterThan(0.2);
    expect(zoom.mix).toBeGreaterThan(0.1);
    expect(zoom.mix).toBeLessThan(0.75);
    expect(zoom.cutIndex).toBe(1);
    expect(rest.zoomBlur).toBe(0);
    expect(rest.flash).toBe(0);
    expect(after.zoomBlur).toBe(0);
    expect(ZOOM_PRE_ROLL + ZOOM_DURATION).toBeGreaterThanOrEqual(0.05);
    expect(ZOOM_PRE_ROLL + ZOOM_DURATION).toBeLessThanOrEqual(0.15);
  });
});
