import { describe, expect, it } from "vitest";
import {
  BLUR_SOURCE,
  CHARACTER_SIZES,
  CHARACTER_SIZE_SCALE,
  CHAR_OUTLINE_PX,
  CHAR_SCALE,
  CHAR_SHIFT_Y,
  DEFAULT_ASPECT,
  DEFAULT_CHARACTER_SIZE,
  DEFAULT_SWAP_STYLE,
  ASPECT_MODES,
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
  PORTRAIT_INK_BOTTOM,
  PORTRAIT_INK_BOTTOM_ROW,
  PORTRAIT_INK_X0,
  PORTRAIT_INK_X1,
  PORTRAIT_STICKER_BOTTOM,
  PORTRAIT_STICKER_LEFT,
  PORTRAIT_STICKER_RIGHT,
  TEMPLATE_BAND_H,
  TEMPLATE_BAND_TOP_CROP,
  TEMPLATE_FPS,
  ZOOM_IN_START,
  ZOOM_KEYS,
  ZOOM_OUT_FRAMES,
  ZOOM_OUT_SHRINK,
  ZOOM_SWAP_DELAY_FRAMES,
  characterDest,
  characterOutlinePx,
  portraitCutY,
  characterPlateScale,
  characterScale,
  characterShiftY,
  coverDest,
  filterBlurPx,
  hasFrameFx,
  hasImageFilter,
  IMAGE_FILTERS,
  isAspectMode,
  isCharacterSize,
  isImageFilter,
  isSwapStyle,
  SWAP_STYLES,
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
  zoomEdgeTravelOverShortSide,
  zoomInScale,
  zoomKeyAt,
  zoomOutScale,
  zoomReferenceTau,
  zoomTransitionScale,
} from "./layout.ts";
import portraitCuts from "../public/template/cuts.json" with { type: "json" };

describe("output size", () => {
  it("lists landscape first and uses it as the default", () => {
    expect(DEFAULT_ASPECT).toBe("landscape");
    expect(ASPECT_MODES).toEqual(["landscape", "portrait"]);
  });

  it("lists zoom first and uses it as the default effect", () => {
    expect(SWAP_STYLES).toEqual(["zoom", "jump"]);
    expect(DEFAULT_SWAP_STYLE).toBe("zoom");
    expect(DEFAULT_SWAP_STYLE).toBe(SWAP_STYLES[0]);
  });

  it("matches the 608x1080 template", () => {
    expect(outputSize()).toEqual({ width: 608, height: 1080 });
    expect(outputSize("portrait")).toEqual({ width: 608, height: 1080 });
    expect(OUTPUT).toEqual({ width: 608, height: 1080 });
    expect(OUTPUT.width / OUTPUT.height).toBeCloseTo(608 / 1080, 5);
  });

  it("uses 1280x720 for landscape export size", () => {
    expect(outputSize("landscape")).toEqual({ width: 1280, height: 720 });
    expect(OUTPUTS.landscape).toEqual({ width: 1280, height: 720 });
    expect(OUTPUTS.landscape.width / OUTPUTS.landscape.height).toBeCloseTo(16 / 9, 5);
    expect(STAGE_MAX_REM.portrait).toBe(21);
    expect(STAGE_MAX_REM.landscape).toBe(26);
  });

  it("does not use a blur backdrop in either aspect", () => {
    expect(usesBlurBackdrop("portrait")).toBe(false);
    expect(usesBlurBackdrop("landscape")).toBe(false);
    expect(isAspectMode("landscape")).toBe(true);
    expect(isAspectMode("square")).toBe(false);
  });

  it("keeps zoom blur on the composited frame", () => {
    expect(BLUR_SOURCE).toBe("main-frame");
  });
});

function portraitSticker(dest: { x: number; y: number; w: number; h: number }, canvasW: number) {
  const outline = characterOutlinePx(canvasW);
  const left = dest.x + PORTRAIT_INK_X0 * dest.w - outline;
  const right = dest.x + PORTRAIT_INK_X1 * dest.w + outline;
  const bottom = portraitCutY(dest);
  return { left, right, bottom, width: right - left, center: (left + right) / 2 };
}

