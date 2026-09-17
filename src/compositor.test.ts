import { describe, expect, it } from "vitest";
import { BLUR_SOURCE, PHOTO_UPLOAD_PATH } from "./compositor.ts";
import {
  CHAR_SCALE,
  JUMP_AMPLITUDE,
  LANDSCAPE_CHAR_SCALE,
  OUTPUTS,
  characterDest,
  jumpOffsetPx,
  mainPanelRect,
  sharpCoverScale,
  swapFx,
  usesBlurBackdrop,
} from "./layout.ts";

describe("photo orientation", () => {
  it("uploads photos via Canvas2D so UNPACK_FLIP_Y_WEBGL does not invert ImageBitmap", () => {
    expect(PHOTO_UPLOAD_PATH).toBe("canvas2d-blit");
  });
});

describe("backdrop hop", () => {
  it("blurs the composed 16:9 main frame, not the photo alone", () => {
    expect(BLUR_SOURCE).toBe("main-frame");
  });

  it("places a larger bottom-aligned character so the cover-blur matches the official close-up", () => {
    const dest = characterDest(608, 342);
    expect(CHAR_SCALE).toBeGreaterThan(1.5);
    expect(dest.y).toBeLessThan(0);
    expect(dest.w).toBeGreaterThan(608);
  });

  it("uses the same cut-synced offset for the sharp 16:9 photo", () => {
    const slots = [0, 0.467];
    const hop = jumpOffsetPx(0.12, slots, 1080);
    const panel = mainPanelRect(608, 1080);
    expect(hop).toBeLessThan(0);
    expect(Math.abs(hop)).toBeLessThanOrEqual(1080 * JUMP_AMPLITUDE + 1e-6);
    expect(sharpCoverScale(1080, panel.h) * panel.h).toBeGreaterThan(panel.h + 2 * Math.abs(hop));
  });

  it("keeps landscape as a full 16:9 plate with a larger bottom-aligned character", () => {
    expect(usesBlurBackdrop("landscape")).toBe(false);
    const dest = characterDest(OUTPUTS.landscape.width, OUTPUTS.landscape.height, LANDSCAPE_CHAR_SCALE);
    expect(CHAR_SCALE).toBeGreaterThan(1.5);
    expect(LANDSCAPE_CHAR_SCALE).toBeGreaterThan(1);
    expect(dest.y).toBeLessThan(0);
    expect(dest.w).toBeGreaterThan(OUTPUTS.landscape.width);
    const hop = jumpOffsetPx(0.12, [0, 0.467], OUTPUTS.landscape.height);
    expect(hop).toBeLessThan(0);
    expect(sharpCoverScale(OUTPUTS.landscape.height, OUTPUTS.landscape.height)).toBeGreaterThan(1);
  });

  it("flashes and punches the photo on a cut instead of swapping it raw", () => {
    const cut = swapFx(0.467, [0, 0.467, 0.933]);
    const rest = swapFx(0.8, [0, 0.467, 0.933]);
    expect(cut.flash).toBeGreaterThan(0.7);
    expect(cut.punch).toBeGreaterThan(rest.punch);
    expect(rest.flash).toBe(0);
  });

  it("advances hop and swap from the given time only", () => {
    const slots = [0, 0.467, 0.933];
    expect(jumpOffsetPx(0.12, slots, 1080)).toBe(jumpOffsetPx(0.12, slots, 1080));
    expect(swapFx(0.467, slots).flash).toBe(swapFx(0.467, slots).flash);
    expect(swapFx(0.12, slots).flash).toBe(0);
  });
});
