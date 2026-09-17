import { describe, expect, it } from "vitest";
import { combineStreams, extensionForMime } from "./recorder.ts";

describe("extensionForMime", () => {
  it("maps containers", () => {
    expect(extensionForMime("video/mp4")).toBe("mp4");
    expect(extensionForMime("video/webm;codecs=vp9,opus")).toBe("webm");
  });
});

describe("combineStreams", () => {
  it("keeps canvas video tracks and appends element audio tracks only", () => {
    class FakeStream {
      constructor(private readonly tracks: Array<{ kind: string }> = []) {}
      getVideoTracks() {
        return this.tracks.filter((track) => track.kind === "video");
      }
      getAudioTracks() {
        return this.tracks.filter((track) => track.kind === "audio");
      }
    }
    const previous = globalThis.MediaStream;
    (globalThis as unknown as { MediaStream: typeof FakeStream }).MediaStream = FakeStream;
    try {
      const canvas = new FakeStream([{ kind: "video" }]);
      const audio = new FakeStream([{ kind: "audio" }, { kind: "video" }]);
      const mixed = combineStreams(canvas as unknown as MediaStream, audio as unknown as MediaStream);
      expect(mixed.getVideoTracks()).toHaveLength(1);
      expect(mixed.getAudioTracks()).toHaveLength(1);
    } finally {
      (globalThis as unknown as { MediaStream: typeof previous }).MediaStream = previous;
    }
  });
});
