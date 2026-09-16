import { describe, expect, it } from "vitest";
import { extensionForMime } from "./recorder.ts";

describe("extensionForMime", () => {
  it("maps containers", () => {
    expect(extensionForMime("video/mp4")).toBe("mp4");
    expect(extensionForMime("video/webm;codecs=vp9,opus")).toBe("webm");
  });
});
