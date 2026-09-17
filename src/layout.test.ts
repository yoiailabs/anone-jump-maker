import { describe, expect, it } from "vitest";
import {
  BLUR_COVER_SCALE,
  BLUR_SOURCE,
  CHAR_OUTLINE_PX,
  CHAR_SCALE,
  CHAR_SHIFT_Y,
  LANDSCAPE_CHAR_SCALE,
  JUMP_COVER_SCALE,
  JUMP_CYCLE_FRAMES,
  JUMP_DROP_FRAC,
  JUMP_FLASH_ADD,
  JUMP_FLASH_FRAMES,
  JUMP_FLASH_GLOBAL,
  JUMP_FLASH_SCREEN,
  JUMP_REST_SHIFT_FRAC,
  JUMP_RISE_FRAMES,
  JUMP_SHRINK,
  OUTPUT,
  OUTPUTS,
  STAGE_MAX_REM,
  PANEL_DIVIDER_PX,
  TEMPLATE_BAND_H,
  TEMPLATE_BAND_Y,
  TEMPLATE_FPS,
  ZOOM_IN_START,
  ZOOM_KEYS,
  ZOOM_OUT_FRAMES,
  ZOOM_OUT_SHRINK,
  ZOOM_SWAP_DELAY_FRAMES,
  characterDest,
  characterOutlinePx,
  characterScale,
  characterShiftY,
  coverDest,
  hasFrameFx,
  isAspectMode,
  isSwapStyle,
  jumpCycle,
  jumpFlashEnvelope,
  mainPanelRect,
  outputSize,
  plateCoverScale,
  plateRestShiftFrac,
  rectToUvBottomLeft,
  swapFx,
  templateBandRect,
  usesBlurBackdrop,
  zoomInScale,
  zoomKeyAt,
  zoomOutScale,
} from "./layout.ts";

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
    expect(STAGE_MAX_REM.portrait).toBe(21);
    expect(STAGE_MAX_REM.landscape).toBe(26);
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

  it("gives the jump plate enough overscan that the measured drop never uncovers the panel", () => {
    expect(plateCoverScale("jump")).toBe(JUMP_COVER_SCALE);
    expect(plateCoverScale("zoom")).toBe(1);
    expect(plateRestShiftFrac("jump")).toBe(JUMP_REST_SHIFT_FRAC);
    expect(plateRestShiftFrac("zoom")).toBe(0);
    const panel = mainPanelRect(OUTPUT.width, OUTPUT.height);
    // at rest (top of travel) the bottom edge must still be covered
    const rest = coverDest(1920, 1080, panel.w, panel.h, {
      scale: JUMP_COVER_SCALE,
      offsetY: JUMP_REST_SHIFT_FRAC * panel.h,
    });
    expect(rest.y).toBeLessThanOrEqual(1e-6);
    expect(rest.y + rest.h).toBeGreaterThanOrEqual(panel.h - 1e-6);
    // at the cut (smallest + lowest) the top edge must still be covered
    const cut = coverDest(1920, 1080, panel.w, panel.h, {
      scale: JUMP_COVER_SCALE * (1 - JUMP_SHRINK),
      offsetY: (JUMP_REST_SHIFT_FRAC + JUMP_DROP_FRAC) * panel.h,
    });
    expect(cut.y).toBeLessThanOrEqual(1e-6);
    expect(cut.y + cut.h).toBeGreaterThanOrEqual(panel.h - 1e-6);
    expect(cut.x).toBeLessThanOrEqual(1e-6);
    expect(cut.x + cut.w).toBeGreaterThanOrEqual(panel.w - 1e-6);
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

const F = 1 / TEMPLATE_FPS;

describe("jump cycle (Short o1ROhNU0UNw)", () => {
  it("starts low and small at the cut and springs back to rest in 7 frames", () => {
    expect(JUMP_CYCLE_FRAMES).toBe(15);
    expect(JUMP_RISE_FRAMES).toBe(7);
    const k0 = jumpCycle(0);
    expect(k0.dy).toBeCloseTo(JUMP_DROP_FRAC, 6);
    expect(k0.scale).toBeCloseTo(1 - JUMP_SHRINK, 6);
    // measured 640px band: 35.4 24.4 15.9 9.7 5.1 2.1 0.5 0  (dy px)
    const px = (k: number) => jumpCycle(k).dy * 202.7;
    expect(px(1)).toBeCloseTo(24.4, 0);
    expect(px(2)).toBeCloseTo(15.9, 0);
    expect(px(3)).toBeCloseTo(9.7, 0);
    expect(px(4)).toBeCloseTo(5.1, 0);
    expect(px(5)).toBeCloseTo(2.1, 0);
    expect(px(7)).toBe(0);
    // measured scale .947 .961 .972 .981 .989 .995 .998 1
    expect(jumpCycle(1).scale).toBeCloseTo(0.961, 2);
    expect(jumpCycle(3).scale).toBeCloseTo(0.981, 2);
    expect(jumpCycle(5).scale).toBeCloseTo(0.995, 2);
    expect(jumpCycle(7).scale).toBe(1);
  });

  it("sinks again quadratically toward the next beat and holds at the bottom", () => {
    // measured k=8..14: 0.3 1.5 4.9 8.6 13.7 19.7 27.0 (dy px @640) ; scale .999 .997 .995 .988 .981 .972 .960
    const px = (k: number) => jumpCycle(k).dy * 202.7;
    expect(px(10)).toBeCloseTo(4.9, 0);
    expect(px(12)).toBeCloseTo(13.7, 0);
    expect(px(13)).toBeCloseTo(19.7, 0);
    expect(px(14)).toBeCloseTo(27.0, 0);
    expect(px(15)).toBeCloseTo(35.4, 0);
    expect(jumpCycle(14).scale).toBeCloseTo(0.96, 2);
    expect(jumpCycle(15).scale).toBeCloseTo(1 - JUMP_SHRINK, 6);
    expect(jumpCycle(20)).toEqual(jumpCycle(15));
    expect(jumpCycle(-1)).toEqual({ scale: 1, dy: 0 });
  });

  it("flashes only after the cut and dies within 3 frames", () => {
    expect(JUMP_FLASH_FRAMES).toBe(3);
    expect(jumpFlashEnvelope(-0.5)).toBe(0);
    expect(jumpFlashEnvelope(0)).toBe(1);
    expect(jumpFlashEnvelope(1)).toBeCloseTo(4 / 9, 6);
    expect(jumpFlashEnvelope(2)).toBeCloseTo(1 / 9, 6);
    expect(jumpFlashEnvelope(3)).toBe(0);
    expect(JUMP_FLASH_ADD + JUMP_FLASH_SCREEN).toBeGreaterThan(0.4);
    expect(JUMP_FLASH_GLOBAL).toBeLessThan(0.1);
  });

  it("drives the plate from the slot start, with no pre-cut flash and no zoom fx", () => {
    const slots = [0, 15 * F, 30 * F, 45 * F];
    const before = swapFx(15 * F - 1 * F, slots, "jump");
    expect(before.plateSlot).toBe(0);
    expect(before.flashAdd).toBe(0);
    expect(before.flashScreen).toBe(0);
    // one frame before the cut the outgoing photo is already sinking (k=14 of its own cycle)
    expect(before.dy).toBeCloseTo(jumpCycle(14).dy, 6);
    expect(before.scale).toBeCloseTo(jumpCycle(14).scale, 6);
    const at = swapFx(15 * F, slots, "jump");
    expect(at.plateSlot).toBe(1);
    expect(at.dy).toBeCloseTo(JUMP_DROP_FRAC, 6);
    expect(at.scale).toBeCloseTo(1 - JUMP_SHRINK, 6);
    expect(at.flashAdd).toBeCloseTo(JUMP_FLASH_ADD, 6);
    expect(at.flashScreen).toBeCloseTo(JUMP_FLASH_SCREEN, 6);
    expect(at.flashGlobal).toBeCloseTo(JUMP_FLASH_GLOBAL, 6);
    expect(at.blur).toBe(0);
    expect(at.rgb).toBe(0);
    expect(at.backdrop).toBe(false);
    expect(hasFrameFx(at)).toBe(false);
    const later = swapFx(15 * F + 7 * F, slots, "jump");
    expect(later.dy).toBe(0);
    expect(later.scale).toBe(1);
    expect(later.flashAdd).toBe(0);
    // the opening slot also starts on the cycle with the flash (the Short does at 0 s)
    const opening = swapFx(0, slots, "jump");
    expect(opening.plateSlot).toBe(0);
    expect(opening.dy).toBeCloseTo(JUMP_DROP_FRAC, 6);
    expect(opening.flashAdd).toBeCloseTo(JUMP_FLASH_ADD, 6);
  });

  it("handles an empty or single slot list", () => {
    expect(swapFx(1, [], "jump").scale).toBe(1);
    expect(swapFx(0.5, [0], "jump").plateSlot).toBe(0);
    expect(swapFx(0.5, [0], "zoom").plateSlot).toBe(0);
  });
});

describe("zoom cycle (hagikaze_sami)", () => {
  it("shrinks the outgoing photo over 3 frames to .866 and keeps it one frame past the pose change", () => {
    expect(ZOOM_OUT_FRAMES).toBe(3);
    expect(ZOOM_SWAP_DELAY_FRAMES).toBe(1);
    expect(zoomOutScale(-3)).toBe(1);
    // measured −2/−1/0: .988 .947 .866
    expect(zoomOutScale(-2)).toBeCloseTo(0.988, 2);
    expect(zoomOutScale(-1)).toBeCloseTo(0.947, 2);
    expect(zoomOutScale(0)).toBeCloseTo(1 - ZOOM_OUT_SHRINK, 6);
    expect(zoomOutScale(0)).toBeCloseTo(0.866, 3);
  });

  it("brings the incoming photo in from 1.115 and settles by frame 4", () => {
    // measured +1/+2/+3/+4: 1.115 1.025 1.004 1
    expect(zoomInScale(1)).toBeCloseTo(1 + ZOOM_IN_START, 6);
    expect(zoomInScale(2)).toBeCloseTo(1.023, 2);
    expect(zoomInScale(3)).toBeCloseTo(1.0046, 3);
    expect(zoomInScale(4)).toBeCloseTo(1, 2);
  });

  it("peaks the whole-frame blur / rgb / lift on the pose-change frame and hazes the next", () => {
    const peak = zoomKeyAt(0);
    expect(peak.blur).toBeCloseTo(0.027, 6);
    expect(peak.rgb).toBeCloseTo(0.0065, 6);
    expect(peak.lift).toBeCloseTo(0.35, 6);
    expect(peak.haze).toBe(0);
    const pre = zoomKeyAt(-1);
    expect(pre.blur).toBeGreaterThan(0);
    expect(pre.blur).toBeLessThan(peak.blur);
    expect(pre.lift).toBeGreaterThan(0);
    expect(pre.lift).toBeLessThan(0.1);
    const post = zoomKeyAt(1);
    expect(post.blur).toBeGreaterThan(0);
    expect(post.blur).toBeLessThan(peak.blur);
    expect(post.lift).toBe(0);
    expect(post.haze).toBeCloseTo(0.25, 6);
    expect(zoomKeyAt(-2).blur).toBe(0);
    expect(zoomKeyAt(3).blur).toBe(0);
    expect(zoomKeyAt(-5).lift).toBe(0);
    // halfway between keys is linear
    expect(zoomKeyAt(-0.5).blur).toBeCloseTo((pre.blur + peak.blur) / 2, 6);
    expect(ZOOM_KEYS[0]![1].blur).toBe(0);
  });

  it("swaps the photo one frame after the pose change, not on it", () => {
    const slots = [0, 15 * F, 30 * F];
    const S = 15 * F;
    const m2 = swapFx(S - 2 * F, slots, "zoom");
    expect(m2.plateSlot).toBe(0);
    expect(m2.scale).toBeCloseTo(0.988, 2);
    expect(m2.backdrop).toBe(true);
    const m1 = swapFx(S - 1 * F, slots, "zoom");
    expect(m1.plateSlot).toBe(0);
    expect(m1.scale).toBeCloseTo(0.947, 2);
    expect(m1.blur).toBeCloseTo(0.008, 6);
    expect(m1.cutIndex).toBe(1);
    const s0 = swapFx(S, slots, "zoom");
    expect(s0.plateSlot).toBe(0);
    expect(s0.scale).toBeCloseTo(0.866, 3);
    expect(s0.blur).toBeCloseTo(0.027, 6);
    expect(s0.rgb).toBeCloseTo(0.0065, 6);
    expect(s0.lift).toBeCloseTo(0.35, 6);
    expect(s0.backdrop).toBe(true);
    expect(s0.flashAdd).toBe(0);
    expect(s0.dy).toBe(0);
    expect(hasFrameFx(s0)).toBe(true);
    const s1 = swapFx(S + 1 * F, slots, "zoom");
    expect(s1.plateSlot).toBe(1);
    expect(s1.scale).toBeCloseTo(1.115, 3);
    expect(s1.haze).toBeCloseTo(0.25, 6);
    expect(s1.backdrop).toBe(false);
    const s2 = swapFx(S + 2 * F, slots, "zoom");
    expect(s2.scale).toBeCloseTo(1.023, 2);
    const s4 = swapFx(S + 4 * F, slots, "zoom");
    expect(s4.scale).toBeCloseTo(1, 2);
    expect(hasFrameFx(s4)).toBe(false);
    // the opening slot is static in the reference
    const opening = swapFx(0, slots, "zoom");
    expect(opening.scale).toBe(1);
    expect(hasFrameFx(opening)).toBe(false);
  });

  it("is available in both aspects (2x2 matrix)", () => {
    expect(isSwapStyle("jump")).toBe(true);
    expect(isSwapStyle("zoom")).toBe(true);
    expect(isSwapStyle("slide")).toBe(false);
    // the fx model is aspect-agnostic: fractions of panel size
    const slots = [0, 0.5, 1.0];
    const zoom = swapFx(0.5, slots, "zoom");
    const jump = swapFx(0.5, slots, "jump");
    for (const [w, h] of [
      [OUTPUT.width, mainPanelRect(OUTPUT.width, OUTPUT.height).h],
      [OUTPUTS.landscape.width, OUTPUTS.landscape.height],
    ] as const) {
      expect(zoom.blur * w).toBeGreaterThan(5);
      expect(Math.abs(jump.dy) * h).toBeGreaterThan(20);
    }
  });
});
