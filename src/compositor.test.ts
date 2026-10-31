import { describe, expect, it } from "vitest";
import appSrc from "./app.ts?raw";
import compositorSrc from "./compositor.ts?raw";
import makerSrc from "./components/MakerApp.tsx?raw";
import { PREVIEW_RESOLUTION_SCALE, scaleCanvasSize } from "./canvas-size.ts";
import {
  BLUR_SOURCE,
  FRAME_FX_TARGET,
  IMAGE_FILTER_BLUR_IMPL,
  IMAGE_FILTER_TARGET,
  JUMP_FLASH_TARGET,
  KEYING_EXPORT_PATH,
  KEYING_FALLBACK,
  KEYING_PREFERRED,
  PHOTO_UPLOAD_PATH,
  SONG_CREDIT,
  blurTapCount,
  plateDest,
  resolveCharacterSource,
  songCreditFontSize,
  songCreditLayout,
} from "./compositor.ts";
import {
  CHAR_SCALE,
  DEFAULT_CHARACTER_SIZE,
  JUMP_COVER_SCALE,
  JUMP_DROP_FRAC,
  JUMP_DROP_FRAC_PORTRAIT,
  LANDSCAPE_CHAR_SCALE,
  OUTPUTS,
  STAGE_MAX_REM,
  TEMPLATE_FPS,
  characterDest,
  characterScale,
  mainPanelRect,
  swapFx,
  usesBlurBackdrop,
} from "./layout.ts";

import boundaries from "./fixtures/frame-boundaries.json";
import { photoForSlot, slotForTime } from "./timeline.ts";
import type { AspectMode, SwapStyle } from "./layout.ts";

const F = 1 / TEMPLATE_FPS;

describe("photo orientation", () => {
  it("uploads photos via Canvas2D so UNPACK_FLIP_Y_WEBGL does not invert ImageBitmap", () => {
    expect(PHOTO_UPLOAD_PATH).toBe("canvas2d-blit");
  });
});

