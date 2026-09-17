import { describe, expect, it } from "vitest";
import { ASPECT_LABELS, SWAP_STYLES, SWAP_STYLE_LABELS, type AspectMode, type SwapStyle } from "./layout.ts";
import { describeMode, exportFileName, formatModeLabel } from "./modes.ts";

const ASPECTS: readonly AspectMode[] = ["portrait", "landscape"];

describe("2x2 mode matrix", () => {
  it("names every aspect x effect combination in Japanese", () => {
    const labels = new Set<string>();
    for (const mode of ASPECTS) {
      for (const style of SWAP_STYLES) {
        const label = formatModeLabel(mode, style);
        expect(label).toContain(ASPECT_LABELS[mode]);
        expect(label).toContain(SWAP_STYLE_LABELS[style]);
        labels.add(label);
      }
    }
    expect(labels.size).toBe(4);
    expect(formatModeLabel("portrait", "jump")).toBe("縦 × ジャンプ");
    expect(formatModeLabel("landscape", "zoom")).toBe("横 × ズーム");
  });

  it("describes the frame and the swap without official branding text", () => {
    for (const mode of ASPECTS) {
      for (const style of SWAP_STYLES) {
        const text = describeMode(mode, style);
        expect(text).toContain(mode === "portrait" ? "9:16" : "16:9");
        expect(text).toContain(style === "zoom" ? "ズーム" : "ジャンプ");
        expect(text).not.toMatch(/CapCut|ナナツカゼ/);
      }
    }
  });

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
