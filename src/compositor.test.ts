import { describe, expect, it } from "vitest";
import { BLUR_SOURCE, PHOTO_UPLOAD_PATH } from "./compositor.ts";
import { JUMP_AMPLITUDE, jumpOffsetPx, mainPanelRect, sharpCoverScale } from "./layout.ts";

describe("photo orientation", () => {
  it("uploads photos via Canvas2D so UNPACK_FLIP_Y_WEBGL does not invert ImageBitmap", () => {
    expect(PHOTO_UPLOAD_PATH).toBe("canvas2d-blit");
  });
});

describe("backdrop hop", () => {
  it("blurs the composed 16:9 main frame, not the photo alone", () => {
    expect(BLUR_SOURCE).toBe("main-frame");
  });

  it("uses the same cut-synced offset for the sharp 16:9 photo", () => {
    const slots = [0, 0.467];
    const hop = jumpOffsetPx(0.12, slots, 1280);
    const panel = mainPanelRect(720, 1280);
    expect(hop).toBeLessThan(0);
    expect(Math.abs(hop)).toBeLessThanOrEqual(1280 * JUMP_AMPLITUDE + 1e-6);
    expect(sharpCoverScale(1280, panel.h) * panel.h).toBeGreaterThan(panel.h + 2 * Math.abs(hop));
  });
});
