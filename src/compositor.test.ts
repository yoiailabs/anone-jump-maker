import { describe, expect, it } from "vitest";
import {
  BLUR_SOURCE,
  FRAME_FX_TARGET,
  IMAGE_FILTER_BLUR_IMPL,
  IMAGE_FILTER_TARGET,
  JUMP_FLASH_TARGET,
  PHOTO_UPLOAD_PATH,
  SONG_CREDIT,
  blurTapCount,
  plateDest,
  songCreditFontSize,
  songCreditLayout,
} from "./compositor.ts";
import {
  CHAR_SCALE,
  JUMP_COVER_SCALE,
  JUMP_DROP_FRAC,
  LANDSCAPE_CHAR_SCALE,
  OUTPUTS,
  STAGE_MAX_REM,
  TEMPLATE_FPS,
  characterDest,
  mainPanelRect,
  swapFx,
  usesBlurBackdrop,
} from "./layout.ts";

const F = 1 / TEMPLATE_FPS;

describe("photo orientation", () => {
  it("uploads photos via Canvas2D so UNPACK_FLIP_Y_WEBGL does not invert ImageBitmap", () => {
    expect(PHOTO_UPLOAD_PATH).toBe("canvas2d-blit");
  });
});

describe("swap fx draw path", () => {
  it("blurs the composed 16:9 main frame, not the photo alone", () => {
    expect(BLUR_SOURCE).toBe("main-frame");
  });

  it("applies the zoom blur / rgb split to the composited frame and the jump flash to the photo layer", () => {
    expect(FRAME_FX_TARGET).toBe("composited-main");
    expect(JUMP_FLASH_TARGET).toBe("photo-plate");
  });

  it("applies the image filter to the photo plate only, with a software blur that works on iOS", () => {
    expect(IMAGE_FILTER_TARGET).toBe("photo-plate");
    expect(IMAGE_FILTER_BLUR_IMPL).toBe("image-data-box");
  });

  it("places the official 16:9 character 1:1 so it is not larger than the CapCut / X template", () => {
    const dest = characterDest(608, 342);
    expect(CHAR_SCALE).toBe(1);
    expect(dest).toEqual({ x: 0, y: 0, w: 608, h: 342 });
  });

  it("moves the jump plate down and shrinks it at the cut, in both aspects", () => {
    const slots = [0, 15 * F, 30 * F];
    const at = swapFx(15 * F, slots, "jump");
    const rest = swapFx(15 * F + 7 * F, slots, "jump");
    for (const [w, h, style] of [
      [608, mainPanelRect(608, 1080).h, "jump"],
      [OUTPUTS.landscape.width, OUTPUTS.landscape.height, "jump"],
    ] as const) {
      const cut = plateDest(1920, 1080, w, h, at, style);
      const still = plateDest(1920, 1080, w, h, rest, style);
      expect(cut.y).toBeGreaterThan(still.y);
      expect(cut.w).toBeLessThan(still.w);
      // the measured drop is 17.5% of the panel height; the shrink about the centre lowers the top edge further
      expect(cut.y - still.y).toBeCloseTo(JUMP_DROP_FRAC * h + (still.h - cut.h) / 2, 3);
      expect(still.w).toBeCloseTo(w * JUMP_COVER_SCALE, 3);
      // never uncover the panel
      expect(cut.y).toBeLessThanOrEqual(1e-6);
      expect(cut.y + cut.h).toBeGreaterThanOrEqual(h - 1e-6);
      expect(still.y).toBeLessThanOrEqual(1e-6);
      expect(still.y + still.h).toBeGreaterThanOrEqual(h - 1e-6);
    }
  });

  it("keeps landscape as a full 16:9 plate and lets zoom shrink it with a backdrop", () => {
    expect(usesBlurBackdrop("landscape")).toBe(false);
    const dest = characterDest(OUTPUTS.landscape.width, OUTPUTS.landscape.height, LANDSCAPE_CHAR_SCALE);
    expect(LANDSCAPE_CHAR_SCALE).toBe(1);
    expect(dest).toEqual({ x: 0, y: 0, w: OUTPUTS.landscape.width, h: OUTPUTS.landscape.height });
    const slots = [0, 15 * F, 30 * F];
    const peak = swapFx(15 * F, slots, "zoom");
    const plate = plateDest(1920, 1080, 1280, 720, peak, "zoom");
    expect(plate.w).toBeCloseTo(1280 * 0.866, 0);
    expect(plate.x).toBeGreaterThan(0);
    expect(peak.backdrop).toBe(true);
    const rest = plateDest(1920, 1080, 1280, 720, swapFx(0.2, slots, "zoom"), "zoom");
    expect(rest).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  });

  it("uses more blur taps for longer streaks, and none when there is no streak", () => {
    expect(blurTapCount(0)).toBe(1);
    expect(blurTapCount(0.027 * 1280)).toBeGreaterThanOrEqual(9);
    expect(blurTapCount(0.027 * 608)).toBeGreaterThanOrEqual(5);
    expect(blurTapCount(500)).toBeLessThanOrEqual(15);
    expect(blurTapCount(20) % 2).toBe(1);
  });

  it("advances the plate and fx from the given time only", () => {
    const slots = [0, 0.5, 1.0];
    expect(swapFx(0.12, slots, "jump")).toEqual(swapFx(0.12, slots, "jump"));
    expect(swapFx(0.5, slots, "zoom")).toEqual(swapFx(0.5, slots, "zoom"));
    expect(swapFx(0.12, slots, "jump").flashAdd).toBe(0);
  });
});

