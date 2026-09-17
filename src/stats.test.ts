import { describe, expect, it } from "vitest";
import { collectClientAttrs } from "./stats.ts";

describe("collectClientAttrs", () => {
  it("always records exportMode as record", () => {
    const attrs = collectClientAttrs({ mime: "video/webm;codecs=vp9,opus" });
    expect(attrs.exportMode).toBe("record");
    expect(attrs.mime).toBe("video/webm");
    expect(attrs.width).toBe(608);
    expect(attrs.height).toBe(1080);
  });

  it("records the canvas size of the selected orientation", () => {
    const attrs = collectClientAttrs({ mime: "video/webm", width: 1280, height: 720 });
    expect(attrs.width).toBe(1280);
    expect(attrs.height).toBe(720);
  });
});
