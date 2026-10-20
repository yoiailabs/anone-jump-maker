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
  JUMP_DROP_FRAC_PORTRAIT,
  JUMP_FLASH_ADD,
  JUMP_FLASH_FRAMES,
  JUMP_FLASH_IN_FRAMES,
  JUMP_FLASH_GLOBAL,
  JUMP_FLASH_SCREEN,
  JUMP_REST_SHIFT_FRAC,
  JUMP_RISE_FRAMES,
  JUMP_SHRINK,
  OUTPUT,
  OUTPUTS,
  PORTRAIT_CHROMA_FRAME,
  PORTRAIT_CHROMA_H,
  PORTRAIT_CHROMA_Y,
  PORTRAIT_TEMPLATE,
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
  TEMPLATE_BAND_Y,
  TEMPLATES,
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
  jumpDropFrac,
  jumpFlashEnvelope,
  mainPanelRect,
  outputSize,
  plateCoverScale,
  plateRestShiftFrac,
  rectToUvBottomLeft,
  swapFx,
  templateBandRect,
  usesBlurBackdrop,
  ZOOM_PORTRAIT_TIME_SCALE,
  zoomEdgeTravelOverShortSide,
  zoomInScale,
  zoomKeyAt,
  zoomOutScale,
  zoomReferenceTau,
  zoomTransitionScale,
} from "./layout.ts";
import templateCuts from "../public/official-assets/template/landscape-cuts.json" with { type: "json" };

describe("output size", () => {
  it("lists landscape first and uses it as the default", () => {
    expect(DEFAULT_ASPECT).toBe("landscape");
    expect(ASPECT_MODES).toEqual(["landscape", "portrait"]);
  });

  it("lists zoom first and uses it as the default effect", () => {
    expect(SWAP_STYLES).toEqual(["zoom", "jump", "glitch"]);
    expect(DEFAULT_SWAP_STYLE).toBe("zoom");
    expect(DEFAULT_SWAP_STYLE).toBe(SWAP_STYLES[0]);
  });

  it("exports portrait at 1080x1920 and keeps the 608x1080 template frame", () => {
    expect(outputSize()).toEqual({ width: 1080, height: 1920 });
    expect(outputSize("portrait")).toEqual({ width: 1080, height: 1920 });
    expect(OUTPUT).toEqual({ width: 1080, height: 1920 });
    expect(OUTPUT.width / OUTPUT.height).toBeCloseTo(9 / 16, 5);
    expect(PORTRAIT_TEMPLATE).toEqual({ width: 608, height: 1080 });
  });

  it("uses 1920x1080 for landscape export size", () => {
    expect(outputSize("landscape")).toEqual({ width: 1920, height: 1080 });
    expect(OUTPUTS.landscape).toEqual({ width: 1920, height: 1080 });
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
    expect(dest.w / dest.h).toBeCloseTo(PORTRAIT_TEMPLATE.width / (TEMPLATE_BAND_H - 2), 5);
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
      { width: 360, height: 640 },
      { width: 608, height: 1080 },
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
    expect(dest).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
    expect(characterOutlinePx(608)).toBe(2);
    expect(characterOutlinePx(OUTPUTS.portrait.width)).toBe(4);
    expect(characterOutlinePx(OUTPUTS.landscape.width)).toBe(6);
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
    expect(panel).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
  });

  it("fills the landscape canvas with the 16:9 main frame", () => {
    const panel = mainPanelRect(OUTPUTS.landscape.width, OUTPUTS.landscape.height, "landscape");
    expect(panel).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  });
});

describe("templateBandRect", () => {
  it("takes the landscape frame, audio, and beats for the portrait template", () => {
    expect(TEMPLATES.portrait.video).toBe("/official-assets/template/landscape.mp4");
    expect(TEMPLATES.portrait.audio).toBe(TEMPLATES.portrait.video);
    expect(TEMPLATES.portrait.cuts).toBe("/official-assets/template/landscape-cuts.json");
    expect(TEMPLATES.landscape.video).toBe("/official-assets/template/landscape.mp4");
    expect(TEMPLATES.landscape.audio).toBe(TEMPLATES.landscape.video);
    expect(PORTRAIT_CHROMA_FRAME).toEqual({ width: 1920, height: 1080 });
    expect(PORTRAIT_CHROMA_Y).toBe(6);
    expect(PORTRAIT_CHROMA_H).toBe(1074);
    const band = templateBandRect(1920, 1080, "portrait");
    expect(band).toEqual({ x: 0, y: 6, w: 1920, h: 1074 });
    expect(band.y + band.h).toBe(PORTRAIT_CHROMA_FRAME.height);
    // 縦動画の帯位置をこのフレームに置くと下にはみ出す。ファイルを差し替えるだけでは足りない。
    const scale = PORTRAIT_CHROMA_FRAME.width / PORTRAIT_TEMPLATE.width;
    const crop = Math.round(TEMPLATE_BAND_TOP_CROP * scale);
    const oldY = Math.round(PORTRAIT_CHROMA_FRAME.height * (TEMPLATE_BAND_Y / PORTRAIT_TEMPLATE.height)) + crop;
    const oldH = Math.round(PORTRAIT_CHROMA_FRAME.width * (TEMPLATE_BAND_H / PORTRAIT_TEMPLATE.width)) - crop;
    expect(oldY + oldH - PORTRAIT_CHROMA_FRAME.height).toBe(312);
  });

  it("uses the full landscape template frame", () => {
    expect(templateBandRect(1920, 1080, "landscape")).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  });
});

