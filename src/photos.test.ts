import { describe, expect, it, vi } from "vitest";
import { PHOTO_MAX_COUNT } from "./photo-list.ts";
import {
  HEIC_UNSUPPORTED_MESSAGE,
  IMAGE_LOAD_ERROR,
  PHOTO_DECODE_ATTEMPTS,
  PHOTO_DECODE_CONCURRENCY,
  PHOTO_MAX_EDGE,
  PHOTO_OUTPUT_EDGE,
  PHOTO_THUMB_EDGE,
  decodeAttemptNames,
  decodeFullBitmap,
  decodeRasterBitmap,
  fileExtension,
  guessImageMime,
  isExpectedPhotoLoadError,
  isHeicLike,
  imageFilesWithinPhotoCap,
  isLikelyImageFile,
  loadPhotos,
  mapLimit,
  newPhotoId,
  mimeFromSignature,
  photoDecodeExtras,
  photoFitSize,
  revokePhotos,
  selectImageFiles,
  sniffImageSignature,
  tryInOrder,
  type ErrorWithPhotoExtras,
  type LoadedPhoto,
} from "./photos.ts";
import { reportError } from "./sentry.ts";

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

describe("isLikelyImageFile / selectImageFiles", () => {
  const file = (name: string, type: string) => new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type });

  it("keeps gallery files with an empty MIME when the extension looks like a photo", () => {
    expect(isLikelyImageFile(file("IMG_0001.jpg", ""))).toBe(true);
    expect(isLikelyImageFile(file("shot.PNG", ""))).toBe(true);
    expect(isLikelyImageFile(file("pic.webp", "application/octet-stream"))).toBe(true);
  });

  it("does not drop empty-MIME files that have no extension (Android content names)", () => {
    expect(isLikelyImageFile(file("1000000123", ""))).toBe(true);
    expect(isLikelyImageFile(file("image", ""))).toBe(true);
  });

  it("still accepts a normal image MIME and rejects obvious non-images", () => {
    expect(isLikelyImageFile(file("a.jpg", "image/jpeg"))).toBe(true);
    expect(isLikelyImageFile(file("a.jpg", "image/jpg"))).toBe(true);
    expect(isLikelyImageFile(file("clip.mp4", "video/mp4"))).toBe(false);
    expect(isLikelyImageFile(file("notes.pdf", "application/pdf"))).toBe(false);
    expect(isLikelyImageFile(file("notes.pdf", ""))).toBe(false);
  });

  it("does not silently drop empty-MIME JPEGs from a mixed picker list", () => {
    const kept = selectImageFiles([
      file("ok.jpg", ""),
      file("skip.mp4", "video/mp4"),
      file("also.png", "image/png"),
    ]);
    expect(kept.map((item) => item.name)).toEqual(["ok.jpg", "also.png"]);
  });

  it("keeps the first PHOTO_MAX_COUNT images and ignores non-images in the count", () => {
    const images = Array.from({ length: PHOTO_MAX_COUNT + 1 }, (_, i) => file(`p${i}.jpg`, "image/jpeg"));
    const fresh = imageFilesWithinPhotoCap(0, images);
    expect(fresh.overflow).toBe(true);
    expect(fresh.accepted.map((item) => item.name)).toEqual(images.slice(0, PHOTO_MAX_COUNT).map((item) => item.name));

    const mixed = [
      file("clip.mp4", "video/mp4"),
      ...images.slice(0, 3),
      file("notes.pdf", "application/pdf"),
    ];
    const added = imageFilesWithinPhotoCap(PHOTO_MAX_COUNT - 2, mixed);
    expect(added.overflow).toBe(true);
    expect(added.accepted.map((item) => item.name)).toEqual(["p0.jpg", "p1.jpg"]);
  });
});

