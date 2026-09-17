import { describe, expect, it, vi } from "vitest";
import {
  PHOTO_DECODE_CONCURRENCY,
  PHOTO_MAX_EDGE,
  PHOTO_OUTPUT_EDGE,
  PHOTO_THUMB_EDGE,
  mapLimit,
  photoFitSize,
  revokePhotos,
  type LoadedPhoto,
} from "./photos.ts";

describe("photoFitSize", () => {
  it("does not upscale a small photo", () => {
    expect(photoFitSize(800, 600, PHOTO_MAX_EDGE)).toEqual({
      width: 800,
      height: 600,
      downsampled: false,
    });
  });

  it("caps the long edge and keeps aspect", () => {
    const fitted = photoFitSize(4032, 3024, PHOTO_MAX_EDGE);
    expect(fitted.downsampled).toBe(true);
    expect(Math.max(fitted.width, fitted.height)).toBe(PHOTO_MAX_EDGE);
    expect(fitted.width / fitted.height).toBeCloseTo(4032 / 3024, 2);
  });

  it("caps a tall phone photo the same way", () => {
    const fitted = photoFitSize(3024, 4032, PHOTO_MAX_EDGE);
    expect(fitted.downsampled).toBe(true);
    expect(Math.max(fitted.width, fitted.height)).toBe(PHOTO_MAX_EDGE);
    expect(fitted.height).toBeGreaterThan(fitted.width);
  });
});

describe("photo memory budget", () => {
  it("keeps a working bitmap near export size, not the original 12MP", () => {
    expect(PHOTO_OUTPUT_EDGE).toBe(1280);
    expect(PHOTO_MAX_EDGE).toBeGreaterThanOrEqual(PHOTO_OUTPUT_EDGE);
    expect(PHOTO_MAX_EDGE).toBeLessThanOrEqual(PHOTO_OUTPUT_EDGE * 2);
    expect(PHOTO_THUMB_EDGE).toBeLessThan(256);
    expect(PHOTO_THUMB_EDGE).toBeLessThan(PHOTO_MAX_EDGE / 4);
    expect(PHOTO_DECODE_CONCURRENCY).toBeGreaterThanOrEqual(1);
    expect(PHOTO_DECODE_CONCURRENCY).toBeLessThanOrEqual(3);
  });
});

describe("mapLimit", () => {
  it("preserves order with a small worker pool", async () => {
    const seen: number[] = [];
    const out = await mapLimit([10, 20, 30, 40], 2, async (value, index) => {
      seen.push(index);
      await Promise.resolve();
      return value + 1;
    });
    expect(out).toEqual([11, 21, 31, 41]);
    expect(seen).toHaveLength(4);
  });

  it("returns empty for an empty list", async () => {
    expect(await mapLimit([], 2, async (v: number) => v)).toEqual([]);
  });
});

describe("revokePhotos", () => {
  it("closes the working bitmap and revokes only the thumb URL", () => {
    const close = vi.fn();
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const photos: LoadedPhoto[] = [
      {
        id: "a",
        name: "a.jpg",
        bitmap: { close } as unknown as ImageBitmap,
        thumbUrl: "blob:thumb-a",
      },
    ];
    revokePhotos(photos);
    expect(close).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:thumb-a");
    revoke.mockRestore();
  });
});
