import { describe, expect, it } from "vitest";
import { SWAP_STYLES, type AspectMode, type SwapStyle } from "./layout.ts";
import { exportFileName } from "./modes.ts";

const ASPECTS: readonly AspectMode[] = ["portrait", "landscape"];

describe("2x2 mode matrix", () => {
  it("tags the saved file with both the effect and the aspect", () => {
    const seen = new Set<string>();
    for (const mode of ASPECTS) {
      for (const style of SWAP_STYLES as readonly SwapStyle[]) {
        seen.add(exportFileName(mode, style, "mp4"));
      }
    }
    expect(seen.size).toBe(4);
    expect(exportFileName("portrait", "jump", "mp4")).toBe("anone-jump-9x16.mp4");
    expect(exportFileName("landscape", "zoom", "webm")).toBe("anone-zoom-16x9.webm");
  });
});