describe("coverDest / sharpCoverScale", () => {
  it("covers a landscape photo onto 1080x1920 by cropping the sides", () => {
    const dest = coverDest(1920, 1080, OUTPUT.width, OUTPUT.height);
    expect(dest.h).toBeCloseTo(OUTPUT.height, 5);
    expect(dest.w).toBeGreaterThan(OUTPUT.width);
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

  it("matches portrait jump amplitude to the same fraction of the shorter side", () => {
    // dy = JUMP_DROP_FRAC × (shorterSide / frameHeight)
    // landscape shorter side is the height, so the fraction stays 0.175.
    // portrait shorter side is the width: 0.175 × 1080/1920.
    const portraitAspect = OUTPUTS.portrait.width / OUTPUTS.portrait.height;
    expect(JUMP_DROP_FRAC_PORTRAIT).toBeCloseTo(JUMP_DROP_FRAC * portraitAspect, 8);
    expect(JUMP_DROP_FRAC_PORTRAIT).toBe(jumpDropFrac("portrait"));
    expect(jumpDropFrac("landscape")).toBe(JUMP_DROP_FRAC);
    expect(jumpDropFrac()).toBe(JUMP_DROP_FRAC);

    const landscapeTravel = jumpDropFrac("landscape") * OUTPUTS.landscape.height;
    const portraitTravel = jumpDropFrac("portrait") * OUTPUTS.portrait.height;
    expect(landscapeTravel / OUTPUTS.landscape.height).toBeCloseTo(JUMP_DROP_FRAC, 8);
    expect(portraitTravel / OUTPUTS.portrait.width).toBeCloseTo(JUMP_DROP_FRAC, 8);
    expect(portraitTravel).toBeCloseTo(189, 3);
    expect(landscapeTravel).toBeCloseTo(189, 3);

    const landscape = jumpCycle(0, "landscape");
    const portrait = jumpCycle(0, "portrait");
    expect(landscape.dy).toBeCloseTo(JUMP_DROP_FRAC, 6);
    expect(portrait.dy).toBeCloseTo(JUMP_DROP_FRAC_PORTRAIT, 6);
    expect(portrait.dy).toBeCloseTo(landscape.dy * portraitAspect, 8);
    expect(portrait.scale).toBeCloseTo(landscape.scale, 8);
    expect(jumpCycle(0)).toEqual(landscape);

    for (const k of [1, 4, 7, 10, 14, 15]) {
      const wide = jumpCycle(k, "landscape");
      const tall = jumpCycle(k, "portrait");
      expect(tall.dy).toBeCloseTo(wide.dy * portraitAspect, 8);
      expect(tall.scale).toBeCloseTo(wide.scale, 8);
    }
    expect(jumpCycle(7, "portrait")).toEqual({ scale: 1, dy: 0 });
    expect(jumpCycle(-1, "portrait")).toEqual({ scale: 1, dy: 0 });

    const slots = [0, 15 * F, 30 * F];
    const atLandscape = swapFx(15 * F, slots, "jump", "landscape");
    const atPortrait = swapFx(15 * F, slots, "jump", "portrait");
    expect(atLandscape.dy).toBeCloseTo(JUMP_DROP_FRAC, 6);
    expect(atPortrait.dy).toBeCloseTo(JUMP_DROP_FRAC_PORTRAIT, 6);
    expect(atPortrait.scale).toBeCloseTo(atLandscape.scale, 8);
    expect(atPortrait.flashAdd).toBeCloseTo(atLandscape.flashAdd, 8);
    expect(swapFx(15 * F, slots, "jump").dy).toBeCloseTo(atLandscape.dy, 8);
    expect(swapFx(0, slots, "jump", "portrait").dy).toBeCloseTo(JUMP_DROP_FRAC_PORTRAIT, 6);
    expect(swapFx(15 * F + 7 * F, slots, "jump", "portrait").dy).toBe(0);

    const zoomPortrait = swapFx(15 * F, slots, "zoom", "portrait");
    const zoomLandscape = swapFx(15 * F, slots, "zoom", "landscape");
    expect(zoomPortrait).toEqual(zoomLandscape);
    expect(zoomPortrait.dy).toBe(0);

    // Cover overscan was sized for the landscape 17.5% drop. The smaller portrait
    // drop keeps the plate inside that margin (top slack stays positive).
    const slack = (mode: "portrait" | "landscape", dy: number) => {
      const { width, height } = OUTPUTS[mode];
      const cut = coverDest(1920, 1080, width, height, {
        scale: JUMP_COVER_SCALE * (1 - JUMP_SHRINK),
        offsetY: (JUMP_REST_SHIFT_FRAC + dy) * height,
      });
      return -cut.y / height;
    };
    const portraitSlack = slack("portrait", JUMP_DROP_FRAC_PORTRAIT);
    const landscapeSlack = slack("landscape", JUMP_DROP_FRAC);
    expect(portraitSlack).toBeGreaterThan(0);
    expect(landscapeSlack).toBeGreaterThan(0);
    expect(portraitSlack).toBeGreaterThan(landscapeSlack);
  });

  it("smoothly fades in over 3 frames and out over 4 frames", () => {
    expect(JUMP_FLASH_IN_FRAMES).toBe(3);
    expect(JUMP_FLASH_FRAMES).toBe(4);
    for (const [k, value] of [[-4, 0], [-3, 0], [-2, 1 / 9], [-1, 4 / 9],
      [0, 1], [1, 0.5625], [2, 0.25], [3, 0.0625], [4, 0], [5, 0]]) {
      expect(jumpFlashEnvelope(k!)).toBeCloseTo(value!, 10);
    }
    for (let k = -5; k <= 6; k += 0.01) {
      const value = jumpFlashEnvelope(k);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      if (k < 0) expect(jumpFlashEnvelope(Math.min(0, k + 0.01))).toBeGreaterThanOrEqual(value);
      else expect(jumpFlashEnvelope(k + 0.01)).toBeLessThanOrEqual(value);
    }
    for (const k of [-3, 0, 4]) {
      expect(jumpFlashEnvelope(k - 1e-7)).toBeCloseTo(jumpFlashEnvelope(k), 6);
      expect(jumpFlashEnvelope(k + 1e-7)).toBeCloseTo(jumpFlashEnvelope(k), 6);
    }
    // 30fps のカット前に、中間の明るさが少なくとも 2 枚入る。
    const preCut = Array.from({ length: JUMP_FLASH_IN_FRAMES }, (_, i) =>
      swapFx((15 - JUMP_FLASH_IN_FRAMES + i) * F, [0, 15 * F], "jump").flashAdd / JUMP_FLASH_ADD);
    expect(preCut.filter((value) => value > 1e-10 && value < 1 - 1e-10)).toHaveLength(2);
    expect(preCut[1]).toBeCloseTo(1 / 9, 10);
    expect(preCut[2]).toBeCloseTo(4 / 9, 10);
    expect(JUMP_FLASH_ADD).toBe(0.3);
    expect(JUMP_FLASH_SCREEN).toBe(0.2);
    expect(JUMP_FLASH_GLOBAL).toBe(0.06);
  });

  it("only anticipates real cuts and combines overlapping flashes continuously", () => {
    expect(swapFx(0, [0], "jump").flashAdd).toBe(JUMP_FLASH_ADD);
    for (const k of [4, 12, 13, 14, 15, 30]) {
      expect(swapFx(k * F, [0], "jump").flashAdd).toBe(0);
      expect(swapFx((15 + k) * F, [0, 15 * F], "jump").flashAdd).toBeCloseTo(0, 12);
    }
    const slots = [0, 2 * F, 4 * F];
    for (let k = 0; k <= 9; k += 0.025) {
      const time = k * F;
      const expected = Math.max(...slots.map((s) => jumpFlashEnvelope((time - s) / F)));
      const fx = swapFx(time, slots, "jump");
      expect(fx.flashAdd / JUMP_FLASH_ADD).toBeCloseTo(expected, 8);
      expect(fx.flashAdd).toBeGreaterThanOrEqual(0);
      expect(fx.flashAdd).toBeLessThanOrEqual(JUMP_FLASH_ADD);
      expect(swapFx(time + 1e-9, slots, "jump").flashAdd).toBeCloseTo(fx.flashAdd, 6);
    }
    for (const k of [2, 4]) {
      const at = swapFx(k * F, slots, "jump");
      expect(swapFx(k * F - 1e-9, slots, "jump").flashAdd).toBeCloseTo(at.flashAdd, 6);
    }
  });

  it("drives the plate from the slot start, with pre-cut flash and no zoom fx", () => {
    const slots = [0, 15 * F, 30 * F, 45 * F];
    const before = swapFx(15 * F - 1 * F, slots, "jump");
    expect(before.plateSlot).toBe(0);
    expect(before.flashAdd).toBeCloseTo(JUMP_FLASH_ADD * 4 / 9, 6);
    expect(before.flashScreen).toBeCloseTo(JUMP_FLASH_SCREEN * 4 / 9, 6);
    expect(before.flashGlobal).toBeCloseTo(JUMP_FLASH_GLOBAL * 4 / 9, 6);
    const earlier = swapFx(13 * F, slots, "jump");
    expect(earlier.plateSlot).toBe(0);
    expect(earlier.flashAdd).toBeCloseTo(JUMP_FLASH_ADD * 1 / 9, 6);
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

  it("stretches portrait zoom by the tuned short-side time scale and keeps the cut", () => {
    const { width: pw, height: ph } = OUTPUTS.portrait;
    const { width: lw, height: lh } = OUTPUTS.landscape;
    const edge = (width: number, height: number) => height / Math.min(width, height);
    const derived = edge(pw, ph) / edge(lw, lh);
    expect(zoomEdgeTravelOverShortSide("portrait")).toBeCloseTo(edge(pw, ph), 12);
    expect(zoomEdgeTravelOverShortSide("landscape")).toBe(1);
    expect(zoomEdgeTravelOverShortSide("landscape")).toBeCloseTo(edge(lw, lh), 12);
    expect(derived).toBeCloseTo(ph / pw, 12);
    expect(ZOOM_PORTRAIT_TIME_SCALE).toBe(1.4);
    expect(zoomTransitionScale("portrait")).toBe(ZOOM_PORTRAIT_TIME_SCALE);
    expect(zoomTransitionScale("landscape")).toBe(1);
    expect(zoomTransitionScale()).toBe(1);
    // 1.4 sits near the midpoint of 1× and the 1920/1080 edge-speed ratio, and short of that ratio.
    expect(ZOOM_PORTRAIT_TIME_SCALE).toBeGreaterThan(Math.sqrt(derived));
    expect(ZOOM_PORTRAIT_TIME_SCALE).toBeLessThan(derived);
    expect(ZOOM_PORTRAIT_TIME_SCALE).toBeCloseTo((1 + derived) / 2, 1);
    const scale = ZOOM_PORTRAIT_TIME_SCALE;
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

    // landscape swaps one frame after the pose cut; portrait swaps at that same curve point
    expect(land(F).plateSlot).toBe(1);
    expect(land(F).scale).toBeCloseTo(1 + ZOOM_IN_START, 6);
    expect(port(F).plateSlot).toBe(0);
    expect(port(F).scale).toBeCloseTo(land(F / scale).scale, 5);
    expect(port((scale - 0.05) * F).plateSlot).toBe(0);
    expect(port((scale + 0.05) * F).plateSlot).toBe(1);
    expect(port((scale + 0.05) * F).scale).toBeCloseTo(land(((scale + 0.05) / scale) * F).scale, 5);

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

    // jump timing and scale stay put; only the drop follows the short side
    const jumpPort = swapFx(S, slots, "jump", "portrait");
    const jumpLand = swapFx(S, slots, "jump", "landscape");
    expect(jumpPort.plateSlot).toBe(jumpLand.plateSlot);
    expect(jumpPort.scale).toBeCloseTo(jumpLand.scale, 8);
    expect(jumpPort.flashAdd).toBeCloseTo(jumpLand.flashAdd, 8);
    expect(jumpPort.dy).toBeCloseTo(jumpLand.dy * (OUTPUTS.portrait.width / OUTPUTS.portrait.height), 8);
    expect(swapFx(S, slots, "jump")).toEqual(jumpLand);
  });

  it("keeps the longer portrait zoom inside the shortest template cut", () => {
    const gaps = templateCuts.slotFrames.slice(1).map((frame, i) => frame - templateCuts.slotFrames[i]!);
    const shortest = Math.min(...gaps);
    expect(shortest).toBe(13);
    const scale = zoomTransitionScale("portrait");
    const tail = ZOOM_KEYS[ZOOM_KEYS.length - 1]![0];
    const windowFrames = ZOOM_OUT_FRAMES * scale + tail * scale;
    expect(windowFrames).toBeCloseTo((ZOOM_OUT_FRAMES + tail) * ZOOM_PORTRAIT_TIME_SCALE, 6);
    expect(windowFrames).toBeLessThan(shortest);
    // the 13-frame cut (192→205) has finished the previous zoom before the next shrink
    const slots = templateCuts.slots;
    const cut = 192 / TEMPLATE_FPS;
    const next = 205 / TEMPLATE_FPS;
    const afterFx = cut + (tail * scale + 0.25) / TEMPLATE_FPS;
    const settled = swapFx(afterFx, slots, "zoom", "portrait");
    expect(hasFrameFx(settled)).toBe(false);
    expect(settled.scale).toBeCloseTo(1, 2);
    expect((next - afterFx) * TEMPLATE_FPS).toBeGreaterThan(ZOOM_OUT_FRAMES * scale);

  });

  it("samples portrait zoom as the landscape curve stretched by the tuned time scale", () => {
    const scale = ZOOM_PORTRAIT_TIME_SCALE;
    expect(zoomTransitionScale("portrait")).toBe(scale);
    const slots = [0, 40 * F, 80 * F];
    const S = 40 * F;
    const keys = ["scale", "blur", "rgb", "lift", "haze", "wave"] as const;
    for (let step = -16; step <= 24; step += 1) {
      const tau = step / 4;
      const land = swapFx(S + tau * F, slots, "zoom", "landscape");
      const port = swapFx(S + tau * scale * F, slots, "zoom", "portrait");
      expect(port.plateSlot, `plate at τ=${tau}`).toBe(land.plateSlot);
      expect(port.backdrop, `backdrop at τ=${tau}`).toBe(land.backdrop);
      expect(port.dy, `dy at τ=${tau}`).toBe(land.dy);
      expect(port.flashAdd, `flash at τ=${tau}`).toBe(land.flashAdd);
      for (const key of keys) {
        expect(port[key], `${key} at τ=${tau}`).toBeCloseTo(land[key], 5);
      }
    }
    const dip = swapFx(S, slots, "zoom", "portrait");
    const punch = swapFx(S + scale * F, slots, "zoom", "portrait");
    expect(dip.scale).toBeCloseTo(1 - ZOOM_OUT_SHRINK, 6);
    expect(punch.scale).toBeCloseTo(1 + ZOOM_IN_START, 5);
    expect(dip.scale).toBeCloseTo(swapFx(S, slots, "zoom", "landscape").scale, 6);
    expect(punch.scale).toBeCloseTo(swapFx(S + F, slots, "zoom", "landscape").scale, 5);
  });

  it("is available in both aspects (2x2 matrix)", () => {
    expect(isSwapStyle("jump")).toBe(true);
    expect(isSwapStyle("zoom")).toBe(true);
    expect(isSwapStyle("slide")).toBe(false);
    expect(isImageFilter("none")).toBe(true);
    expect(isImageFilter("blur-strong")).toBe(true);
    expect(isImageFilter("blur-weak")).toBe(true);
    expect(isImageFilter("blur")).toBe(false);
    // At the cut, portrait zoom matches landscape. Off the cut it is stretched by
    // ZOOM_PORTRAIT_TIME_SCALE. Jump dy is a fraction of panel height, smaller on portrait.
    const slots = [0, 0.5, 1.0];
    const zoom = swapFx(0.5, slots, "zoom", "portrait");
    expect(zoom).toEqual(swapFx(0.5, slots, "zoom", "landscape"));
    const portraitJump = swapFx(0.5, slots, "jump", "portrait");
    const landscapeJump = swapFx(0.5, slots, "jump", "landscape");
    expect(portraitJump.dy).toBeCloseTo(
      landscapeJump.dy * (OUTPUTS.portrait.width / OUTPUTS.portrait.height),
      6,
    );
    expect(portraitJump.scale).toBeCloseTo(landscapeJump.scale, 8);
    for (const [w, h, fx] of [
      [OUTPUT.width, mainPanelRect(OUTPUT.width, OUTPUT.height).h, portraitJump],
      [OUTPUTS.landscape.width, OUTPUTS.landscape.height, landscapeJump],
    ] as const) {
      expect(zoom.blur * w).toBeGreaterThan(5);
      expect(Math.abs(fx.dy) * h).toBeGreaterThan(20);
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
