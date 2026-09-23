import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fetchSamplePhotoFiles, SAMPLE_PHOTO_URLS } from "./sample-photos.ts";

describe("sample photos", () => {
  it("points at image assets already in public/", () => {
    expect(SAMPLE_PHOTO_URLS.length).toBeGreaterThan(0);
    for (const url of SAMPLE_PHOTO_URLS) {
      expect(url.startsWith("/")).toBe(true);
      expect(existsSync(new URL(`../public${url}`, import.meta.url))).toBe(true);
    }
  });

  it("builds image files and skips failed fetches", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("icon-512.png")) return new Response("nope", { status: 404 });
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    });
    const files = await fetchSamplePhotoFiles(fetchImpl);
    expect(files.map((file) => file.name)).toEqual(["jump-loop-still.png"]);
    expect(files[0]?.type).toBe("image/png");
    expect(files[0]?.size).toBe(3);
  });

  it("returns nothing when every sample request fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(fetchSamplePhotoFiles(fetchImpl)).resolves.toEqual([]);
  });
});
