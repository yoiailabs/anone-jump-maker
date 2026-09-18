import { describe, expect, it } from "vitest";
import { PREVIEW_RESOLUTION_SCALE, scaleCanvasSize } from "./canvas-size.ts";
import {
  BLUR_SOURCE,
  FRAME_FX_TARGET,
  IMAGE_FILTER_BLUR_IMPL,
  IMAGE_FILTER_TARGET,
  JUMP_FLASH_TARGET,
  PHOTO_PLATE_CACHE,
  PHOTO_UPLOAD_PATH,
  SONG_CREDIT,
  blurTapCount,
  createPhotoPlateCache,
  photoPlateCacheKey,
  plateDest,
  samePhotoPlateCacheKey,
  songCreditFontSize,
  songCreditLayout,
  type PhotoPlateCacheInput,
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
  type ImageFilter,
  type SwapStyle,
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

describe("photo plate cache", () => {
  const panel = { w: OUTPUTS.landscape.width, h: OUTPUTS.landscape.height };

  const photo = (id: string, width = 1920, height = 1080) => ({
    id,
    bitmap: { width, height },
  });

  const baseInput = (
    overrides: Partial<Omit<PhotoPlateCacheInput, "photo" | "fx">> & {
      photo?: PhotoPlateCacheInput["photo"];
      fx?: Partial<PhotoPlateCacheInput["fx"]>;
    } = {},
  ): PhotoPlateCacheInput => ({
    photo: overrides.photo ?? photo("p-a"),
    plateSlot: overrides.plateSlot ?? 0,
    swapStyle: overrides.swapStyle ?? "zoom",
    imageFilter: overrides.imageFilter ?? "none",
    aspect: overrides.aspect ?? "landscape",
    panelW: overrides.panelW ?? panel.w,
    panelH: overrides.panelH ?? panel.h,
    fx: {
      scale: 1,
      dy: 0,
      backdrop: false,
      ...overrides.fx,
    },
  });

  it("keeps the photo plate on an offscreen canvas so preview can reuse it", () => {
    expect(PHOTO_PLATE_CACHE).toBe("offscreen-canvas");
  });

  it("reuses the plate when slot, photos, style, filter, aspect, and geometry stay the same", () => {
    const cache = createPhotoPlateCache();
    const key = photoPlateCacheKey(baseInput());
    expect(cache.reuse(key)).toBe(false);
    expect(cache.reuse(photoPlateCacheKey(baseInput()))).toBe(true);
    expect(cache.reuse(key)).toBe(true);
    expect(cache.draws()).toBe(1);
    expect(cache.hits()).toBe(2);
    expect(samePhotoPlateCacheKey(key, photoPlateCacheKey(baseInput()))).toBe(true);
  });

  it("does not treat jump flash as a plate-cache input", () => {
    const rest = swapFx(0.2, [0, 0.5, 1], "jump");
    const flash = swapFx(0, [0, 0.5, 1], "jump");
    expect(flash.flashAdd).toBeGreaterThan(0);
    expect(rest.flashAdd).toBe(0);
    const restKey = photoPlateCacheKey(baseInput({ swapStyle: "jump", fx: rest }));
    const flashKey = photoPlateCacheKey(baseInput({ swapStyle: "jump", fx: flash }));
    expect(restKey.scale).not.toBe(flashKey.scale);
    const sameGeom = photoPlateCacheKey(
      baseInput({
        swapStyle: "jump",
        fx: { scale: rest.scale, dy: rest.dy, backdrop: rest.backdrop },
      }),
    );
    const sameGeomFlash = photoPlateCacheKey(
      baseInput({
        swapStyle: "jump",
        fx: { scale: rest.scale, dy: rest.dy, backdrop: rest.backdrop },
      }),
    );
    expect(samePhotoPlateCacheKey(sameGeom, sameGeomFlash)).toBe(true);
    expect(sameGeom).not.toHaveProperty("flashAdd");
  });

  it("invalidates when any plate input changes", () => {
    const cache = createPhotoPlateCache();
    const first = photoPlateCacheKey(baseInput());
    expect(cache.reuse(first)).toBe(false);

    const changes: Array<[string, PhotoPlateCacheInput]> = [
      ["photo id", baseInput({ photo: photo("p-b") })],
      ["bitmap size", baseInput({ photo: photo("p-a", 1280, 720) })],
      ["plate slot", baseInput({ plateSlot: 1 })],
      ["swap style", baseInput({ swapStyle: "jump" })],
      ["image filter", baseInput({ imageFilter: "blur-weak" })],
      ["aspect", baseInput({ aspect: "portrait", panelW: 608, panelH: 342 })],
      ["panel size", baseInput({ panelW: 608, panelH: 342 })],
      ["scale", baseInput({ fx: { scale: 0.9 } })],
      ["dy", baseInput({ fx: { dy: 0.1 } })],
      ["backdrop", baseInput({ fx: { backdrop: true } })],
    ];

    for (const [, input] of changes) {
      const key = photoPlateCacheKey(input);
      expect(samePhotoPlateCacheKey(first, key)).toBe(false);
      expect(cache.reuse(key)).toBe(false);
    }
    expect(cache.draws()).toBe(1 + changes.length);
    expect(cache.hits()).toBe(0);
  });

  it("reuses the plate while scrubbing time inside a zoom slot whose geometry is still", () => {
    const cache = createPhotoPlateCache();
    const slots = [0, 15 * F, 30 * F];
    const times = [0.2, 0.22, 0.28, 0.33, 0.4];
    for (const time of times) {
      const fx = swapFx(time, slots, "zoom");
      expect(fx.plateSlot).toBe(0);
      expect(fx.scale).toBe(1);
      expect(fx.backdrop).toBe(false);
      cache.reuse(
        photoPlateCacheKey(
          baseInput({
            plateSlot: fx.plateSlot,
            swapStyle: "zoom",
            fx,
          }),
        ),
      );
    }
    expect(cache.draws()).toBe(1);
    expect(cache.hits()).toBe(times.length - 1);
  });

  it("redraws when jump motion changes plate geometry, then reuses a still frame", () => {
    const cache = createPhotoPlateCache();
    const slots = [0, 15 * F, 30 * F];
    const moving = [0, F, 2 * F];
    for (const time of moving) {
      const fx = swapFx(time, slots, "jump");
      cache.reuse(
        photoPlateCacheKey(
          baseInput({
            plateSlot: fx.plateSlot,
            swapStyle: "jump",
            fx,
          }),
        ),
      );
    }
    expect(cache.draws()).toBe(moving.length);
    const still = swapFx(7 * F, slots, "jump");
    const stillKey = photoPlateCacheKey(
      baseInput({
        plateSlot: still.plateSlot,
        swapStyle: "jump",
        fx: still,
      }),
    );
    expect(cache.reuse(stillKey)).toBe(false);
    expect(cache.reuse(stillKey)).toBe(true);
    expect(cache.draws()).toBe(moving.length + 1);
    expect(cache.hits()).toBe(1);
  });

  it("counts fewer plate redraws than paints when only video time advances in-slot", () => {
    const cache = createPhotoPlateCache();
    const slots = [0, 1, 2];
    let paints = 0;
    for (let frame = 6; frame <= 26; frame += 1) {
      const time = frame / TEMPLATE_FPS;
      const fx = swapFx(time, slots, "zoom");
      paints += 1;
      cache.reuse(
        photoPlateCacheKey(
          baseInput({
            plateSlot: fx.plateSlot,
            swapStyle: "zoom" satisfies SwapStyle,
            imageFilter: "blur-strong" satisfies ImageFilter,
            fx,
          }),
        ),
      );
    }
    expect(paints).toBe(21);
    expect(cache.draws()).toBeLessThan(paints);
    expect(cache.draws()).toBe(1);
    expect(cache.hits()).toBe(paints - 1);
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
