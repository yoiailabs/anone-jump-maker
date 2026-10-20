import { describe, expect, it } from "vitest";
import {
  IMAGE_FILTERS,
  SWAP_STYLES,
  type AspectMode,
  type ImageFilter,
  type SwapStyle,
} from "./layout.ts";
import { exportFileName } from "./modes.ts";

const ASPECTS: readonly AspectMode[] = ["portrait", "landscape"];

describe("aspect and effect matrix", () => {
  it("tags the saved file with both the effect and the aspect", () => {
    const seen = new Set<string>();
    for (const mode of ASPECTS) {
      for (const style of SWAP_STYLES as readonly SwapStyle[]) {
        seen.add(exportFileName(mode, style, "mp4"));
      }
    }
    expect(seen.size).toBe(2 * SWAP_STYLES.length);
    expect(exportFileName("portrait", "papertear", "mp4")).toBe("anone-papertear-9x16.mp4");
    expect(exportFileName("portrait", "jump", "mp4")).toBe("anone-jump-9x16.mp4");
    expect(exportFileName("landscape", "zoom", "webm")).toBe("anone-zoom-16x9.webm");
  });
});

describe("image filter in filename", () => {
  it("keeps the default name when the filter is none", () => {
    expect(exportFileName("portrait", "jump", "mp4", "none")).toBe("anone-jump-9x16.mp4");
  });

  it("appends the blur tag so 2x2x3 combinations stay unique", () => {
    const seen = new Set<string>();
    for (const mode of ASPECTS) {
      for (const style of SWAP_STYLES as readonly SwapStyle[]) {
        for (const filter of IMAGE_FILTERS as readonly ImageFilter[]) {
          seen.add(exportFileName(mode, style, "mp4", filter));
        }
      }
    }
    expect(seen.size).toBe(2 * SWAP_STYLES.length * IMAGE_FILTERS.length);
    expect(exportFileName("portrait", "jump", "mp4", "blur-strong")).toBe(
      "anone-jump-9x16-blur-strong.mp4",
    );
    expect(exportFileName("landscape", "zoom", "webm", "blur-weak")).toBe(
      "anone-zoom-16x9-blur-weak.webm",
    );
  });
});