describe("characterDest", () => {
  it("places the portrait sticker on the utNIG60-li0 box", () => {
    expect(CHAR_SCALE).toBe(1);
    expect(CHAR_OUTLINE_PX).toBe(2);
    const { width: canvasW, height: canvasH } = OUTPUTS.portrait;
    const dest = characterDest(canvasW, canvasH, CHAR_SCALE, 0, "portrait");
    expect(dest.w / dest.h).toBeCloseTo(OUTPUT.width / (TEMPLATE_BAND_H - 2), 5);
    const sticker = portraitSticker(dest, canvasW);
    expect(sticker.left / canvasW).toBeCloseTo(PORTRAIT_STICKER_LEFT, 5);
    expect(sticker.right / canvasW).toBeCloseTo(PORTRAIT_STICKER_RIGHT, 5);
    expect(sticker.width / canvasW).toBeCloseTo(PORTRAIT_STICKER_RIGHT - PORTRAIT_STICKER_LEFT, 5);
    expect(sticker.center / canvasW).toBeCloseTo((PORTRAIT_STICKER_LEFT + PORTRAIT_STICKER_RIGHT) / 2, 5);
    expect(sticker.bottom / canvasH).toBeCloseTo(PORTRAIT_STICKER_BOTTOM, 5);
    expect(sticker.bottom).toBeCloseTo(PORTRAIT_STICKER_BOTTOM * canvasH, 5);
    expect(PORTRAIT_INK_BOTTOM_ROW).toBe(TEMPLATE_BAND_H - 1);
    expect(PORTRAIT_INK_BOTTOM).toBe(
      (PORTRAIT_INK_BOTTOM_ROW + 1 - TEMPLATE_BAND_TOP_CROP) / (TEMPLATE_BAND_H - TEMPLATE_BAND_TOP_CROP),
    );
    expect(PORTRAIT_INK_BOTTOM).toBe(1);
    expect(sticker.width / canvasW).toBeGreaterThan(0.7);
    expect(sticker.width / canvasW).toBeLessThan(0.74);
    expect(sticker.center / canvasW).toBeCloseTo(0.45, 2);
  });

  it("keeps the cut on 75.8% when size, scale, and shift change", () => {
    const canvases = [
      OUTPUTS.portrait,
      { width: 304, height: 540 },
      { width: 1216, height: 2160 },
    ];
    for (const { width, height } of canvases) {
      for (const scale of [1, 1.2, 1.4]) {
        for (const shiftY of [0, 12, -8]) {
          const dest = characterDest(width, height, scale, shiftY, "portrait");
          const cut = portraitCutY(dest);
          expect(cut).toBeCloseTo(dest.y + PORTRAIT_INK_BOTTOM * dest.h, 6);
          expect(cut).toBeCloseTo(PORTRAIT_STICKER_BOTTOM * height + shiftY, 5);
        }
      }
    }
  });

  it("does not extra-shift the portrait plate", () => {
    expect(CHAR_SHIFT_Y).toBe(0);
    expect(characterShiftY(TEMPLATE_BAND_H, "portrait")).toBe(0);
    expect(characterShiftY(TEMPLATE_BAND_H, "landscape")).toBe(0);
    const { width: canvasW, height: canvasH } = OUTPUTS.portrait;
    const dest = characterDest(canvasW, canvasH, CHAR_SCALE, characterShiftY(canvasH, "portrait"), "portrait");
    const still = characterDest(canvasW, canvasH, CHAR_SCALE, 0, "portrait");
    expect(dest).toEqual(still);
  });

  it("uses the same 1:1 scale on landscape as the official 16:9 template", () => {
    expect(characterScale("portrait")).toBe(CHAR_SCALE);
    expect(characterScale("landscape")).toBe(LANDSCAPE_CHAR_SCALE);
    expect(LANDSCAPE_CHAR_SCALE).toBe(1);
    expect(CHAR_SCALE).toBe(1);
    const dest = characterDest(OUTPUTS.landscape.width, OUTPUTS.landscape.height, LANDSCAPE_CHAR_SCALE, 0, "landscape");
    expect(dest).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
    expect(characterOutlinePx(608)).toBe(2);
    expect(characterOutlinePx(1280)).toBe(4);
  });
});

