import { describe, expect, it } from "vitest";
import { PHOTO_UPLOAD_PATH } from "./compositor.ts";

describe("photo orientation", () => {
  it("uploads photos via Canvas2D so UNPACK_FLIP_Y_WEBGL does not invert ImageBitmap", () => {
    expect(PHOTO_UPLOAD_PATH).toBe("canvas2d-blit");
  });
});
