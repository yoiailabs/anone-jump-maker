import { describe, expect, it } from "vitest";
import { collectClientAttrs } from "./stats.ts";

describe("collectClientAttrs", () => {
  it("records a save with exportMode record", () => {
    const attrs = collectClientAttrs({ action: "save", mime: "video/webm;codecs=vp9,opus" });
    expect(attrs.action).toBe("save");
    expect(attrs.exportMode).toBe("record");
    expect(attrs.mime).toBe("video/webm");
    expect(attrs.width).toBe(608);
    expect(attrs.height).toBe(1080);
  });

  it("records a preview without requiring mime or exportMode", () => {
    const attrs = collectClientAttrs({ action: "preview", width: 1280, height: 720 });
    expect(attrs.action).toBe("preview");
    expect(attrs.exportMode).toBeUndefined();
    expect(attrs.mime).toBeUndefined();
    expect(attrs.width).toBe(1280);
    expect(attrs.height).toBe(720);
  });

  it("records the canvas size of the selected orientation", () => {
    const attrs = collectClientAttrs({ action: "save", mime: "video/webm", width: 1280, height: 720 });
    expect(attrs.width).toBe(1280);
    expect(attrs.height).toBe(720);
  });
});