describe("character size", () => {
  it("defaults to the official standard scale", () => {
    expect(DEFAULT_CHARACTER_SIZE).toBe("standard");
    expect(CHARACTER_SIZES).toEqual(["standard", "1.2", "1.4"]);
    expect(isCharacterSize("standard")).toBe(true);
    expect(isCharacterSize("1.2")).toBe(true);
    expect(isCharacterSize("1.4")).toBe(true);
    expect(isCharacterSize("1.3")).toBe(false);
    expect(isCharacterSize("x1.3")).toBe(false);
    expect(isCharacterSize("large")).toBe(false);
    expect(isCharacterSize("none")).toBe(false);
    expect(characterPlateScale()).toBe(1);
    expect(characterPlateScale("standard")).toBe(1);
    expect(characterScale("portrait")).toBe(CHAR_SCALE);
    expect(characterScale("landscape", "standard")).toBe(LANDSCAPE_CHAR_SCALE);
  });

  it("scales the keyed plate by 1.2 and 1.4 in both aspects", () => {
    expect(CHARACTER_SIZE_SCALE).toEqual({
      standard: 1,
      "1.2": 1.2,
      "1.4": 1.4,
    });
    for (const size of ["1.2", "1.4"] as const) {
      const factor = CHARACTER_SIZE_SCALE[size];
      expect(characterPlateScale(size)).toBeCloseTo(factor, 5);
      expect(characterScale("portrait", size)).toBeCloseTo(CHAR_SCALE * factor, 5);
      expect(characterScale("landscape", size)).toBeCloseTo(LANDSCAPE_CHAR_SCALE * factor, 5);

      const { width: canvasW, height: canvasH } = OUTPUTS.portrait;
      const standardP = characterDest(canvasW, canvasH, characterScale("portrait", "standard"), 0, "portrait");
      const scaledP = characterDest(canvasW, canvasH, characterScale("portrait", size), 0, "portrait");
      expect(scaledP.w).toBeCloseTo(standardP.w * factor, 5);
      expect(scaledP.h).toBeCloseTo(standardP.h * factor, 5);
      const standardSticker = portraitSticker(standardP, canvasW);
      const scaledSticker = portraitSticker(scaledP, canvasW);
      expect(scaledSticker.center).toBeCloseTo(standardSticker.center, 4);
      expect(scaledSticker.bottom).toBeCloseTo(standardSticker.bottom, 4);

      const standardL = characterDest(
        OUTPUTS.landscape.width,
        OUTPUTS.landscape.height,
        characterScale("landscape", "standard"),
      );
      const scaledL = characterDest(
        OUTPUTS.landscape.width,
        OUTPUTS.landscape.height,
        characterScale("landscape", size),
      );
      expect(scaledL.w).toBeCloseTo(standardL.w * factor, 5);
      expect(scaledL.h).toBeCloseTo(standardL.h * factor, 5);
      expect(scaledL.x).toBeCloseTo((OUTPUTS.landscape.width - scaledL.w) / 2, 5);
      expect(scaledL.y + scaledL.h).toBeCloseTo(OUTPUTS.landscape.height, 5);
    }
  });
});

describe("mainPanelRect", () => {
  it("covers the portrait canvas edge to edge", () => {
    const panel = mainPanelRect(OUTPUT.width, OUTPUT.height, "portrait");
    expect(panel).toEqual({ x: 0, y: 0, w: 608, h: 1080 });
  });

  it("fills the landscape canvas with the 16:9 main frame", () => {
    const panel = mainPanelRect(OUTPUTS.landscape.width, OUTPUTS.landscape.height, "landscape");
    expect(panel).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  });
});