describe("song credit", () => {
  it("uses the requested credit line", () => {
    expect(SONG_CREDIT).toBe("♪ あのね - ナナツカゼ");
  });

  it("sits just under the portrait 16:9 panel, top-right of the lower band", () => {
    const { width: w, height: h } = OUTPUTS.portrait;
    const panel = mainPanelRect(w, h, "portrait");
    const credit = songCreditLayout(w, h, "portrait");
    const landscape = songCreditLayout(OUTPUTS.landscape.width, OUTPUTS.landscape.height, "landscape");
    expect(credit.fontSize).toBe(songCreditFontSize("portrait"));
    expect(credit.fontSize).toBeLessThan(landscape.fontSize);
    expect(credit.fontSize).toBeGreaterThanOrEqual(12);
    expect(credit.fontSize).toBeLessThanOrEqual(28);
    const portraitVisual = credit.fontSize * (STAGE_MAX_REM.portrait / w);
    const landscapeVisual = landscape.fontSize * (STAGE_MAX_REM.landscape / OUTPUTS.landscape.width);
    expect(portraitVisual).toBeCloseTo(landscapeVisual, 1);
    expect(credit.x).toBe(w - credit.pad);
    expect(credit.y).toBe(panel.y + panel.h + credit.pad);
    expect(credit.pad).toBeGreaterThanOrEqual(8);
    expect(credit.pad).toBeLessThan(20);
    expect(credit.y).toBeGreaterThan(panel.y + panel.h);
    expect(credit.y + credit.fontSize).toBeLessThan(h);
    expect(credit.textAlign).toBe("right");
    expect(credit.textBaseline).toBe("top");
  });

  it("keeps landscape credit at the canvas bottom-right with a small inset", () => {
    const { width: w, height: h } = OUTPUTS.landscape;
    const credit = songCreditLayout(w, h, "landscape");
    expect(credit.fontSize).toBeGreaterThanOrEqual(32);
    expect(credit.fontSize).toBeLessThanOrEqual(48);
    expect(credit.x).toBe(w - credit.pad);
    expect(credit.y).toBe(h - credit.pad);
    expect(credit.pad).toBeGreaterThanOrEqual(8);
    expect(credit.pad).toBeLessThan(20);
    expect(credit.textAlign).toBe("right");
    expect(credit.textBaseline).toBe("bottom");
  });
});