describe("chroma key path", () => {
  it("prefers WebGL in the shared preview/export compositor and keeps CPU as fallback", () => {
    expect(KEYING_PREFERRED).toBe("webgl");
    expect(KEYING_FALLBACK).toBe("cpu");
    expect(KEYING_EXPORT_PATH).toBe("shared-compositor");
  });

  it("lets an export RGBA canvas override the HTML video without leaving the shared compositor", () => {
    if (!("HTMLMediaElement" in globalThis)) {
      Object.assign(globalThis, { HTMLMediaElement: { HAVE_CURRENT_DATA: 2 } });
    }
    const video = { readyState: 2, videoWidth: 608, videoHeight: 1080 } as HTMLVideoElement;
    const canvas = { width: 1920, height: 1080 } as CanvasImageSource;
    const override = { source: canvas, width: 1920, height: 1080 };
    expect(resolveCharacterSource(video, override)).toEqual(override);
    expect(resolveCharacterSource(video)).toEqual({ source: video, width: 608, height: 1080 });
    expect(KEYING_EXPORT_PATH).toBe("shared-compositor");
  });

  it("skips the HTML video while it has no current frame", () => {
    if (!("HTMLMediaElement" in globalThis)) {
      Object.assign(globalThis, { HTMLMediaElement: { HAVE_CURRENT_DATA: 2 } });
    }
    const video = { readyState: 0, videoWidth: 0, videoHeight: 0 } as HTMLVideoElement;
    expect(resolveCharacterSource(video)).toBeNull();
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

  it("places the official landscape character 1:1 on the 16:9 frame", () => {
    const dest = characterDest(OUTPUTS.landscape.width, OUTPUTS.landscape.height, 1, 0, "landscape");
    expect(CHAR_SCALE).toBe(1);
    expect(dest).toEqual({ x: 0, y: 0, w: OUTPUTS.landscape.width, h: OUTPUTS.landscape.height });
  });

  it("moves the jump plate down and shrinks it at the cut, with a smaller portrait drop", () => {
    const slots = [0, 15 * F, 30 * F];
    const cases = [
      { w: OUTPUTS.portrait.width, h: OUTPUTS.portrait.height, mode: "portrait" as const, drop: JUMP_DROP_FRAC_PORTRAIT },
      { w: OUTPUTS.landscape.width, h: OUTPUTS.landscape.height, mode: "landscape", drop: JUMP_DROP_FRAC },
    ] as const;
    for (const { w, h, mode, drop } of cases) {
      const at = swapFx(15 * F, slots, "jump", mode);
      const rest = swapFx(15 * F + 7 * F, slots, "jump", mode);
      expect(at.dy).toBeCloseTo(drop, 6);
      expect(rest.dy).toBe(0);
      const cut = plateDest(1920, 1080, w, h, at, "jump");
      const still = plateDest(1920, 1080, w, h, rest, "jump");
      expect(cut.y).toBeGreaterThan(still.y);
      expect(cut.w).toBeLessThan(still.w);
      // drop is a fraction of panel height; the shrink about the centre lowers the top edge further
      expect(cut.y - still.y).toBeCloseTo(drop * h + (still.h - cut.h) / 2, 3);
      const cover = Math.max(w / 1920, h / 1080);
      expect(still.w).toBeCloseTo(1920 * cover * JUMP_COVER_SCALE, 3);
      expect(still.h).toBeCloseTo(1080 * cover * JUMP_COVER_SCALE, 3);
      // never uncover the panel
      expect(cut.y).toBeLessThanOrEqual(1e-6);
      expect(cut.y + cut.h).toBeGreaterThanOrEqual(h - 1e-6);
      expect(still.y).toBeLessThanOrEqual(1e-6);
      expect(still.y + still.h).toBeGreaterThanOrEqual(h - 1e-6);
    }
    const portraitPx = cases[0].drop * cases[0].h;
    const landscapePx = cases[1].drop * cases[1].h;
    // both peaks are JUMP_DROP_FRAC of the frame's shorter side
    expect(portraitPx / OUTPUTS.portrait.width).toBeCloseTo(JUMP_DROP_FRAC, 6);
    expect(landscapePx / OUTPUTS.landscape.height).toBeCloseTo(JUMP_DROP_FRAC, 6);
    expect(portraitPx).toBeCloseTo(189, 3);
    expect(landscapePx).toBeCloseTo(189, 3);
    // preview and export both call compositor.draw, which threads the current aspect into swapFx
    expect(compositorSrc).toContain("swapFx(time, slots, swapStyle, mode)");
  });

  it("keeps landscape as a full 16:9 plate and lets zoom shrink it with a backdrop", () => {
    expect(usesBlurBackdrop("landscape")).toBe(false);
    expect(usesBlurBackdrop("portrait")).toBe(false);
    const dest = characterDest(OUTPUTS.landscape.width, OUTPUTS.landscape.height, LANDSCAPE_CHAR_SCALE);
    expect(LANDSCAPE_CHAR_SCALE).toBe(1);
    expect(dest).toEqual({ x: 0, y: 0, w: OUTPUTS.landscape.width, h: OUTPUTS.landscape.height });
    const slots = [0, 15 * F, 30 * F];
    const peak = swapFx(15 * F, slots, "zoom");
    const { width: lw, height: lh } = OUTPUTS.landscape;
    const plate = plateDest(lw, lh, lw, lh, peak, "zoom");
    expect(plate.w).toBeCloseTo(lw * 0.866, 0);
    expect(plate.x).toBeGreaterThan(0);
    expect(peak.backdrop).toBe(true);
    const rest = plateDest(lw, lh, lw, lh, swapFx(0.2, slots, "zoom"), "zoom");
    expect(rest).toEqual({ x: 0, y: 0, w: lw, h: lh });
  });

  it("uses more blur taps for longer streaks, and none when there is no streak", () => {
    expect(blurTapCount(0)).toBe(1);
    expect(blurTapCount(0.027 * OUTPUTS.landscape.width)).toBeGreaterThanOrEqual(9);
    expect(blurTapCount(0.027 * 608)).toBeGreaterThanOrEqual(5);
    expect(blurTapCount(500)).toBeLessThanOrEqual(15);
    expect(blurTapCount(20) % 2).toBe(1);
  });

  it("advances the plate and fx from the given time only", () => {
    const slots = [0, 0.5, 1.0];
    expect(swapFx(0.12, slots, "jump")).toEqual(swapFx(0.12, slots, "jump"));
    expect(swapFx(0.5, slots, "zoom")).toEqual(swapFx(0.5, slots, "zoom"));
    expect(swapFx(0.12, slots, "jump").flashAdd).toBeCloseTo(0.3 * 0.01, 8);
    expect(swapFx(4 * F, slots, "jump").flashAdd).toBe(0);
  });
});

describe("song credit", () => {
  it("uses the requested credit line", () => {
    expect(SONG_CREDIT).toBe("♪ あのね - ナナツカゼ");
  });

  it("sits at the portrait bottom-right, under the character cut", () => {
    const { width: w, height: h } = OUTPUTS.portrait;
    const credit = songCreditLayout(w, h, "portrait");
    const landscape = songCreditLayout(OUTPUTS.landscape.width, OUTPUTS.landscape.height, "landscape");
    expect(credit.fontSize).toBe(songCreditFontSize("portrait"));
    expect(credit.fontSize).toBeGreaterThanOrEqual(12);
    expect(credit.fontSize).toBeLessThanOrEqual(48);
    const portraitVisual = credit.fontSize * (STAGE_MAX_REM.portrait / w);
    const landscapeVisual = landscape.fontSize * (STAGE_MAX_REM.landscape / OUTPUTS.landscape.width);
    expect(portraitVisual).toBeCloseTo(landscapeVisual, 1);
    expect(credit.x).toBe(w - credit.pad);
    expect(credit.y).toBe(h - credit.pad);
    expect(credit.pad).toBeGreaterThanOrEqual(8);
    expect(credit.pad).toBeLessThan(20);
    expect(credit.y - credit.fontSize).toBeGreaterThan(h * 0.758);
    expect(credit.textAlign).toBe("right");
    expect(credit.textBaseline).toBe("bottom");
  });

  it("keeps landscape credit at the canvas bottom-right with a small inset", () => {
    const { width: w, height: h } = OUTPUTS.landscape;
    const credit = songCreditLayout(w, h, "landscape");
    expect(credit.fontSize).toBeGreaterThanOrEqual(48);
    expect(credit.fontSize).toBeLessThanOrEqual(64);
    expect(credit.x).toBe(w - credit.pad);
    expect(credit.y).toBe(h - credit.pad);
    expect(credit.pad).toBeGreaterThanOrEqual(8);
    expect(credit.pad).toBeLessThan(20);
    expect(credit.textAlign).toBe("right");
    expect(credit.textBaseline).toBe("bottom");
  });

  it("shrinks credit with the preview bitmap so CSS upscale keeps the on-screen size", () => {
    const full = songCreditLayout(OUTPUTS.landscape.width, OUTPUTS.landscape.height, "landscape");
    const previewSize = scaleCanvasSize(
      OUTPUTS.landscape.width,
      OUTPUTS.landscape.height,
      PREVIEW_RESOLUTION_SCALE,
    );
    const preview = songCreditLayout(previewSize.width, previewSize.height, "landscape");
    expect(full.fontSize).toBe(songCreditFontSize("landscape"));
    expect(preview.fontSize).toBe(songCreditFontSize("landscape", PREVIEW_RESOLUTION_SCALE));
    expect(preview.fontSize).toBeCloseTo(full.fontSize * PREVIEW_RESOLUTION_SCALE, 0);
    expect(preview.fontSize).toBeLessThan(full.fontSize);
  });
});

describe("resolveCharacterSource", () => {
  it("prefers a decoded export frame over the HTML video element", () => {
    if (!("HTMLMediaElement" in globalThis)) {
      Object.assign(globalThis, { HTMLMediaElement: { HAVE_CURRENT_DATA: 2 } });
    }
    const video = { readyState: 2, videoWidth: 608, videoHeight: 1080 } as HTMLVideoElement;
    const override = { source: { width: 1920, height: 1080 } as CanvasImageSource, width: 1920, height: 1080 };
    expect(resolveCharacterSource(video, override)).toEqual(override);
    expect(resolveCharacterSource(video)?.source).toBe(video);
    expect(resolveCharacterSource({ readyState: 0, videoWidth: 0, videoHeight: 0 } as HTMLVideoElement)).toBeNull();
  });
});

describe("character size draw path", () => {
  it("always resolves a character source for the size multipliers", () => {
    if (!("HTMLMediaElement" in globalThis)) {
      Object.assign(globalThis, { HTMLMediaElement: { HAVE_CURRENT_DATA: 2 } });
    }
    const video = { readyState: 2, videoWidth: 608, videoHeight: 1080 } as HTMLVideoElement;
    const override = { source: { width: 1920, height: 1080 } as CanvasImageSource, width: 1920, height: 1080 };
    expect(resolveCharacterSource(video, override)).toEqual(override);
    expect(resolveCharacterSource(video)?.source).toBe(video);
    expect(DEFAULT_CHARACTER_SIZE).toBe("standard");
  });

  it("keeps the keyed plate at 1× for 標準 and at 1.2 / 1.4", () => {
    expect(characterScale("portrait", "standard")).toBe(CHAR_SCALE);
    expect(characterScale("landscape", "standard")).toBe(LANDSCAPE_CHAR_SCALE);
    const panel = mainPanelRect(OUTPUTS.portrait.width, OUTPUTS.portrait.height, "portrait");
    expect(panel).toEqual({ x: 0, y: 0, w: OUTPUTS.portrait.width, h: OUTPUTS.portrait.height });
    const standard = characterDest(panel.w, panel.h, characterScale("portrait", "standard"), 0, "portrait");
    expect(standard.w).toBeGreaterThan(panel.w);
    expect(standard.h).toBeLessThan(panel.h);
    expect(standard.w / standard.h).toBeCloseTo(608 / 340, 4);
    for (const [size, factor] of [
      ["1.2", 1.2],
      ["1.4", 1.4],
    ] as const) {
      const scaled = characterDest(panel.w, panel.h, characterScale("portrait", size), 0, "portrait");
      expect(scaled.w / standard.w).toBeCloseTo(factor, 5);
      expect(scaled.h / standard.h).toBeCloseTo(factor, 5);
      const land = characterDest(
        OUTPUTS.landscape.width,
        OUTPUTS.landscape.height,
        characterScale("landscape", size),
      );
      expect(land.w).toBeCloseTo(OUTPUTS.landscape.width * factor, 5);
      expect(land.h).toBeCloseTo(OUTPUTS.landscape.height * factor, 5);
    }
  });

  it("exposes maker and preview radios that feed the shared compositor draw", () => {
    expect(makerSrc).toContain('["character", "studioOptionCharacter", "character"]');
    expect(makerSrc).not.toContain('name="preview-character"');
    expect(makerSrc).toContain('value: "standard"');
    expect(makerSrc).toContain('value: "1.2"');
    expect(makerSrc).toContain('value: "1.4"');
    expect(makerSrc).not.toContain('value: "1.3"');
    expect(makerSrc).not.toContain('value: "x1.3"');
    expect(makerSrc).not.toContain("makerCharacterX13");
    expect(makerSrc).not.toContain('value: "large"');
    expect(makerSrc).not.toContain("makerCharacterNone");
    expect(appSrc).toContain('input[name="character"]');
    expect(appSrc).toContain("characterSize");
    expect(appSrc).toContain("applyCharacterSize");
  });
});

// 段0で現行の公開関数から採録。小数もそのまま固定して配置と効果の回帰を検出する。
describe("frame boundary safety table", () => {
  it.each(boundaries)("$aspect $style $label", (row) => {
    const fx = swapFx(row.time, [0, 0.5, 1], row.style as SwapStyle, row.aspect as AspectMode);
    const { width, height } = OUTPUTS[row.aspect as AspectMode];
    expect(slotForTime(row.time, [0, 0.5, 1])).toBe(row.slot);
    expect(photoForSlot(["a", "b"], fx.plateSlot)).toBe(row.photo);
    expect(fx).toEqual(row.fx);
    expect(plateDest(1600, 1200, width, height, fx, row.style as SwapStyle)).toEqual(row.dest);
  });
});