describe("templateBandRect", () => {
  it("crops the same 16:9 band from the template", () => {
    const band = templateBandRect(608, 1080);
    expect(band).toEqual({ x: 0, y: 314, w: 608, h: 340 });
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

  it("stretches portrait zoom by the short-side edge speed and keeps the cut", () => {
    const { width: pw, height: ph } = OUTPUTS.portrait;
    const { width: lw, height: lh } = OUTPUTS.landscape;
    const edge = (width: number, height: number) => height / Math.min(width, height);
    const scale = edge(pw, ph) / edge(lw, lh);
    expect(zoomEdgeTravelOverShortSide("portrait")).toBeCloseTo(edge(pw, ph), 12);
    expect(zoomEdgeTravelOverShortSide("landscape")).toBe(1);
    expect(zoomEdgeTravelOverShortSide("landscape")).toBeCloseTo(edge(lw, lh), 12);
    expect(zoomTransitionScale("portrait")).toBeCloseTo(ph / pw, 12);
    expect(zoomTransitionScale("portrait")).toBeCloseTo(scale, 12);
    expect(zoomTransitionScale("landscape")).toBe(1);
    expect(zoomTransitionScale()).toBe(1);
    expect(scale).toBeGreaterThan(1.7);
    expect(scale).toBeLessThan(1.8);
    expect(zoomReferenceTau(3, "landscape")).toBe(3);
    expect(zoomReferenceTau(-ZOOM_OUT_FRAMES * scale, "portrait")).toBeCloseTo(-ZOOM_OUT_FRAMES, 6);

    const slots = [0, 15 * F, 30 * F];
    const S = 15 * F;
    const land = (dt: number) => swapFx(S + dt, slots, "zoom", "landscape");
    const port = (dt: number) => swapFx(S + dt, slots, "zoom", "portrait");

    // omitted aspect is the measured landscape curve
    expect(swapFx(S, slots, "zoom")).toEqual(land(0));
    expect(swapFx(S - 2 * F, slots, "zoom").scale).toBeCloseTo(0.988, 2);

    // blur peak and fully shrunk plate stay on the pose-change frame
    expect(port(0).plateSlot).toBe(0);
    expect(port(0).scale).toBeCloseTo(land(0).scale, 6);
    expect(port(0).blur).toBeCloseTo(land(0).blur, 6);
    expect(port(0).lift).toBeCloseTo(land(0).lift, 6);

    // the new photo still arrives one frame later, in both aspects
    expect(port(F).plateSlot).toBe(1);
    expect(land(F).plateSlot).toBe(1);
    expect(port(F).scale).toBeCloseTo(1 + ZOOM_IN_START, 6);
    expect(land(F).scale).toBeCloseTo(1 + ZOOM_IN_START, 6);

    // where landscape is still full size, portrait has already shrunk
    expect(land(-3 * F).scale).toBe(1);
    expect(land(-3 * F).backdrop).toBe(false);
    expect(port(-3 * F).scale).toBeLessThan(0.995);
    expect(port(-3 * F).backdrop).toBe(true);
    expect(port(-3 * F).plateSlot).toBe(land(-3 * F).plateSlot);

    // the same reference τ is the landscape sample stretched by the aspect ratio
    expect(port(-2 * scale * F).scale).toBeCloseTo(land(-2 * F).scale, 5);
    expect(port(-1 * scale * F).scale).toBeCloseTo(land(-1 * F).scale, 5);
    expect(port(-1 * scale * F).blur).toBeCloseTo(land(-1 * F).blur, 5);

    // landscape has settled by +4; portrait is still coming in
    expect(land(4 * F).scale).toBeCloseTo(1, 2);
    expect(hasFrameFx(land(4 * F))).toBe(false);
    expect(port(4 * F).scale).toBeGreaterThan(1.005);
    expect(hasFrameFx(port(4 * F))).toBe(true);
    expect(port(4 * F).plateSlot).toBe(land(4 * F).plateSlot);

    // jump timing does not move with the aspect
    expect(swapFx(S, slots, "jump", "portrait")).toEqual(swapFx(S, slots, "jump", "landscape"));
    expect(swapFx(S, slots, "jump", "portrait")).toEqual(swapFx(S, slots, "jump"));
  });

  it("keeps the longer portrait zoom inside the shortest template cut", () => {
    const gaps = portraitCuts.slotFrames.slice(1).map((frame, i) => frame - portraitCuts.slotFrames[i]!);
    const shortest = Math.min(...gaps);
    expect(shortest).toBe(13);
    const scale = zoomTransitionScale("portrait");
    const tail = ZOOM_KEYS[ZOOM_KEYS.length - 1]![0];
    const windowFrames = ZOOM_OUT_FRAMES * scale + tail * scale;
    expect(windowFrames).toBeGreaterThan(10);
    expect(windowFrames).toBeLessThan(shortest);
    // the 13-frame cut (192→205) has finished the previous zoom before the next shrink
    const slots = portraitCuts.slots;
    const cut = 192 / TEMPLATE_FPS;
    const next = 205 / TEMPLATE_FPS;
    const afterFx = cut + (tail * scale + 0.25) / TEMPLATE_FPS;
    const settled = swapFx(afterFx, slots, "zoom", "portrait");
    expect(hasFrameFx(settled)).toBe(false);
    expect(settled.scale).toBeCloseTo(1, 2);
    expect((next - afterFx) * TEMPLATE_FPS).toBeGreaterThan(ZOOM_OUT_FRAMES * scale);

    for (let frame = 0; frame < portraitCuts.slotFrames.at(-1)!; frame += 1) {
      const time = frame / TEMPLATE_FPS;
      const portrait = swapFx(time, slots, "zoom", "portrait");
      const landscape = swapFx(time, slots, "zoom", "landscape");
      expect(portrait.plateSlot, `frame ${frame}`).toBe(landscape.plateSlot);
    }
  });

  it("is available in both aspects (2x2 matrix)", () => {
    expect(isSwapStyle("jump")).toBe(true);
    expect(isSwapStyle("zoom")).toBe(true);
    expect(isSwapStyle("slide")).toBe(false);
    expect(isImageFilter("none")).toBe(true);
    expect(isImageFilter("blur-strong")).toBe(true);
    expect(isImageFilter("blur-weak")).toBe(true);
    expect(isImageFilter("blur")).toBe(false);
    // peak amounts are fractions of the panel, so both sizes read the same blur at the cut
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

describe("image filter", () => {
  it("offers none plus two photo-plate blurs", () => {
    expect(IMAGE_FILTERS).toEqual(["none", "blur-weak", "blur-strong"]);
    expect(isImageFilter("none")).toBe(true);
    expect(isImageFilter("blur-strong")).toBe(true);
    expect(isImageFilter("blur-weak")).toBe(true);
    expect(isImageFilter("blur")).toBe(false);
    expect(hasImageFilter("none")).toBe(false);
    expect(hasImageFilter("blur-weak")).toBe(true);
    expect(hasImageFilter("blur-strong")).toBe(true);
  });

  it("uses a stronger radius for 強 than 弱, and none is zero", () => {
    const short = 720;
    expect(filterBlurPx("none", short)).toBe(0);
    expect(filterBlurPx("blur-weak", short)).toBeGreaterThan(0);
    expect(filterBlurPx("blur-weak", short)).toBeLessThan(10);
    expect(filterBlurPx("blur-strong", short)).toBeGreaterThan(filterBlurPx("blur-weak", short));
    expect(filterBlurPx("blur-strong", short)).toBeLessThanOrEqual(filterBlurPx("blur-weak", short) * 2 + 1);
    expect(filterBlurPx("blur-strong", 1440)).toBeGreaterThan(filterBlurPx("blur-strong", short));
  });
});