describe("image signature / HEIC", () => {
  it("sniffs JPEG / PNG / WebP magic bytes", () => {
    expect(sniffImageSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffImageSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(sniffImageSignature(webp)).toBe("webp");
    expect(mimeFromSignature("jpeg")).toBe("image/jpeg");
  });

  it("detects HEIC from ftyp brand, MIME, or extension", () => {
    const header = new Uint8Array(12);
    header.set([0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 4);
    expect(sniffImageSignature(header)).toBe("heic");
    expect(isHeicLike({ name: "IMG_0001.HEIC", type: "" })).toBe(true);
    expect(isHeicLike({ name: "photo.jpg", type: "image/heif" })).toBe(true);
    expect(isHeicLike({ name: "photo.jpg", type: "image/jpeg" }, "heic")).toBe(true);
    expect(isHeicLike({ name: "photo.jpg", type: "image/jpeg" })).toBe(false);
  });

  it("guesses MIME from extension when the picker left type empty", () => {
    expect(guessImageMime({ name: "IMG_0001.JPG", type: "" })).toBe("image/jpeg");
    expect(guessImageMime({ name: "1000000123", type: "" }, "jpeg")).toBe("image/jpeg");
    expect(fileExtension("DCIM/Camera/IMG_0001.JPEG")).toBe("jpeg");
  });

  it("builds decode extras without a filename", () => {
    expect(photoDecodeExtras({ name: "shot.PNG", type: "", size: 2048 }, "png")).toEqual({
      signature: "png",
      mime: "image/png",
      extension: "png",
      byteSize: 2048,
      decodeAttempts: [...PHOTO_DECODE_ATTEMPTS],
    });
  });
});

describe("photo load status / expected failures", () => {
  it("treats generic and HEIC decode messages as expected user-file failures", () => {
    expect(isExpectedPhotoLoadError(new Error(IMAGE_LOAD_ERROR))).toBe(true);
    expect(isExpectedPhotoLoadError(new Error(HEIC_UNSUPPORTED_MESSAGE))).toBe(true);
    expect(isExpectedPhotoLoadError(new Error("サムネを作れませんでした"))).toBe(false);
    expect(isExpectedPhotoLoadError("画像を読み込めませんでした")).toBe(false);
  });
});

describe("tryInOrder / decode fallback order", () => {
  it("returns the first success and does not run later attempts", async () => {
    const seen: string[] = [];
    const value = await tryInOrder([
      async () => {
        seen.push("a");
        throw new Error("a");
      },
      async () => {
        seen.push("b");
        return 7;
      },
      async () => {
        seen.push("c");
        return 9;
      },
    ]);
    expect(value).toBe(7);
    expect(seen).toEqual(["a", "b"]);
  });

  it("throws the last error when every attempt fails", async () => {
    await expect(
      tryInOrder([
        async () => {
          throw new Error("first");
        },
        async () => {
          throw new Error("last");
        },
      ]),
    ).rejects.toThrow("last");
  });

  it("uses orientation → plain → typed → object URL → data URL", () => {
    expect(PHOTO_DECODE_ATTEMPTS).toEqual([
      "bitmap-orient",
      "bitmap-plain",
      "bitmap-typed-orient",
      "bitmap-typed-plain",
      "html-object-url",
      "html-data-url",
    ]);
    expect(decodeAttemptNames({ name: "a.jpg", type: "image/jpeg" }, "jpeg")).toEqual([
      "bitmap-orient",
      "bitmap-plain",
      "html-object-url",
      "html-data-url",
    ]);
    expect(decodeAttemptNames({ name: "a.jpg", type: "" }, "jpeg")).toEqual([...PHOTO_DECODE_ATTEMPTS]);
  });

  it("falls back to createImageBitmap without options when orientation is rejected", async () => {
    const file = jpegFile("photo.jpg", "");
    const bitmap = fakeBitmap(12, 8);
    const createImageBitmap = vi
      .fn()
      .mockRejectedValueOnce(new Error("orient"))
      .mockResolvedValueOnce(bitmap);
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    try {
      await expect(decodeFullBitmap(file)).resolves.toBe(bitmap);
      expect(createImageBitmap).toHaveBeenCalledTimes(2);
      expect(createImageBitmap.mock.calls[0]?.[1]).toEqual({ imageOrientation: "from-image" });
      expect(createImageBitmap.mock.calls[1]?.[1]).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to FileReader data URL when bitmap and object URL both fail", async () => {
    const file = jpegFile("photo.jpg", "image/jpeg");
    const bitmap = fakeBitmap(4, 4);
    const createImageBitmap = vi.fn(async (source: unknown) => {
      if (source && typeof source === "object" && "src" in source) return bitmap;
      throw new Error("bitmap");
    });
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:fail",
      revokeObjectURL: () => {},
    });
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        #src = "";
        get src() {
          return this.#src;
        }
        set src(value: string) {
          this.#src = value;
          queueMicrotask(() => {
            if (value.startsWith("data:")) this.onload?.();
            else this.onerror?.();
          });
        }
      },
    );
    vi.stubGlobal(
      "FileReader",
      class {
        result: string | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL() {
          this.result = "data:image/jpeg;base64,aaaa";
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    try {
      await expect(decodeFullBitmap(file)).resolves.toBe(bitmap);
      expect(createImageBitmap.mock.calls.some((call) => call[0] && typeof call[0] === "object" && "src" in call[0])).toBe(
        true,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("explains HEIC instead of the generic load error when convert is unavailable", async () => {
    const file = heicFile();
    const convertHeic = vi.fn(async () => {
      throw new Error("no wasm");
    });
    vi.stubGlobal("createImageBitmap", vi.fn(async () => {
      throw new Error("no heic");
    }));
    try {
      await expect(decodeFullBitmap(file, { convertHeic })).rejects.toThrow(HEIC_UNSUPPORTED_MESSAGE);
      expect(convertHeic).toHaveBeenCalledOnce();
      expect(HEIC_UNSUPPORTED_MESSAGE).toContain("互換性優先");
      expect(HEIC_UNSUPPORTED_MESSAGE).toContain("スクショ");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not run the HEIC converter for a JPEG", async () => {
    const bitmap = fakeBitmap(8, 8);
    const convertHeic = vi.fn(async () => {
      throw new Error("jpeg must not convert");
    });
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
    try {
      await expect(decodeFullBitmap(jpegFile("photo.jpg", "image/jpeg"), { convertHeic })).resolves.toBe(bitmap);
      expect(convertHeic).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("decodes HEIC via a converted JPEG on the existing raster path", async () => {
    const file = heicFile();
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "out.jpg", { type: "image/jpeg" });
    const bitmap = fakeBitmap(20, 16);
    const convertHeic = vi.fn(async () => jpeg);
    const createImageBitmap = vi.fn(async (source: unknown) => {
      if (source === file) throw new Error("no native heic");
      return bitmap;
    });
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    try {
      await expect(decodeFullBitmap(file, { convertHeic })).resolves.toBe(bitmap);
      expect(convertHeic).toHaveBeenCalledOnce();
      expect(createImageBitmap.mock.calls.some((call) => call[0] !== file)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("attaches decode extras when every raster attempt fails", async () => {
    const file = new File([new Uint8Array([0x00, 0x11, 0x22])], "x.webp", { type: "" });
    vi.stubGlobal("createImageBitmap", vi.fn(async () => {
      throw new Error("bitmap");
    }));
    stubFailedHtmlDecode();
    try {
      await decodeRasterBitmap(file, "unknown").then(
        () => {
          throw new Error("expected decodeRasterBitmap to reject");
        },
        (error: unknown) => {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe(IMAGE_LOAD_ERROR);
          expect((error as ErrorWithPhotoExtras).extras).toEqual({
            signature: "unknown",
            mime: "image/webp",
            extension: "webp",
            byteSize: 3,
            decodeAttempts: [...PHOTO_DECODE_ATTEMPTS],
          });
        },
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("accepts an ImageBitmap from the HEIC converter", async () => {
    const file = heicFile();
    const bitmap = fakeBitmap(32, 24);
    const convertHeic = vi.fn(async () => bitmap);
    vi.stubGlobal("createImageBitmap", vi.fn(async () => {
      throw new Error("no native heic");
    }));
    try {
      await expect(decodeFullBitmap(file, { convertHeic })).resolves.toBe(bitmap);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("newPhotoId", () => {
  it("uses crypto.randomUUID when it is a function", () => {
    const randomUUID = vi.fn(() => "11111111-2222-3333-4444-555555555555");
    vi.stubGlobal("crypto", { randomUUID });
    try {
      expect(newPhotoId()).toBe("11111111-2222-3333-4444-555555555555");
      expect(randomUUID).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to uuid v4 when randomUUID is missing", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab);
        return bytes;
      },
    });
    try {
      expect(newPhotoId()).toBe("abababab-abab-4bab-abab-abababababab");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("loadPhotos", () => {
  it("loads an empty-MIME JPEG instead of dropping it", async () => {
    const bitmap = fakeBitmap(12, 8);
    stubPhotoGlobals(bitmap);
    try {
      const photos = await loadPhotos([jpegFile("IMG_0001.jpg", "")]);
      expect(photos).toHaveLength(1);
      expect(photos[0]?.name).toBe("IMG_0001.jpg");
      expect(photos[0]?.thumbUrl).toBe("blob:thumb");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("still assigns a photo id when crypto.randomUUID is missing", async () => {
    const bitmap = fakeBitmap(12, 8);
    stubPhotoGlobals(bitmap);
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab);
        return bytes;
      },
    });
    try {
      const file = jpegFile("IMG_0001.jpg", "");
      const photos = await loadPhotos([file]);
      expect(photos).toHaveLength(1);
      expect(photos[0]?.id).toBe(
        `${file.name}-${file.size}-${file.lastModified}-abababab-abab-4bab-abab-abababababab`,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps a readable JPEG when another file in the batch is HEIC", async () => {
    const jpeg = jpegFile("ok.jpg", "image/jpeg");
    const header = new Uint8Array(12);
    header.set([0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 4);
    const heic = new File([header], "bad.heic", { type: "image/heic" });
    const bitmap = fakeBitmap(16, 16);
    stubPhotoGlobals(bitmap, (source) => {
      if (source instanceof Blob && source === heic) throw new Error("no heic");
      if (source instanceof Blob && source.type === "image/heic") throw new Error("no heic");
    });
    vi.stubGlobal(
      "Image",
      class {
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    vi.stubGlobal(
      "FileReader",
      class {
        onerror: (() => void) | null = null;
        readAsDataURL() {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    try {
      const seen: unknown[] = [];
      const photos = await loadPhotos([heic, jpeg], {
        convertHeic: async () => {
          throw new Error("no wasm");
        },
        onError: (error) => seen.push(error),
      });
      expect(photos.map((photo) => photo.name)).toEqual(["ok.jpg"]);
      expect(seen).toHaveLength(1);
      expect(seen[0]).toBeInstanceOf(Error);
      expect((seen[0] as Error).message).toBe(HEIC_UNSUPPORTED_MESSAGE);
      expect(isExpectedPhotoLoadError(seen[0])).toBe(true);
      expect((seen[0] as ErrorWithPhotoExtras).extras).toMatchObject({
        signature: "heic",
        mime: "image/heic",
        extension: "heic",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("skips an undecodable raster file, keeps the rest, and does not report to Sentry", async () => {
    const jpeg = jpegFile("ok.jpg", "image/jpeg");
    const bad = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], "broken.jpg", { type: "image/jpeg" });
    const bitmap = fakeBitmap(16, 16);
    stubPhotoGlobals(bitmap, (source) => {
      if (source instanceof Blob && source === bad) throw new Error("undecodable");
      if (source instanceof Blob && source.size === bad.size && source.type === bad.type) {
        throw new Error("undecodable");
      }
    });
    stubFailedHtmlDecode();
    const capture = vi.fn();
    try {
      const seen: unknown[] = [];
      const photos = await loadPhotos([bad, jpeg], {
        onError: (error) => {
          seen.push(error);
          reportError(error, capture);
        },
      });
      expect(photos.map((photo) => photo.name)).toEqual(["ok.jpg"]);
      expect(seen).toHaveLength(1);
      expect((seen[0] as Error).message).toBe(IMAGE_LOAD_ERROR);
      expect(isExpectedPhotoLoadError(seen[0])).toBe(true);
      expect((seen[0] as ErrorWithPhotoExtras).extras).toEqual({
        signature: "unknown",
        mime: "image/jpeg",
        extension: "jpg",
        byteSize: 4,
        decodeAttempts: ["bitmap-orient", "bitmap-plain", "html-object-url", "html-data-url"],
      });
      expect(capture).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("throws the expected message when every selected file fails to decode", async () => {
    const bad = new File([new Uint8Array([0x00, 0x01])], "broken.jpg", { type: "image/jpeg" });
    stubPhotoGlobals(fakeBitmap(8, 8), () => {
      throw new Error("undecodable");
    });
    stubFailedHtmlDecode();
    try {
      await expect(loadPhotos([bad])).rejects.toThrow(IMAGE_LOAD_ERROR);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps unexpected thumb failures distinguishable from bad gallery files", async () => {
    const file = jpegFile("ok.jpg", "image/jpeg");
    stubPhotoGlobals(fakeBitmap(12, 8));
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        if (tag !== "canvas") throw new Error(tag);
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: () => {} }),
          toBlob: (cb: (blob: Blob | null) => void) => cb(null),
        };
      },
    });
    try {
      await loadPhotos([file]).then(
        () => {
          throw new Error("expected loadPhotos to reject");
        },
        (error: unknown) => {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("サムネを作れませんでした");
          expect(isExpectedPhotoLoadError(error)).toBe(false);
          expect((error as ErrorWithPhotoExtras).extras).toMatchObject({
            signature: "unknown",
            mime: "image/jpeg",
            extension: "jpg",
            byteSize: file.size,
          });
        },
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("loads a camera HEIC after converting it to JPEG", async () => {
    const heic = heicFile();
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "x.jpg", { type: "image/jpeg" });
    const bitmap = fakeBitmap(24, 24);
    stubPhotoGlobals(bitmap, (source) => {
      if (source === heic) throw new Error("no native heic");
    });
    try {
      const photos = await loadPhotos([heic], { convertHeic: async () => jpeg });
      expect(photos).toHaveLength(1);
      expect(photos[0]?.name).toBe("IMG_0001.HEIC");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function stubFailedHtmlDecode(): void {
  vi.stubGlobal(
    "Image",
    class {
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    },
  );
  vi.stubGlobal(
    "FileReader",
    class {
      onerror: (() => void) | null = null;
      readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
    },
  );
}

function stubPhotoGlobals(
  bitmap: ImageBitmap,
  beforeCreate?: (source: unknown) => void | Promise<void>,
): void {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (source: unknown) => {
      await beforeCreate?.(source);
      return bitmap;
    }),
  );
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:thumb",
    revokeObjectURL: () => {},
  });
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag !== "canvas") throw new Error(tag);
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => {} }),
        toBlob: (cb: (blob: Blob | null) => void) => cb(new Blob(["x"], { type: "image/jpeg" })),
      };
    },
  });
}

function heicFile(): File {
  const header = new Uint8Array(12);
  header.set([0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 4);
  return new File([header], "IMG_0001.HEIC", { type: "" });
}

function jpegFile(name: string, type: string, lastModified = 0): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], name, { type, lastModified });
}

function fakeBitmap(width: number, height: number): ImageBitmap {
  return {
    width,
    height,
    close: () => {},
  } as ImageBitmap;
}
